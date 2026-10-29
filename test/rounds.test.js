const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { PGlite } = require('@electric-sql/pglite');
const { parseHTML } = require('linkedom');
const { buildRounds } = require('../public/rounds');
const { SEED_MATCHES, pool } = require('../db');
const { server, wss } = require('../server');

const fixtures = SEED_MATCHES.map(m => ({ ...m, matchDate: m.match_date }));
const rounds = buildRounds(fixtures);
const db = new PGlite();
let base;
const originalQuery = pool.query;

before(async () => {
    // Isolated PostgreSQL engine; never initialize or connect to the real DB.
    pool.query = (sql, params) => db.query(sql, params);
    await db.exec(`
        CREATE TABLE matches (id varchar(50) PRIMARY KEY, team text, tournament text,
            opponent text, match_date date, played boolean DEFAULT false, result_points integer);
        CREATE TABLE players (id integer PRIMARY KEY, name text, is_active integer, invite_token text);
        CREATE TABLE rooms (id integer PRIMARY KEY, is_locked boolean, invite_token text);
        CREATE TABLE room_players (room_id integer, player_id integer);
        CREATE TABLE guesses (id serial PRIMARY KEY, player_id integer, match_id varchar(50),
            points integer, guessed_at timestamp DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO players VALUES (1,'Ada',1,'inv_ada'),(2,'Bora',1,'inv_bora'),
            (3,'Inactive',0,'inv_inactive'),(4,'Other room',1,'inv_other'),(5,'No guesses',1,'inv_none');
        INSERT INTO rooms VALUES (1,true,'room_one'),(2,true,'room_two');
        INSERT INTO room_players VALUES (1,1),(1,2),(1,3),(2,4),(1,5);
    `);
    for (const m of fixtures) await db.query(
        'INSERT INTO matches (id,team,tournament,opponent,match_date) VALUES ($1,$2,$3,$4,$5)',
        [m.id, m.team, m.tournament, m.opponent, m.matchDate]);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => wss.close(resolve));
    pool.query = originalQuery;
    await pool.end();
    await db.close();
});

test('actual seed: closest dates reunite September and November; absent TS stays absent', () => {
    assert.deepEqual(rounds.map(r => r.matchIds.length), [3,4,4,4,4,4,1,3,3]);
    assert.deepEqual(rounds[0].matchIds, ['gs_1','fb_1','bjk_1']);
    assert.deepEqual(rounds[3].matchIds, ['gs_4','fb_4','bjk_4','ts_3']);
    assert.equal(rounds[3].startDate, '2026-11-03');
    assert.equal(rounds[3].endDate, '2026-11-12');
    assert.deepEqual(rounds[6].matchIds, ['ts_6']);
    const assigned = rounds.flatMap(r => r.matchIds);
    assert.equal(new Set(assigned).size, 30);
    assert.equal(assigned.length, 30);
    for (const round of rounds) {
        assert.equal(new Set(fixtures.filter(m => round.matchIds.includes(m.id)).map(m => m.team)).size, round.matchIds.length);
    }
    assert.deepEqual(buildRounds([...fixtures].reverse()), rounds);
});

test('nearest dates win over input order, with deterministic ties and no distant filler', () => {
    const game = (id, team, matchDate) => ({ id, team, matchDate, tournament: 'UCL' });
    const games = [game('a','A','2026-11-01'), game('b','A','2026-11-10'),
        game('c','TS','2026-11-09'), game('d','B','2027-01-01')];
    assert.deepEqual(buildRounds(games).map(r => r.matchIds), [['a'],['c','b'],['d']]);
    assert.deepEqual(buildRounds([game('y','A','2026-12-31'), game('z','B','2027-01-01')])[0].matchIds, ['y','z']);
    assert.deepEqual(buildRounds([]), []);
    assert.deepEqual(buildRounds([game('x','A',null), game('y','B','2026-02-30'),
        { ...game('z','C','2026-01-01'), tournament:'Super Lig' }]), []);
    const browser = vm.createContext({});
    vm.runInContext(fs.readFileSync(require.resolve('../public/rounds'), 'utf8'), browser);
    assert.equal(JSON.stringify(browser.EuropeanRounds.buildRounds(fixtures)), JSON.stringify(rounds));
});

async function competition(round = rounds[3]) {
    const response = await fetch(base + '/api/weekly-competition?roomId=1&roundId=' + round.id);
    assert.equal(response.status, 200);
    return response.json();
}

test('round standings wait for cross-week results, preserve zero-point correct guesses and ranking', async () => {
    const ids = rounds[3].matchIds;
    await db.query('UPDATE matches SET played=true, result_points=3 WHERE id=ANY($1::varchar[])', [ids.slice(0,3)]);
    let result = await competition();
    assert.equal(result.complete, false);
    assert.equal(result.remaining, 1);
    assert.equal(result.standings, null);
    await db.query('UPDATE matches SET played=true WHERE id=$1', [ids[3]]);
    assert.equal((await competition()).complete, false); // played alone is not a recorded result
    await db.query('UPDATE matches SET result_points=0 WHERE id=$1', [ids[3]]);
    await db.query('UPDATE matches SET result_points=0 WHERE id=$1', [ids[0]]);
    await db.exec(`INSERT INTO guesses (player_id,match_id,points) VALUES
        (1,'gs_4',0),(1,'ts_3',0),(2,'fb_4',3),
        (3,'gs_4',0),(3,'fb_4',3),(3,'bjk_4',3),(3,'ts_3',0),
        (4,'gs_4',0),(4,'fb_4',3), (2,'fb_3',3);`);
    // A correct result outside this round must not count.
    await db.exec("UPDATE matches SET played=true,result_points=3 WHERE id='fb_3'");
    result = await competition();
    assert.equal(result.complete, true);
    assert.deepEqual(result.matchIds, ids);
    assert.deepEqual(result.standings.map(p => [p.name,p.correctCount,p.points]),
        [['Ada',2,0],['Bora',1,3],['No guesses',0,0]]);
    // Corrections take effect immediately and continue to gate completion.
    await db.exec("UPDATE matches SET played=false WHERE id='ts_3'");
    assert.equal((await competition()).complete, false);
    await db.exec("UPDATE matches SET played=true WHERE id='ts_3'");
    assert.equal((await competition(rounds[0])).complete, false);
});

test('API rejects bad or stale selectors instead of falling back to calendar weeks', async () => {
    for (const query of ['roomId=0&roundId=x', 'roomId=1&weekStart=2026-11-02', 'roomId=oops&roundId=x']) {
        assert.equal((await fetch(base + '/api/weekly-competition?' + query)).status, 400);
    }
    assert.equal((await fetch(base + '/api/weekly-competition?roomId=1&roundId=stale')).status, 404);
});

test('locked room reveals its guesses; unlocked room keeps opponents hidden', async () => {
    const get = async token => (await fetch(base + '/api/guesses?token=' + token)).json();
    const locked = await get('room_one');
    assert(locked.some(g => g.playerId === 2));
    assert(!locked.some(g => g.playerId === 4));
    await db.exec('UPDATE rooms SET is_locked=false WHERE id=1');
    assert.deepEqual(await get('room_one'), []);
    const own = await get('inv_ada');
    assert(own.length > 0);
    assert(own.every(g => g.playerId === 1));
    await db.exec('UPDATE rooms SET is_locked=true WHERE id=1');
});

function overviewHarness(matches, guesses, fetchImpl = fetch) {
    const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
    const { document } = parseHTML(html);
    // linkedom does not implement the browser select.value setter.
    const selectPrototype = Object.getPrototypeOf(document.createElement('select'));
    Object.defineProperty(selectPrototype, 'value', {
        configurable: true,
        get() { return this._value ?? this.querySelector('option')?.value ?? ''; },
        set(value) { this._value = value; }
    });
    const context = vm.createContext({ document, EuropeanRounds: { buildRounds }, API_BASE:base,
        currentRoom:{id:1,isLocked:true}, allMatches:matches, allGuesses:guesses,
        allLeaderboard:[{name:'Ada'},{name:'Bora'},{name:'No guesses'}], fetch:fetchImpl });
    for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
    vm.runInContext(html.slice(html.indexOf('function roundLabel('), html.indexOf('function showView(')), context);
    return { document, context, select:document.getElementById('weeklyRoundSelect'),
        refresh:()=>vm.runInContext('renderWeeklyOverview()', context) };
}

test('one shared selector updates predictions and ranking with matching rounds and status colors', async () => {
    const matches = (await (await fetch(base + '/api/matches')).json());
    for (const match of matches) assert.equal(match.matchDate, fixtures.find(m => m.id === match.id).matchDate);
    const guesses = await (await fetch(base + '/api/guesses?token=room_one')).json();
    const { document, context, select, refresh } = overviewHarness(matches, guesses);
    await refresh();
    assert.equal(document.querySelectorAll('#weeklyRoundControl select').length,1);
    assert.equal(document.querySelectorAll('#weeklyPredictions select, #weeklyCompetition select').length,0);
    assert.equal(select.getAttribute('aria-controls'),'weeklyPredictions weeklyCompetition');
    const options = s => [...s.querySelectorAll('option')].map(o => [o.value,o.textContent]);
    assert.equal(options(select).length, 9);
    assert(options(select).some(([id,label]) => id === rounds[3].id && /3 Kas.*12 Kas/.test(label)));
    select.value = rounds[3].id;
    await select.onchange();
    assert.equal(document.querySelectorAll('.weekly-matrix tbody tr').length, 4);
    assert.equal(document.querySelectorAll('.weekly-guess.weekly-correct').length, 3);
    assert(document.querySelector('.weekly-guess.weekly-missing'));
    assert(document.getElementById('weeklyCompetitionContent').textContent.includes('2 doğru tahmin'));
    context.allGuesses.push({ playerName:'Bora', matchId:'bjk_4', points:0 });
    context.allMatches.find(m => m.id === 'ts_3').played = false;
    await select.onchange();
    assert(document.querySelector('.weekly-guess.weekly-incorrect'));
    assert(document.querySelector('.weekly-guess.weekly-pending'));
    // Preserve selected round on data refresh, then hide and clear on unlock.
    await refresh();
    assert.equal(select.value, rounds[3].id);
    context.currentRoom.isLocked = false;
    await refresh();
    assert(document.getElementById('weeklyPredictions').classList.contains('hidden'));
    assert.equal(document.getElementById('weeklyPredictionsContent').textContent, '');
    assert.equal(select.disabled,false); // ranking can still use the selector
});

test('rapid round changes ignore stale ranking responses, errors and earlier requests for the same round', async () => {
    const pending=[];
    const fakeFetch=url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}));
    const { document, select, refresh } = overviewHarness(fixtures, [], fakeFetch);
    const initial=refresh();
    select.value=rounds[3].id;
    const older=select.onchange();
    assert.equal(document.querySelectorAll('.weekly-matrix tbody tr').length,4);
    select.value=rounds[0].id;
    const middle=select.onchange();
    assert.equal(document.querySelectorAll('.weekly-matrix tbody tr').length,3);
    select.value=rounds[3].id;
    const latest=select.onchange();
    const box=document.getElementById('weeklyCompetitionContent');
    assert.equal(box.textContent,'Yükleniyor…');
    assert.equal(box.getAttribute('aria-busy'),'true');
    assert.equal(new URL(pending.at(-1).url).searchParams.get('roundId'),rounds[3].id);
    pending[3].resolve({ok:true,json:async()=>({complete:true,standings:[{rank:1,name:'Latest',points:3,correctCount:1}]})});
    await latest;
    assert(box.textContent.includes('Latest'));
    assert.equal(box.getAttribute('aria-busy'),'false');
    pending[1].resolve({ok:true,json:async()=>({complete:false,remaining:4})});
    pending[2].reject(new Error('stale error'));
    pending[0].resolve({ok:true,json:async()=>({complete:false,remaining:9})});
    await Promise.all([initial,older,middle]);
    assert(box.textContent.includes('Latest'));
    assert.equal(document.querySelectorAll('.weekly-matrix tbody tr').length,4);
});

test('shared selection falls back after schedule removal, clears empty rounds and ignores old-room responses', async () => {
    const pending=[];
    const { document, context, select, refresh } = overviewHarness(fixtures, [], url=>new Promise(resolve=>pending.push({url,resolve})));
    const oldRoom=refresh();
    context.currentRoom={id:2,isLocked:false};
    const newRoom=refresh();
    assert.equal(new URL(pending[1].url).searchParams.get('roomId'),'2');
    pending[1].resolve({ok:true,json:async()=>({complete:false,remaining:3})});
    await newRoom;
    pending[0].resolve({ok:true,json:async()=>({complete:true,standings:[{rank:1,name:'Wrong room',points:3,correctCount:1}]})});
    await oldRoom;
    assert(!document.getElementById('weeklyCompetitionContent').textContent.includes('Wrong room'));
    select.value=rounds[3].id;
    context.allMatches=fixtures.filter(m=>!rounds[3].matchIds.includes(m.id));
    const fallback=refresh();
    assert.notEqual(select.value,rounds[3].id);
    pending[2].resolve({ok:true,json:async()=>({complete:false,remaining:3})});
    await fallback;
    context.allMatches=[];
    await refresh();
    assert.equal(select.disabled,true);
    assert(document.getElementById('weeklyRoundControl').classList.contains('hidden'));
    assert.equal(document.getElementById('weeklyCompetitionContent').textContent,'Henüz maç turu yok.');
    assert.equal(document.getElementById('weeklyPredictionsContent').textContent,'');
});

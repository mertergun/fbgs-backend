const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { SEED_MATCHES, pool } = require('../db');
const { buildRounds } = require('../public/rounds');
const { planCorrections, updateLeagueContext, parseArgs } = require('../scripts/update-league-context');
const { corrections } = require('../fixtures/context-corrections-2026-10-29.json');
const evidence = require('../fixtures/super-lig-2026-27.json');
let db;
let temp;

before(async () => {
    db = new PGlite();
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'league-context-'));
    await db.exec(`CREATE TABLE matches (
        id varchar(50) PRIMARY KEY, team text, tournament text, opponent text,
        home_or_away text, match_date date, prev_league_context text, next_league_context text,
        opponent_context text, played boolean, result_score text, result_points integer);
        CREATE TABLE guesses (player_id integer, match_id text, points integer);
        CREATE TABLE players (id integer, name text);
        CREATE TABLE rooms (id integer, is_locked boolean);
        INSERT INTO players VALUES (1,'Existing player');
        INSERT INTO rooms VALUES (1,true);
        INSERT INTO guesses VALUES (1,'gs_3',0);`);
    for (const c of corrections) {
        const m = { id:c.id, ...c.expectedIdentity, ...c.before, played:true, result_score:'0-1', result_points:0 };
        const keys = Object.keys(m);
        await db.query(`INSERT INTO matches (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`, Object.values(m));
    }
});
after(async () => {
    await pool.end();
    await db.close();
    // Only remove the exact temporary directory created above.
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert(path.basename(temp).startsWith('league-context-'));
    await fs.rm(temp, { recursive:true, force:true });
});

const readRows = async () => (await db.query('SELECT *, match_date::text AS match_date FROM matches ORDER BY id')).rows;
async function resetContexts() {
    for (const c of corrections) await db.query('UPDATE matches SET prev_league_context=$1,next_league_context=$2 WHERE id=$3',
        [c.before.prev_league_context,c.before.next_league_context,c.id]);
}

test('every seed context has closest-date TFF evidence; all European identity fields and rounds are preserved', () => {
    assert.equal(SEED_MATCHES.length, 30);
    assert.equal(evidence.timeZone, 'Europe/Istanbul');
    for (const c of corrections) {
        const m = SEED_MATCHES.find(m => m.id === c.id);
        const {id,prev_league_context,next_league_context,...identity} = m;
        assert.deepEqual(identity, c.expectedIdentity);
        assert.deepEqual({prev_league_context,next_league_context}, c.after);
        const games = evidence.fixtures.filter(f => f.home === m.team || f.away === m.team).sort((a,b)=>a.date.localeCompare(b.date));
        assert.equal(games.filter(f=>f.date<m.match_date).at(-1).id, c.evidence.previous);
        assert.equal(games.find(f=>f.date>m.match_date).id, c.evidence.next);
        for (const [key,field] of [['previous','prev_league_context'],['next','next_league_context']]) {
            const f = games.find(f => f.id === c.evidence[key]);
            assert.equal(new URL(f.source).hostname, 'www.tff.org');
            assert.equal(new URL(f.detail).searchParams.get('macId'), f.id);
            assert.equal(c.after[field].includes('geçici'), f.status === 'provisional');
            assert(c.after[field].includes(`Hafta ${f.week}:`));
        }
        for (let week=4;week<=19;week++) assert.equal(games.filter(f=>f.week===week).length,1);
    }
    const roundInput = matches => matches.map(m => ({...m,matchDate:m.match_date}));
    assert.deepEqual(buildRounds(roundInput(SEED_MATCHES)),
        buildRounds(roundInput(corrections.map(c=>({id:c.id,...c.expectedIdentity})))));
    assert.equal(SEED_MATCHES.find(m=>m.id==='fb_3').next_league_context, 'Hafta 9: Galatasaray (✈️ - 26 Eki)');
    assert.equal(SEED_MATCHES.find(m=>m.id==='ts_6').next_league_context, 'Hafta 16: Kocaelispor (🏠 - 21 Ara)');
});

test('dry-run reads baseline, reports 30 pending rows / 58 changed fields, and writes nothing', async () => {
    const before = await readRows();
    const result = await updateLeagueContext(db);
    assert.equal(result.mode,'dry-run');
    assert.equal(result.pendingRows,30);
    const changedFields = result.changes.reduce((n,c)=>n+Object.keys(c.after).filter(k=>c.after[k]!==c.before[k]).length,0);
    assert.equal(changedFields,58);
    assert.deepEqual(await readRows(),before);
    console.log('Isolated baseline dry-run:', JSON.stringify({expectedRows:result.expectedRows,pendingRows:result.pendingRows,alreadyCorrectRows:result.alreadyCorrectRows,changedFields}));
});

test('missing, unexpected context and European identity drift are rejected before any writes', async () => {
    const rows = await readRows();
    assert.throws(()=>planCorrections(rows.slice(1)),/exactly 30/);
    const drift = structuredClone(rows); drift[0].next_league_context='Manually corrected';
    assert.throws(()=>planCorrections(drift),/Unreviewed value/);
    const identity = structuredClone(rows); identity[0].match_date='2026-01-01';
    assert.throws(()=>planCorrections(identity),/identity changed/);
    const mixed = structuredClone(rows);
    const first = corrections.find(c=>c.id==='bjk_2');
    mixed.find(row=>row.id===first.id).prev_league_context=first.after.prev_league_context;
    assert.equal(planCorrections(mixed).length,30);
});

test('apply requires a backup; export failures prevent any changes', async () => {
    const before = await readRows();
    await assert.rejects(updateLeagueContext(db,{apply:true}),/requires --backup/);
    await assert.rejects(updateLeagueContext(db,{apply:true,backupPath:'unused',writeBackup:async()=>{throw new Error('disk full');}}),/disk full/);
    assert.deepEqual(await readRows(),before);
});

test('late update failure rolls back earlier updates and retains the before-image backup', async () => {
    const before = await readRows();
    let updates=0;
    const client={query:async(sql,params)=>{
        if(sql.startsWith('UPDATE matches SET prev_league_context') && ++updates===2) return {rows:[]};
        return db.query(sql,params);
    }};
    const backupPath=path.join(temp,'rollback.json');
    await assert.rejects(updateLeagueContext(client,{apply:true,backupPath}),/Expected one updated row/);
    assert.deepEqual(await readRows(),before);
    const backup=JSON.parse(await fs.readFile(backupPath,'utf8'));
    assert.deepEqual(backup.rows, before);
});

test('successful apply changes only contexts; rerun is a no-op and preserves guesses/results/rooms', async () => {
    const before = await readRows();
    const snapshots=await Promise.all(['guesses','players','rooms'].map(table=>db.query('SELECT * FROM '+table)));
    const backupPath=path.join(temp,'success.json');
    const result=await updateLeagueContext(db,{apply:true,backupPath});
    assert.equal(result.pendingRows,30);
    const after=await readRows();
    assert.deepEqual(after.map(row=>({...row,...corrections.find(c=>c.id===row.id).before})),before);
    for(let i=0;i<3;i++) assert.deepEqual((await db.query('SELECT * FROM '+['guesses','players','rooms'][i])).rows,snapshots[i].rows);
    assert.equal((await updateLeagueContext(db)).pendingRows,0);
    assert.equal((await updateLeagueContext(db,{apply:true,backupPath})).pendingRows,0);
    assert.deepEqual(JSON.parse(await fs.readFile(backupPath,'utf8')).rows,before);
    await resetContexts();
    // With real pending changes, existing exports are never overwritten.
    await assert.rejects(updateLeagueContext(db,{apply:true,backupPath}),/EEXIST/);
    assert.deepEqual(await readRows(),before);
});

test('post-update guard rolls back unexpected changes to protected result fields', async () => {
    const before = await readRows();
    const client={query:async(sql,params)=>{
        const result=await db.query(sql,params);
        if(sql.startsWith('UPDATE matches SET prev_league_context')) {
            await db.query('UPDATE matches SET result_points=3 WHERE id=$1',[params[2]]);
        }
        return result;
    }};
    await assert.rejects(updateLeagueContext(client,{apply:true,backupPath:path.join(temp,'protected.json')}),/protected fixture value changed/);
    assert.deepEqual(await readRows(),before);
});

test('CLI defaults to dry-run and refuses ambiguous or unsafe application arguments', () => {
    assert.deepEqual(parseArgs([]),{apply:false});
    assert.deepEqual(parseArgs(['--dry-run']),{apply:false});
    assert.deepEqual(parseArgs(['--apply','--backup','backups/new.json']),{apply:true,backupPath:'backups/new.json'});
    for(const args of [['--apply'],['--apply','--dry-run'],['--backup'],['--force']]) assert.throws(()=>parseArgs(args));
});

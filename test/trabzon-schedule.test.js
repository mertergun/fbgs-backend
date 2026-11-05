const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { pool, initialize, SEED_MATCHES } = require('../db');
const domestic = require('../fixtures/super-lig-2026-27.json').fixtures;
const historical = require('../fixtures/context-corrections-2026-10-29.json').corrections;
const expected = [
    ['ts_1','KuPS Kuopio','2026-10-15'], ['ts_2','Hearts','2026-10-22'],
    ['ts_6','Freiburg','2026-11-05'], ['ts_5','CSKA Sofia','2026-11-26'],
    ['ts_3','Jablonec','2026-12-10'], ['ts_4','Red Star Belgrade','2026-12-17']
];

test('Trabzon schedule preserves opponent IDs and has league context surrounding corrected dates', () => {
    const games = domestic.filter(f=>f.home==='Trabzonspor'||f.away==='Trabzonspor').sort((a,b)=>a.date.localeCompare(b.date));
    for (const [id,opponent,date] of expected) {
        const m=SEED_MATCHES.find(m=>m.id===id);
        assert.equal(m.opponent,opponent);
        assert.equal(m.match_date,date);
        const prev=games.filter(f=>f.date<date).at(-1), next=games.find(f=>f.date>date);
        assert(m.prev_league_context.startsWith(`Hafta ${prev.week}:`));
        assert(m.next_league_context.startsWith(`Hafta ${next.week}:`));
    }
});

test('startup corrects existing dates without reassigning guesses, awards or results; rerun is safe', async () => {
    const db=new PGlite();
    const original=pool.query;
    pool.query=(sql,params)=>db.query(sql,params);
    try {
        await initialize();
        await db.exec("INSERT INTO players (name,invite_token) VALUES ('Fixture test','inv_test')");
        for (const [id] of expected) {
            const old=historical.find(c=>c.id===id);
            await db.query('UPDATE matches SET match_date=$2,prev_league_context=$3,next_league_context=$4,played=true,result_score=$5,result_points=3 WHERE id=$1',
                [id,old.expectedIdentity.match_date,old.after.prev_league_context,old.after.next_league_context,'2-0']);
            await db.query("INSERT INTO guesses (player_id,match_id,points,bonus_points,bonus_reason) VALUES (1,$1,3,7,'Saved award')",[id]);
        }
        const guesses=(await db.query('SELECT * FROM guesses ORDER BY id')).rows;
        const results=(await db.query('SELECT id,opponent,home_or_away,played,result_score,result_points FROM matches ORDER BY id')).rows;
        await initialize();
        await initialize();
        assert.deepEqual((await db.query('SELECT * FROM guesses ORDER BY id')).rows,guesses);
        assert.deepEqual((await db.query('SELECT id,opponent,home_or_away,played,result_score,result_points FROM matches ORDER BY id')).rows,results);
        for (const [id,opponent,date] of expected) {
            const row=(await db.query('SELECT *,match_date::text AS date FROM matches WHERE id=$1',[id])).rows[0];
            assert.equal(row.date,date);
            assert.equal(row.opponent,opponent);
            const seed=SEED_MATCHES.find(m=>m.id===id);
            assert.equal(row.prev_league_context,seed.prev_league_context);
            assert.equal(row.next_league_context,seed.next_league_context);
        }
    } finally { pool.query=original; await db.close(); await pool.end(); }
});

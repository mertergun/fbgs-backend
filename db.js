require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Load fixture rows (incl. AI-generated opponent intros) from CSV at startup.
// This is the source of truth for prev/next league context + opponent_context.
function loadFixtureRows() {
  const csvPath = path.join(__dirname, 'data', 'fixture_26_27.csv');
  const raw = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  const header = lines.shift().split(',');
  return lines.map(line => {
    // Quote-aware CSV split (the opponent_context_tr field is wrapped in double quotes
    // and can contain commas, so we can't just split on ',').
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    const row = {};
    header.forEach((h, i) => { row[h] = out[i]; });
    return row;
  });
}

// 2026/2027 European campaigns: GS & FB (UCL), BJK (UEL), TS (UECL)
// Source: data/fixture_26_27.csv — keep CSV in sync with this expectation.
const SEED_MATCHES = loadFixtureRows().map(r => ({
  id: r.id,
  team: r.team,
  tournament: r.tournament,
  opponent: r.opponent,
  home_or_away: r.home_or_away,
  match_date: r.match_date,
  prev_league_context: r.prev_league_context,
  next_league_context: r.next_league_context,
  opponent_context: r.opponent_context_tr
}));

async function initialize() {
  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      invite_token TEXT UNIQUE NOT NULL,
      edit_until TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id VARCHAR(50) PRIMARY KEY,
      team TEXT NOT NULL,
      tournament TEXT NOT NULL,
      opponent TEXT NOT NULL,
      home_or_away TEXT NOT NULL,
      match_date DATE,
      prev_league_context TEXT,
      next_league_context TEXT,
      played BOOLEAN DEFAULT false,
      result_score VARCHAR(10),
      result_points INTEGER CHECK(result_points IN (0, 1, 3))
    )
  `);

  // AI-generated opponent intro (nullable for backward compat with rows that pre-date it).
  await pool.query(
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_context TEXT`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guesses (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      match_id VARCHAR(50) NOT NULL REFERENCES matches(id),
      points INTEGER NOT NULL CHECK(points IN (0, 1, 3)),
      guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, match_id)
    )
  `);

  // ===== Private Rooms (multi-league) =====
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      invite_token VARCHAR(50) UNIQUE NOT NULL,
      is_locked BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure is_locked exists on rooms (no-op if already added)
  await pool.query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_players (
      room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, player_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_guesses_player ON guesses(player_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_guesses_match ON guesses(match_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_token ON players(invite_token)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_room_players_player ON room_players(player_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id)`);

  // Seed a default room + assign existing players to it (one-time migration)
  const roomCount = await pool.query('SELECT COUNT(*) FROM rooms');
  if (parseInt(roomCount.rows[0].count) === 0) {
    const defaultRoom = await pool.query(
      `INSERT INTO rooms (name, invite_token) VALUES ($1, $2) RETURNING id`,
      ['Genel Oda', 'room_' + crypto.randomBytes(8).toString('hex')]
    );
    const roomId = defaultRoom.rows[0].id;
    await pool.query(
      `INSERT INTO room_players (room_id, player_id)
       SELECT $1, id FROM players ON CONFLICT DO NOTHING`,
      [roomId]
    );
    const token = (await pool.query('SELECT invite_token FROM rooms WHERE id = $1', [roomId])).rows[0].invite_token;
    console.log('Created default room (Genel Oda) — invite token:', token);
  }

  // Always upsert from the CSV fixture file.  ON CONFLICT preserves played / result_score /
  // result_points so existing guesses are never disturbed.
  for (const m of SEED_MATCHES) {
    await pool.query(
      `INSERT INTO matches (id, team, tournament, opponent, home_or_away, match_date,
                           prev_league_context, next_league_context, opponent_context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         team                = EXCLUDED.team,
         tournament          = EXCLUDED.tournament,
         opponent            = EXCLUDED.opponent,
         home_or_away        = EXCLUDED.home_or_away,
         match_date          = EXCLUDED.match_date,
         prev_league_context = EXCLUDED.prev_league_context,
         next_league_context = EXCLUDED.next_league_context,
         opponent_context    = EXCLUDED.opponent_context`,
      [m.id, m.team, m.tournament, m.opponent, m.home_or_away, m.match_date,
       m.prev_league_context, m.next_league_context, m.opponent_context]
    );
  }
  console.log('Synced', SEED_MATCHES.length, 'matches from data/fixture_26_27.csv');
}

module.exports = { pool, initialize, SEED_MATCHES };
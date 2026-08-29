require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 2026/2027 European campaigns: GS & FB (UCL), BJK (UEL), TS (UECL)
const SEED_MATCHES = [
  // ==========================================
  // GALATASARAY (UEFA Champions League - 8 Matches)
  // ==========================================
  { id: "gs_1", team: "Galatasaray", tournament: "UCL", opponent: "Sporting CP",        home_or_away: "Away", match_date: "2026-09-09", prev_league_context: "Hafta 3: Adana Demirspor (🏠 - 30 Ağu)",  next_league_context: "Hafta 4: Başakşehir (✈️ - 13 Eyl)" },
  { id: "gs_2", team: "Galatasaray", tournament: "UCL", opponent: "Barcelona",          home_or_away: "Home", match_date: "2026-10-13", prev_league_context: "Hafta 7: Kasımpaşa (🏠 - 4 Eki)",       next_league_context: "Hafta 8: Gençlerbirliği (✈️ - 17 Eki)" },
  { id: "gs_3", team: "Galatasaray", tournament: "UCL", opponent: "Lille",               home_or_away: "Away", match_date: "2026-10-21", prev_league_context: "Hafta 8: Gençlerbirliği (✈️ - 17 Eki)",     next_league_context: "Hafta 9: Fenerbahçe (🏠 - 24 Eki)" },
  { id: "gs_4", team: "Galatasaray", tournament: "UCL", opponent: "Stuttgart",           home_or_away: "Home", match_date: "2026-11-03", prev_league_context: "Hafta 10: Konyaspor (✈️ - 31 Eki)",      next_league_context: "Hafta 11: Amed SK (🏠 - 7 Kas)" },
  { id: "gs_5", team: "Galatasaray", tournament: "UCL", opponent: "Aston Villa",        home_or_away: "Home", match_date: "2026-11-24", prev_league_context: "Hafta 12: Samsunspor (🏠 - 21 Kas)",     next_league_context: "Hafta 13: Beşiktaş (✈️ - 28 Kas)" },
  { id: "gs_6", team: "Galatasaray", tournament: "UCL", opponent: "AEK Athens",         home_or_away: "Away", match_date: "2026-12-08", prev_league_context: "Hafta 14: Çaykur Rizespor (🏠 - 5 Ara)",   next_league_context: "Hafta 15: Eyüpspor (✈️ - 12 Ara)" },
  { id: "gs_7", team: "Galatasaray", tournament: "UCL", opponent: "Feyenoord",          home_or_away: "Home", match_date: "2027-01-19", prev_league_context: "Hafta 17: Gaziantep FK (✈️ - 16 Oca)",    next_league_context: "Hafta 18: Çorum FK (✈️ - 23 Oca)" },
  { id: "gs_8", team: "Galatasaray", tournament: "UCL", opponent: "Paris Saint-Germain", home_or_away: "Away", match_date: "2027-01-27", prev_league_context: "Hafta 18: Çorum FK (✈️ - 23 Oca)",      next_league_context: "Hafta 19: Hatayspor (🏠 - 31 Oca)" },

  // ==========================================
  // FENERBAHÇE (UEFA Champions League - 8 Matches)
  // ==========================================
  { id: "fb_1", team: "Fenerbahçe", tournament: "UCL", opponent: "Roma",               home_or_away: "Home", match_date: "2026-09-10", prev_league_context: "Hafta 3: Sivasspor (✈️ - 31 Ağu)",       next_league_context: "Hafta 4: Beşiktaş (🏠 - 13 Eyl)" },
  { id: "fb_2", team: "Fenerbahçe", tournament: "UCL", opponent: "Aston Villa",        home_or_away: "Away", match_date: "2026-10-14", prev_league_context: "Hafta 7: Çaykur Rizespor (✈️ - 3 Eki)",    next_league_context: "Hafta 8: Alanyaspor (🏠 - 17 Eki)" },
  { id: "fb_3", team: "Fenerbahçe", tournament: "UCL", opponent: "Slavia Prague",      home_or_away: "Home", match_date: "2026-10-20", prev_league_context: "Hafta 8: Alanyaspor (🏠 - 17 Eki)",       next_league_context: "Hafta 9: Galatasaray (✈️ - 24 Eki)" },
  { id: "fb_4", team: "Fenerbahçe", tournament: "UCL", opponent: "Liverpool",          home_or_away: "Home", match_date: "2026-11-04", prev_league_context: "Hafta 10: Göztepe (🏠 - 31 Eki)",        next_league_context: "Hafta 11: Çorum FK (✈️ - 8 Kas)" },
  { id: "fb_5", team: "Fenerbahçe", tournament: "UCL", opponent: "Shakhtar Donetsk",   home_or_away: "Away", match_date: "2026-11-25", prev_league_context: "Hafta 12: Kocaelispor (✈️ - 22 Kas)",     next_league_context: "Hafta 13: Erzurumspor (🏠 - 29 Kas)" },
  { id: "fb_6", team: "Fenerbahçe", tournament: "UCL", opponent: "LASK",               home_or_away: "Away", match_date: "2026-12-09", prev_league_context: "Hafta 14: Başakşehir (✈️ - 6 Ara)",        next_league_context: "Hafta 15: Trabzonspor (🏠 - 13 Ara)" },
  { id: "fb_7", team: "Fenerbahçe", tournament: "UCL", opponent: "Villarreal",         home_or_away: "Home", match_date: "2027-01-20", prev_league_context: "Hafta 17: Amed SK (🏠 - 17 Oca)",        next_league_context: "Hafta 18: Gençlerbirliği (🏠 - 24 Oca)" },
  { id: "fb_8", team: "Fenerbahçe", tournament: "UCL", opponent: "Atletico Madrid",    home_or_away: "Away", match_date: "2027-01-27", prev_league_context: "Hafta 18: Gençlerbirliği (🏠 - 24 Oca)",    next_league_context: "Hafta 19: Konyaspor (✈️ - 31 Oca)" },

  // ==========================================
  // BEŞİKTAŞ (UEFA Europa League - 8 Matches)
  // ==========================================
  { id: "bjk_1", team: "Beşiktaş",  tournament: "UEL", opponent: "Olympique Marseille",     home_or_away: "Home", match_date: "2026-09-17", prev_league_context: "Hafta 4: Fenerbahçe (✈️ - 13 Eyl)",      next_league_context: "Hafta 5: Antalyaspor (🏠 - 20 Eyl)" },
  { id: "bjk_2", team: "Beşiktaş",  tournament: "UEL", opponent: "Hoffenheim",             home_or_away: "Away", match_date: "2026-10-15", prev_league_context: "Hafta 7: Göztepe (🏠 - 4 Eki)",           next_league_context: "Hafta 8: Samsunspor (✈️ - 18 Eki)" },
  { id: "bjk_3", team: "Beşiktaş",  tournament: "UEL", opponent: "Crystal Palace",        home_or_away: "Home", match_date: "2026-10-22", prev_league_context: "Hafta 8: Samsunspor (✈️ - 18 Eki)",      next_league_context: "Hafta 9: Çaykur Rizespor (🏠 - 25 Eki)" },
  { id: "bjk_4", team: "Beşiktaş",  tournament: "UEL", opponent: "Celtic",                home_or_away: "Away", match_date: "2026-11-05", prev_league_context: "Hafta 10: Kasımpaşa (✈️ - 1 Kas)",       next_league_context: "Hafta 11: Başakşehir (🏠 - 8 Kas)" },
  { id: "bjk_5", team: "Beşiktaş",  tournament: "UEL", opponent: "Hapoel Be'er Sheva",    home_or_away: "Home", match_date: "2026-11-26", prev_league_context: "Hafta 12: Eyüpspor (✈️ - 22 Kas)",      next_league_context: "Hafta 13: Galatasaray (🏠 - 28 Kas)" },
  { id: "bjk_6", team: "Beşiktaş",  tournament: "UEL", opponent: "Bayer Leverkusen",     home_or_away: "Away", match_date: "2026-12-10", prev_league_context: "Hafta 14: Gaziantep FK (🏠 - 6 Ara)",      next_league_context: "Hafta 15: Sivasspor (✈️ - 14 Ara)" },
  { id: "bjk_7", team: "Beşiktaş",  tournament: "UEL", opponent: "Union Saint-Gilloise",  home_or_away: "Home", match_date: "2027-01-21", prev_league_context: "Hafta 17: Trabzonspor (🏠 - 16 Oca)",      next_league_context: "Hafta 18: Konyaspor (✈️ - 23 Oca)" },
  { id: "bjk_8", team: "Beşiktaş",  tournament: "UEL", opponent: "Omonia",                home_or_away: "Away", match_date: "2027-01-28", prev_league_context: "Hafta 18: Konyaspor (✈️ - 23 Oca)",       next_league_context: "Hafta 19: Alanyaspor (🏠 - 30 Oca)" },

  // ==========================================
  // TRABZONSPOR (UEFA Conference League - 6 Matches)
  // ==========================================
  { id: "ts_1", team: "Trabzonspor", tournament: "UECL", opponent: "KuPS Kuopio",    home_or_away: "Away", match_date: "2026-10-15", prev_league_context: "Hafta 7: Konyaspor (🏠 - 4 Eki)",       next_league_context: "Hafta 8: Hatayspor (✈️ - 18 Eki)" },
  { id: "ts_2", team: "Trabzonspor", tournament: "UECL", opponent: "Hearts",         home_or_away: "Home", match_date: "2026-10-22", prev_league_context: "Hafta 8: Hatayspor (✈️ - 18 Eki)",      next_league_context: "Hafta 9: Başakşehir (🏠 - 25 Eki)" },
  { id: "ts_3", team: "Trabzonspor", tournament: "UECL", opponent: "Jablonec",       home_or_away: "Home", match_date: "2026-11-12", prev_league_context: "Hafta 11: Adana Demirspor (🏠 - 8 Kas)",    next_league_context: "Hafta 12: Alanyaspor (✈️ - 22 Kas)" },
  { id: "ts_4", team: "Trabzonspor", tournament: "UECL", opponent: "Red Star Belgrade", home_or_away: "Away", match_date: "2026-11-26", prev_league_context: "Hafta 12: Alanyaspor (✈️ - 22 Kas)",    next_league_context: "Hafta 13: Kasımpaşa (🏠 - 29 Kas)" },
  { id: "ts_5", team: "Trabzonspor", tournament: "UECL", opponent: "CSKA Sofia",     home_or_away: "Away", match_date: "2026-12-10", prev_league_context: "Hafta 14: Galatasaray (🏠 - 6 Ara)",     next_league_context: "Hafta 15: Fenerbahçe (✈️ - 13 Ara)" },
  { id: "ts_6", team: "Trabzonspor", tournament: "UECL", opponent: "Freiburg",       home_or_away: "Home", match_date: "2026-12-17", prev_league_context: "Hafta 15: Fenerbahçe (✈️ - 13 Ara)",     next_league_context: "Hafta 16: Antalyaspor (🏠 - 20 Ara)" },
];

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
      is_locked BOOLEAN DEFAULT false,
      result_score VARCHAR(10),
      result_points INTEGER CHECK(result_points IN (0, 1, 3))
    )
  `);

  // Ensure is_locked exists on existing tables (no-op if already added)
  await pool.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false`);

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  // Seed matches if empty, otherwise sync metadata (date/opponent/home/away/context) without touching results
  const res = await pool.query('SELECT COUNT(*) FROM matches');
  if (parseInt(res.rows[0].count) === 0) {
    for (const m of SEED_MATCHES) {
      await pool.query(
        `INSERT INTO matches (id, team, tournament, opponent, home_or_away, match_date, prev_league_context, next_league_context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [m.id, m.team, m.tournament, m.opponent, m.home_or_away, m.match_date, m.prev_league_context, m.next_league_context]
      );
    }
    console.log('Seeded', SEED_MATCHES.length, 'matches for 2026/27 European campaigns');
  } else {
    // Sync metadata (date, opponent, home/away, context) from SEED_MATCHES without overwriting results
    for (const m of SEED_MATCHES) {
      await pool.query(
        `UPDATE matches
         SET team = $2, tournament = $3, opponent = $4, home_or_away = $5,
             match_date = $6, prev_league_context = $7, next_league_context = $8
         WHERE id = $1`,
        [m.id, m.team, m.tournament, m.opponent, m.home_or_away, m.match_date, m.prev_league_context, m.next_league_context]
      );
    }
    console.log('Matches table already populated (', res.rows[0].count, 'rows) — metadata synced from SEED_MATCHES');
  }
}

module.exports = { pool, initialize, SEED_MATCHES };
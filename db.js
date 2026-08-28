require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 2026/2027 European campaigns: GS & FB (UCL), BJK (UEL), TS (UECL)
const SEED_MATCHES = [
  // ==========================================
  // GALATASARAY (UEFA Champions League)
  // ==========================================
  { id: "gs_1", team: "Galatasaray", tournament: "UCL", opponent: "Barcelona",         home_or_away: "Home", match_date: "2026-09-15", prev_league_context: "Hafta 4: Gaziantep FK (D - 12 Eyl)",  next_league_context: "Hafta 5: Fenerbahçe (D - 20 Eyl)" },
  { id: "gs_2", team: "Galatasaray", tournament: "UCL", opponent: "Paris Saint-Germain", home_or_away: "Away", match_date: "2026-09-30", prev_league_context: "Hafta 6: Kasımpaşa (E - 27 Eyl)",    next_league_context: "Hafta 7: Alanyaspor (E - 4 Eki)" },
  { id: "gs_3", team: "Galatasaray", tournament: "UCL", opponent: "Aston Villa",       home_or_away: "Home", match_date: "2026-10-21", prev_league_context: "Hafta 8: Antalyaspor (D - 18 Eki)",   next_league_context: "Hafta 9: Beşiktaş (E - 25 Eki)" },
  { id: "gs_4", team: "Galatasaray", tournament: "UCL", opponent: "Sporting CP",        home_or_away: "Away", match_date: "2026-11-04", prev_league_context: "Hafta 10: Samsunspor (E - 1 Kas)",   next_league_context: "Hafta 11: Bodrum FK (D - 8 Kas)" },
  { id: "gs_5", team: "Galatasaray", tournament: "UCL", opponent: "Feyenoord",         home_or_away: "Home", match_date: "2026-11-25", prev_league_context: "Hafta 12: Eyüpspor (D - 21 Kas)",    next_league_context: "Hafta 13: Sivasspor (E - 29 Kas)" },
  { id: "gs_6", team: "Galatasaray", tournament: "UCL", opponent: "Lille",             home_or_away: "Away", match_date: "2026-12-09", prev_league_context: "Hafta 14: Trabzonspor (D - 6 Ara)",   next_league_context: "Hafta 15: Kayserispor (E - 13 Ara)" },
  { id: "gs_7", team: "Galatasaray", tournament: "UCL", opponent: "Stuttgart",         home_or_away: "Home", match_date: "2027-01-20", prev_league_context: "Hafta 19: Hatayspor (D - 16 Oca)",   next_league_context: "Hafta 20: Konyaspor (E - 24 Oca)" },
  { id: "gs_8", team: "Galatasaray", tournament: "UCL", opponent: "AEK Athens",        home_or_away: "Away", match_date: "2027-01-27", prev_league_context: "Hafta 20: Konyaspor (E - 24 Oca)",   next_league_context: "Hafta 21: Adana Demirspor (D - 31 Oca)" },

  // ==========================================
  // FENERBAHÇE (UEFA Champions League)
  // ==========================================
  { id: "fb_1", team: "Fenerbahçe", tournament: "UCL", opponent: "Liverpool",        home_or_away: "Home", match_date: "2026-09-16", prev_league_context: "Hafta 4: Kasımpaşa (D - 13 Eyl)",   next_league_context: "Hafta 5: Galatasaray (E - 20 Eyl)" },
  { id: "fb_2", team: "Fenerbahçe", tournament: "UCL", opponent: "Atletico Madrid",  home_or_away: "Away", match_date: "2026-09-29", prev_league_context: "Hafta 6: Antalyaspor (D - 26 Eyl)",  next_league_context: "Hafta 7: Samsunspor (D - 4 Eki)" },
  { id: "fb_3", team: "Fenerbahçe", tournament: "UCL", opponent: "Roma",              home_or_away: "Home", match_date: "2026-10-20", prev_league_context: "Hafta 8: Bodrum FK (E - 17 Eki)",    next_league_context: "Hafta 9: Trabzonspor (D - 24 Eki)" },
  { id: "fb_4", team: "Fenerbahçe", tournament: "UCL", opponent: "Aston Villa",       home_or_away: "Away", match_date: "2026-11-03", prev_league_context: "Hafta 10: Eyüpspor (D - 1 Kas)",     next_league_context: "Hafta 11: Sivasspor (E - 8 Kas)" },
  { id: "fb_5", team: "Fenerbahçe", tournament: "UCL", opponent: "Villarreal",        home_or_away: "Home", match_date: "2026-11-24", prev_league_context: "Hafta 12: Kayserispor (D - 22 Kas)",  next_league_context: "Hafta 13: Gaziantep FK (E - 28 Kas)" },
  { id: "fb_6", team: "Fenerbahçe", tournament: "UCL", opponent: "Shakhtar Donetsk",  home_or_away: "Away", match_date: "2026-12-10", prev_league_context: "Hafta 14: Beşiktaş (D - 6 Ara)",     next_league_context: "Hafta 15: Başakşehir (E - 14 Ara)" },
  { id: "fb_7", team: "Fenerbahçe", tournament: "UCL", opponent: "Slavia Prague",     home_or_away: "Home", match_date: "2027-01-21", prev_league_context: "Hafta 19: Rizespor (D - 17 Oca)",    next_league_context: "Hafta 20: Alanyaspor (E - 25 Oca)" },
  { id: "fb_8", team: "Fenerbahçe", tournament: "UCL", opponent: "LASK",              home_or_away: "Away", match_date: "2027-01-28", prev_league_context: "Hafta 20: Alanyaspor (E - 25 Oca)",  next_league_context: "Hafta 21: Konyaspor (D - 1 Şub)" },

  // ==========================================
  // BEŞİKTAŞ (UEFA Europa League)
  // ==========================================
  { id: "bjk_1", team: "Beşiktaş",  tournament: "UEL", opponent: "Ajax",               home_or_away: "Away", match_date: "2026-09-24", prev_league_context: "Hafta 5: Trabzonspor (D - 20 Eyl)",   next_league_context: "Hafta 6: Eyüpspor (E - 27 Eyl)" },
  { id: "bjk_2", team: "Beşiktaş",  tournament: "UEL", opponent: "Eintracht Frankfurt", home_or_away: "Home", match_date: "2026-10-01", prev_league_context: "Hafta 6: Eyüpspor (E - 27 Eyl)",     next_league_context: "Hafta 7: Gaziantep FK (D - 4 Eki)" },
  { id: "bjk_3", team: "Beşiktaş",  tournament: "UEL", opponent: "Lyon",               home_or_away: "Away", match_date: "2026-10-22", prev_league_context: "Hafta 8: Konyaspor (E - 18 Eki)",    next_league_context: "Hafta 9: Galatasaray (D - 25 Eki)" },
  { id: "bjk_4", team: "Beşiktaş",  tournament: "UEL", opponent: "Malmö",              home_or_away: "Home", match_date: "2026-11-05", prev_league_context: "Hafta 10: Kasımpaşa (E - 1 Kas)",   next_league_context: "Hafta 11: Başakşehir (D - 8 Kas)" },
  { id: "bjk_5", team: "Beşiktaş",  tournament: "UEL", opponent: "Maccabi Tel Aviv",    home_or_away: "Home", match_date: "2026-11-26", prev_league_context: "Hafta 12: Göztepe (E - 22 Kas)",    next_league_context: "Hafta 13: Hatayspor (D - 29 Kas)" },
  { id: "bjk_6", team: "Beşiktaş",  tournament: "UEL", opponent: "Bodo/Glimt",         home_or_away: "Away", match_date: "2026-12-10", prev_league_context: "Hafta 14: Fenerbahçe (E - 6 Ara)",   next_league_context: "Hafta 15: Adana Demirspor (D - 13 Ara)" },
  { id: "bjk_7", team: "Beşiktaş",  tournament: "UEL", opponent: "Athletic Club",       home_or_away: "Home", match_date: "2027-01-21", prev_league_context: "Hafta 19: Antalyaspor (E - 16 Oca)",  next_league_context: "Hafta 20: Samsunspor (D - 24 Oca)" },
  { id: "bjk_8", team: "Beşiktaş",  tournament: "UEL", opponent: "Twente",              home_or_away: "Away", match_date: "2027-01-28", prev_league_context: "Hafta 20: Samsunspor (D - 24 Oca)",  next_league_context: "Hafta 21: Sivasspor (E - 31 Oca)" },

  // ==========================================
  // TRABZONSPOR (UEFA Conference League - 6 matches)
  // ==========================================
  { id: "ts_1", team: "Trabzonspor", tournament: "UECL", opponent: "St. Gallen",    home_or_away: "Away", match_date: "2026-10-01", prev_league_context: "Hafta 6: Konyaspor (E - 28 Eyl)",    next_league_context: "Hafta 7: Hatayspor (D - 4 Eki)" },
  { id: "ts_2", team: "Trabzonspor", tournament: "UECL", opponent: "Heidenheim",    home_or_away: "Home", match_date: "2026-10-22", prev_league_context: "Hafta 8: Başakşehir (E - 18 Eki)",   next_league_context: "Hafta 9: Fenerbahçe (E - 24 Eki)" },
  { id: "ts_3", team: "Trabzonspor", tournament: "UECL", opponent: "Rapid Wien",    home_or_away: "Away", match_date: "2026-11-05", prev_league_context: "Hafta 10: Göztepe (D - 1 Kas)",     next_league_context: "Hafta 11: Rizespor (E - 8 Kas)" },
  { id: "ts_4", team: "Trabzonspor", tournament: "UECL", opponent: "Omonia",        home_or_away: "Home", match_date: "2026-11-26", prev_league_context: "Hafta 12: Adana Demirspor (E - 22 Kas)", next_league_context: "Hafta 13: Alanyaspor (D - 29 Kas)" },
  { id: "ts_5", team: "Trabzonspor", tournament: "UECL", opponent: "Legia Warsaw",  home_or_away: "Away", match_date: "2026-12-10", prev_league_context: "Hafta 14: Galatasaray (E - 6 Ara)",  next_league_context: "Hafta 15: Kasımpaşa (D - 13 Ara)" },
  { id: "ts_6", team: "Trabzonspor", tournament: "UECL", opponent: "Celje",         home_or_away: "Home", match_date: "2026-12-17", prev_league_context: "Hafta 15: Kasımpaşa (D - 13 Ara)",  next_league_context: "Hafta 16: Antalyaspor (E - 20 Ara)" },
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
      result_score VARCHAR(10),
      result_points INTEGER CHECK(result_points IN (0, 1, 3))
    )
  `);

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

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_guesses_player ON guesses(player_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_guesses_match ON guesses(match_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_token ON players(invite_token)`);

  // Seed matches if empty
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
    console.log('Matches table already populated (', res.rows[0].count, 'rows)');
  }
}

module.exports = { pool, initialize, SEED_MATCHES };

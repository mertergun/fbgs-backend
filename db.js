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
// These values were migrated from data/fixture_26_27.csv — keep both in sync.
const SEED_MATCHES = [
  // ==========================================
  // BEŞİKTAŞ (UEFA Europa League)
  // ==========================================
  { id: "bjk_1", team: "Beşiktaş",  tournament: "UEL", opponent: "Olympique Marseille",    home_or_away: "Home", match_date: "2026-09-17", prev_league_context: "Hafta 5: Erzurumspor FK (🏠 - 13 Eyl)",    next_league_context: "Hafta 6: Amed SK (✈️ - 20 Eyl)",     opponent_context: "Olympique Marseille, Fransa temsilcisi olarak Ligue 1 liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Pierre-Emerick Aubameyang (veya yeni yıldızı)." },
  { id: "bjk_2", team: "Beşiktaş",  tournament: "UEL", opponent: "Hoffenheim",            home_or_away: "Away", match_date: "2026-10-15", prev_league_context: "Hafta 8: Trabzonspor (✈️ - 4 Eki)",        next_league_context: "Hafta 9: İstanbul Başakşehir (🏠 - 18 Eki)", opponent_context: "Hoffenheim, Almanya temsilcisi olarak Bundesliga liginde mücadele ediyor. Geçen sezonu orta sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Andrej Kramarić." },
  { id: "bjk_3", team: "Beşiktaş",  tournament: "UEL", opponent: "Crystal Palace",        home_or_away: "Home", match_date: "2026-10-22", prev_league_context: "Hafta 9: İstanbul Başakşehir (🏠 - 18 Eki)", next_league_context: "Hafta 10: Samsunspor (🏠 - 25 Eki)",    opponent_context: "Crystal Palace, İngiltere temsilcisi olarak Premier League liginde mücadele ediyor. Geçen sezonu orta sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Eberechi Eze." },
  { id: "bjk_4", team: "Beşiktaş",  tournament: "UEL", opponent: "Celtic",                home_or_away: "Away", match_date: "2026-11-05", prev_league_context: "Hafta 11: Göztepe (✈️ - 1 Kas)",            next_league_context: "Hafta 12: Gaziantep FK (🏠 - 8 Kas)",   opponent_context: "Celtic, İskoçya temsilcisi olarak Scottish Premiership liginde mücadele ediyor. Geçen sezonu şampiyon olarak tamamlayan ekibin en dikkat çeken oyuncusu Kyogo Furuhashi." },
  { id: "bjk_5", team: "Beşiktaş",  tournament: "UEL", opponent: "Hapoel Be'er Sheva",    home_or_away: "Home", match_date: "2026-11-26", prev_league_context: "Hafta 13: Galatasaray (🏠 - 22 Kas)",      next_league_context: "Hafta 14: Kocaelispor (🏠 - 29 Kas)",   opponent_context: "Hapoel Be'er Sheva, İsrail temsilcisi olarak Ligat ha'Al liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Miguel Vítor." },
  { id: "bjk_6", team: "Beşiktaş",  tournament: "UEL", opponent: "Bayer Leverkusen",     home_or_away: "Away", match_date: "2026-12-10", prev_league_context: "Hafta 15: Alanyaspor (✈️ - 6 Ara)",         next_league_context: "Hafta 16: Çaykur Rizespor (🏠 - 13 Ara)", opponent_context: "Bayer Leverkusen, Almanya temsilcisi olarak Bundesliga liginde mücadele ediyor. Geçen sezonu şampiyon olarak tamamlayan ekibin en dikkat çeken oyuncusu Florian Wirtz." },
  { id: "bjk_7", team: "Beşiktaş",  tournament: "UEL", opponent: "Union Saint-Gilloise",  home_or_away: "Home", match_date: "2027-01-21", prev_league_context: "Hafta 17: Eyüpspor (✈️ - 17 Oca)",          next_league_context: "Hafta 18: Alanyaspor (✈️ - 24 Oca)",   opponent_context: "Union Saint-Gilloise, Belçika temsilcisi olarak Pro League liginde mücadele ediyor. Geçen sezonu zirve yarışında tamamlayan ekibin en dikkat çeken oyuncusu Cameron Puertas." },
  { id: "bjk_8", team: "Beşiktaş",  tournament: "UEL", opponent: "Omonia",                home_or_away: "Away", match_date: "2027-01-28", prev_league_context: "Hafta 18: Alanyaspor (✈️ - 24 Oca)",       next_league_context: "Hafta 19: Çorum FK (✈️ - 31 Oca)",     opponent_context: "Omonia, Kıbrıs temsilcisi olarak Cyprus First Division liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Willy Semedo." },

  // ==========================================
  // FENERBAHÇE (UEFA Champions League)
  // ==========================================
  { id: "fb_1",  team: "Fenerbahçe", tournament: "UCL", opponent: "Roma",               home_or_away: "Home", match_date: "2026-09-10", prev_league_context: "Hafta 4: Beşiktaş (🏠 - 6 Eyl)",        next_league_context: "Hafta 5: Gaziantep FK (✈️ - 13 Eyl)",      opponent_context: "Roma, İtalya temsilcisi olarak Serie A liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Paulo Dybala." },
  { id: "fb_2",  team: "Fenerbahçe", tournament: "UCL", opponent: "Aston Villa",        home_or_away: "Away", match_date: "2026-10-14", prev_league_context: "Hafta 8: Alanyaspor (🏠 - 4 Eki)",         next_league_context: "Hafta 9: Galatasaray (✈️ - 18 Eki)",      opponent_context: "Aston Villa, İngiltere temsilcisi olarak Premier League liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Ollie Watkins." },
  { id: "fb_3",  team: "Fenerbahçe", tournament: "UCL", opponent: "Slavia Prague",      home_or_away: "Home", match_date: "2026-10-20", prev_league_context: "Hafta 9: Galatasaray (✈️ - 18 Eki)",        next_league_context: "Hafta 10: Göztepe (🏠 - 25 Eki)",       opponent_context: "Slavia Prague, Çekya temsilcisi olarak Czech First League liginde mücadele ediyor. Geçen sezonu zirve yarışında tamamlayan ekibin en dikkat çeken oyuncusu Mojmír Chytil." },
  { id: "fb_4",  team: "Fenerbahçe", tournament: "UCL", opponent: "Liverpool",          home_or_away: "Home", match_date: "2026-11-04", prev_league_context: "Hafta 11: Çorum FK (✈️ - 1 Kas)",         next_league_context: "Hafta 12: Kocaelispor (✈️ - 8 Kas)",      opponent_context: "Liverpool, İngiltere temsilcisi olarak Premier League liginde mücadele ediyor. Geçen sezonu zirve yarışında tamamlayan ekibin en dikkat çeken oyuncusu Mohamed Salah." },
  { id: "fb_5",  team: "Fenerbahçe", tournament: "UCL", opponent: "Shakhtar Donetsk",   home_or_away: "Away", match_date: "2026-11-25", prev_league_context: "Hafta 13: Erzurumspor FK (🏠 - 22 Kas)",   next_league_context: "Hafta 14: İstanbul Başakşehir (✈️ - 29 Kas)", opponent_context: "Shakhtar Donetsk, Ukrayna temsilcisi olarak Ukrainian Premier League liginde mücadele ediyor. Geçen sezonu şampiyon olarak tamamlayan ekibin en dikkat çeken oyuncusu Georgiy Sudakov." },
  { id: "fb_6",  team: "Fenerbahçe", tournament: "UCL", opponent: "LASK",               home_or_away: "Away", match_date: "2026-12-09", prev_league_context: "Hafta 15: Trabzonspor (🏠 - 6 Ara)",       next_league_context: "Hafta 16: Kasımpaşa (✈️ - 13 Ara)",     opponent_context: "LASK, Avusturya temsilcisi olarak Austrian Bundesliga liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Robert Žulj." },
  { id: "fb_7",  team: "Fenerbahçe", tournament: "UCL", opponent: "Villarreal",         home_or_away: "Home", match_date: "2027-01-20", prev_league_context: "Hafta 17: Amed SK (🏠 - 17 Oca)",         next_league_context: "Hafta 18: Konyaspor (✈️ - 24 Oca)",     opponent_context: "Villarreal, İspanya temsilcisi olarak La Liga liginde mücadele ediyor. Geçen sezonu orta-üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Gerard Moreno." },
  { id: "fb_8",  team: "Fenerbahçe", tournament: "UCL", opponent: "Atletico Madrid",    home_or_away: "Away", match_date: "2027-01-27", prev_league_context: "Hafta 18: Konyaspor (✈️ - 24 Oca)",        next_league_context: "Hafta 19: Samsunspor (✈️ - 31 Oca)",    opponent_context: "Atletico Madrid, İspanya temsilcisi olarak La Liga liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Antoine Griezmann." },

  // ==========================================
  // GALATASARAY (UEFA Champions League)
  // ==========================================
  { id: "gs_1",  team: "Galatasaray", tournament: "UCL", opponent: "Sporting CP",          home_or_away: "Away", match_date: "2026-09-09", prev_league_context: "Hafta 4: İstanbul Başakşehir (✈️ - 6 Eyl)", next_league_context: "Hafta 5: Kocaelispor (🏠 - 13 Eyl)",      opponent_context: "Sporting CP, Portekiz temsilcisi olarak Primeira Liga liginde mücadele ediyor. Geçen sezonu şampiyon olarak tamamlayan ekibin en dikkat çeken oyuncusu Viktor Gyökeres." },
  { id: "gs_2",  team: "Galatasaray", tournament: "UCL", opponent: "Barcelona",            home_or_away: "Home", match_date: "2026-10-13", prev_league_context: "Hafta 8: Gençlerbirliği (✈️ - 4 Eki)",     next_league_context: "Hafta 9: Fenerbahçe (🏠 - 18 Eki)",       opponent_context: "Barcelona, İspanya temsilcisi olarak La Liga liginde mücadele ediyor. Geçen sezonu zirve yarışında tamamlayan ekibin en dikkat çeken oyuncusu Lamine Yamal." },
  { id: "gs_3",  team: "Galatasaray", tournament: "UCL", opponent: "Lille",               home_or_away: "Away", match_date: "2026-10-21", prev_league_context: "Hafta 9: Fenerbahçe (🏠 - 18 Eki)",        next_league_context: "Hafta 10: Konyaspor (✈️ - 25 Eki)",      opponent_context: "Lille, Fransa temsilcisi olarak Ligue 1 liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Jonathan David." },
  { id: "gs_4",  team: "Galatasaray", tournament: "UCL", opponent: "Stuttgart",           home_or_away: "Home", match_date: "2026-11-03", prev_league_context: "Hafta 11: Amed SK (🏠 - 1 Kas)",          next_league_context: "Hafta 12: Samsunspor (🏠 - 8 Kas)",       opponent_context: "Stuttgart, Almanya temsilcisi olarak Bundesliga liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Serhou Guirassy." },
  { id: "gs_5",  team: "Galatasaray", tournament: "UCL", opponent: "Aston Villa",         home_or_away: "Home", match_date: "2026-11-24", prev_league_context: "Hafta 13: Beşiktaş (✈️ - 22 Kas)",       next_league_context: "Hafta 14: Çaykur Rizespor (🏠 - 29 Kas)", opponent_context: "Aston Villa, İngiltere temsilcisi olarak Premier League liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Ollie Watkins." },
  { id: "gs_6",  team: "Galatasaray", tournament: "UCL", opponent: "AEK Athens",          home_or_away: "Away", match_date: "2026-12-08", prev_league_context: "Hafta 15: Eyüpspor (✈️ - 6 Ara)",          next_league_context: "Hafta 16: Gaziantep FK (🏠 - 13 Ara)",    opponent_context: "AEK Athens, Yunanistan temsilcisi olarak Super League liginde mücadele ediyor. Geçen sezonu zirve yarışında tamamlayan ekibin en dikkat çeken oyuncusu Levi García." },
  { id: "gs_7",  team: "Galatasaray", tournament: "UCL", opponent: "Feyenoord",          home_or_away: "Home", match_date: "2027-01-19", prev_league_context: "Hafta 17: Çorum FK (✈️ - 17 Oca)",         next_league_context: "Hafta 18: Erzurumspor FK (🏠 - 24 Oca)",   opponent_context: "Feyenoord, Hollanda temsilcisi olarak Eredivisie liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Santiago Giménez." },
  { id: "gs_8",  team: "Galatasaray", tournament: "UCL", opponent: "Paris Saint-Germain", home_or_away: "Away", match_date: "2027-01-27", prev_league_context: "Hafta 18: Erzurumspor FK (🏠 - 24 Oca)",   next_league_context: "Hafta 19: Göztepe (🏠 - 31 Oca)",         opponent_context: "Paris Saint-Germain, Fransa temsilcisi olarak Ligue 1 liginde mücadele ediyor. Geçen sezonu şampiyon olarak tamamlayan ekibin en dikkat çeken oyuncusu Kylian Mbappé (veya Warren Zaïre-Emery)." },

  // ==========================================
  // TRABZONSPOR (UEFA Conference League)
  // ==========================================
  { id: "ts_1",  team: "Trabzonspor", tournament: "UECL", opponent: "KuPS Kuopio",         home_or_away: "Away", match_date: "2026-10-15", prev_league_context: "Hafta 8: Beşiktaş (🏠 - 4 Eki)",          next_league_context: "Hafta 9: Eyüpspor (✈️ - 18 Eki)",         opponent_context: "KuPS Kuopio, Finlandiya temsilcisi olarak Veikkausliiga liginde mücadele ediyor. Geçen sezonu zirve yarışında tamamlayan ekibin en dikkat çeken oyuncusu Anton Popovitch." },
  { id: "ts_2",  team: "Trabzonspor", tournament: "UECL", opponent: "Hearts",             home_or_away: "Home", match_date: "2026-10-22", prev_league_context: "Hafta 9: Eyüpspor (✈️ - 18 Eki)",          next_league_context: "Hafta 10: Gaziantep FK (🏠 - 25 Eki)",     opponent_context: "Hearts, İskoçya temsilcisi olarak Scottish Premiership liginde mücadele ediyor. Geçen sezonu üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Lawrence Shankland." },
  { id: "ts_3",  team: "Trabzonspor", tournament: "UECL", opponent: "Jablonec",           home_or_away: "Home", match_date: "2026-11-12", prev_league_context: "Hafta 12: Eyüpspor (🏠 - 8 Kas)",          next_league_context: "Hafta 13: Göztepe (✈️ - 22 Kas)",        opponent_context: "Jablonec, Çekya temsilcisi olarak Czech First League liginde mücadele ediyor. Geçen sezonu orta sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Jan Chramosta." },
  { id: "ts_4",  team: "Trabzonspor", tournament: "UECL", opponent: "Red Star Belgrade",   home_or_away: "Away", match_date: "2026-11-26", prev_league_context: "Hafta 13: Göztepe (✈️ - 22 Kas)",          next_league_context: "Hafta 14: Samsunspor (🏠 - 29 Kas)",      opponent_context: "Red Star Belgrade, Sırbistan temsilcisi olarak Serbian SuperLiga liginde mücadele ediyor. Geçen sezonu şampiyon olarak tamamlayan ekibin en dikkat çeken oyuncusu Guelor Kanga." },
  { id: "ts_5",  team: "Trabzonspor", tournament: "UECL", opponent: "CSKA Sofia",         home_or_away: "Away", match_date: "2026-12-10", prev_league_context: "Hafta 15: Fenerbahçe (✈️ - 6 Ara)",         next_league_context: "Hafta 16: Kocaelispor (🏠 - 13 Ara)",    opponent_context: "CSKA Sofia, Bulgaristan temsilcisi olarak First League liginde mücadele ediyor. Geçen sezonu zirve yarışında tamamlayan ekibin en dikkat çeken oyuncusu Tobias Heintz." },
  { id: "ts_6",  team: "Trabzonspor", tournament: "UECL", opponent: "Freiburg",           home_or_away: "Home", match_date: "2026-12-17", prev_league_context: "Hafta 16: Kocaelispor (🏠 - 13 Ara)",       next_league_context: "Hafta 17: Kasımpaşa (🏠 - 17 Oca)",       opponent_context: "Freiburg, Almanya temsilcisi olarak Bundesliga liginde mücadele ediyor. Geçen sezonu orta-üst sıralarda tamamlayan ekibin en dikkat çeken oyuncusu Vincenzo Grifo." },
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
  console.log('Synced', SEED_MATCHES.length, 'matches (opponent_context from embedded seed data)');
}

module.exports = { pool, initialize, SEED_MATCHES };
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const { pool, initialize } = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin-secret';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DEFAULT_EDIT_UNTIL = process.env.DEFAULT_EDIT_UNTIL || '2026-09-16';

app.use(cors());
app.use(express.json());

// Store connected WebSocket clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket client connected. Total:', clients.size);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected. Total:', clients.size);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    clients.delete(ws);
  });
});

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

async function broadcastLeaderboard() {
  try {
    const leaderboard = await getLeaderboard();
    broadcast({ type: 'leaderboard_update', data: leaderboard });
  } catch (err) {
    console.error('Leaderboard broadcast error:', err.message);
  }
}

function broadcastMatchLocked(matchId, resultScore, resultPoints) {
  broadcast({ type: 'match_locked', matchId, result: resultScore, points: resultPoints });
}

function generateToken() {
  return 'inv_' + crypto.randomBytes(8).toString('hex');
}

function isTokenValid(player, now = new Date()) {
  if (!player || !player.is_active) return false;
  if (!player.edit_until) return true;
  return new Date(player.edit_until) > now;
}

// ============================================================
// PUBLIC ENDPOINTS
// ============================================================

// GET /api/invite/:token - Validate invite token
app.get('/api/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query('SELECT * FROM players WHERE invite_token = $1', [token]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invalid invite token' });

    const player = result.rows[0];
    const now = new Date();
    const canEdit = isTokenValid(player, now);
    const expired = player.edit_until && new Date(player.edit_until) <= now;

    res.json({
      player: {
        id: player.id,
        name: player.name,
        inviteToken: player.invite_token,
        editUntil: player.edit_until,
        canEdit,
        expired: !!expired
      },
      inviteUrl: `${BASE_URL}/?token=${player.invite_token}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/matches - Get all matches with user's guesses
app.get('/api/matches', async (req, res) => {
  try {
    const { token } = req.query;
    const matchesResult = await pool.query('SELECT * FROM matches ORDER BY tournament, team, match_date');
    const matches = matchesResult.rows;

    if (!token) {
      return res.json(matches.map(formatMatch));
    }

    const playerResult = await pool.query('SELECT * FROM players WHERE invite_token = $1', [token]);
    if (playerResult.rows.length === 0) {
      return res.json(matches.map(formatMatch));
    }
    const player = playerResult.rows[0];

    const guessesResult = await pool.query('SELECT match_id, points FROM guesses WHERE player_id = $1', [player.id]);
    const guessMap = new Map(guessesResult.rows.map(g => [g.match_id, g.points]));

    res.json(matches.map(m => ({
      ...formatMatch(m),
      userGuess: guessMap.get(m.id) || null
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatMatch(m) {
  return {
    id: m.id,
    team: m.team,
    tournament: m.tournament,
    opponent: m.opponent,
    homeOrAway: m.home_or_away,
    matchDate: m.match_date ? (m.match_date.toISOString ? m.match_date.toISOString().split('T')[0] : m.match_date) : null,
    prevLeagueContext: m.prev_league_context,
    nextLeagueContext: m.next_league_context,
    played: Boolean(m.played),
    resultScore: m.result_score,
    actualPoints: m.played ? m.result_points : null
  };
}

// GET /api/guesses - Get all guesses
app.get('/api/guesses', async (req, res) => {
  try {
    const sql = `
      SELECT g.id, g.player_id, g.match_id, g.points, g.guessed_at, p.name as player_name
      FROM guesses g
      JOIN players p ON g.player_id = p.id
      ORDER BY g.guessed_at DESC
    `;
    const result = await pool.query(sql);
    res.json(result.rows.map(r => ({
      id: r.id,
      playerId: r.player_id,
      playerName: r.player_name,
      matchId: r.match_id,
      points: r.points,
      guessedAt: r.guessed_at
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/guess - Submit/update a guess
app.post('/api/guess', async (req, res) => {
  try {
    const { token, matchId, points } = req.body;
    if (!token || !matchId || ![0, 1, 3].includes(points)) {
      return res.status(400).json({ error: 'token, matchId, and points (0/1/3) required' });
    }

    const playerResult = await pool.query('SELECT * FROM players WHERE invite_token = $1', [token]);
    if (playerResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const player = playerResult.rows[0];

    if (!isTokenValid(player)) {
      return res.status(403).json({
        error: 'Your edit period has expired. Guesses are now locked.',
        expired: true,
        editUntil: player.edit_until
      });
    }

    const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }
    const match = matchResult.rows[0];
    if (match.played) {
      return res.status(403).json({ error: 'Match already played, cannot guess' });
    }

    // Upsert using ON CONFLICT
    await pool.query(
      `INSERT INTO guesses (player_id, match_id, points) VALUES ($1, $2, $3)
       ON CONFLICT (player_id, match_id) DO UPDATE SET points = EXCLUDED.points, guessed_at = CURRENT_TIMESTAMP`,
      [player.id, matchId, points]
    );

    res.json({ success: true });
    await broadcastLeaderboard();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard - Get ranked leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getLeaderboard() {
  const sql = `
    SELECT
      p.name,
      p.id as player_id,
      COALESCE(SUM(
        CASE
          WHEN g.points = m.result_points AND m.played = true THEN g.points
          ELSE 0
        END
      ), 0) as total_points
    FROM players p
    LEFT JOIN guesses g ON p.id = g.player_id
    LEFT JOIN matches m ON g.match_id = m.id
    WHERE p.is_active = 1
    GROUP BY p.id, p.name
    ORDER BY total_points DESC
  `;
  const result = await pool.query(sql);
  return result.rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    totalPoints: parseInt(r.total_points) || 0
  }));
}

// ============================================================
// ADMIN ENDPOINTS
// ============================================================

function requireAdmin(req, res, next) {
  const adminCode = req.headers['x-admin-code'];
  if (adminCode !== ADMIN_CODE) {
    return res.status(401).json({ error: 'Invalid admin code' });
  }
  next();
}

// POST /api/admin/players - Create a new player with invite token
app.post('/api/admin/players', requireAdmin, async (req, res) => {
  try {
    const { name, editUntil } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const inviteToken = generateToken();
    const expiresAt = editUntil || DEFAULT_EDIT_UNTIL;

    const result = await pool.query(
      'INSERT INTO players (name, invite_token, edit_until) VALUES ($1, $2, $3) RETURNING id',
      [name, inviteToken, expiresAt]
    );

    const player = {
      id: result.rows[0].id,
      name,
      inviteToken,
      editUntil: expiresAt,
      inviteUrl: `${BASE_URL}/?token=${inviteToken}`
    };

    console.log(`Created player: ${name} → ${player.inviteUrl}`);
    res.status(201).json({ player });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/players - List all players
app.get('/api/admin/players', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM players ORDER BY name');
    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      inviteToken: r.invite_token,
      editUntil: r.edit_until,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      inviteUrl: `${BASE_URL}/?token=${r.invite_token}`
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/players/:id - Remove a player
app.delete('/api/admin/players/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM guesses WHERE player_id = $1', [id]);
    const result = await pool.query('DELETE FROM players WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Player not found' });
    console.log(`Deleted player ID: ${id}`);
    res.json({ success: true });
    await broadcastLeaderboard();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/players/:id - Update player
app.put('/api/admin/players/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, editUntil, isActive } = req.body;

    const updates = [];
    const params = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); params.push(name); }
    if (editUntil !== undefined) { updates.push(`edit_until = $${i++}`); params.push(editUntil); }
    if (isActive !== undefined) { updates.push(`is_active = $${i++}`); params.push(isActive ? 1 : 0); }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(id);
    const result = await pool.query(`UPDATE players SET ${updates.join(', ')} WHERE id = $${i}`, params);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Player not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/results - Update match result
app.post('/api/admin/results', requireAdmin, async (req, res) => {
  try {
    const { matchId, result_score, result_points } = req.body;
    if (!matchId || ![0, 1, 3].includes(result_points)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const result = await pool.query(
      'UPDATE matches SET played = true, result_score = $1, result_points = $2 WHERE id = $3',
      [result_score, result_points, matchId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Match not found' });
    res.json({ success: true });
    await broadcastLeaderboard();
    broadcastMatchLocked(matchId, result_score, result_points);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/guess/:id - Delete a specific guess
app.delete('/api/admin/guess/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM guesses WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Guess not found' });
    res.json({ success: true });
    await broadcastLeaderboard();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/guesses/reset - Delete all guesses
app.delete('/api/admin/guesses/reset', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM guesses');
    console.log(`Admin reset: ${result.rowCount} guesses deleted`);
    res.json({ success: true, deleted: result.rowCount });
    await broadcastLeaderboard();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATIC FILES
// ============================================================

app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
initialize().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server on ws://localhost:${PORT}`);
    console.log(`Admin code: ${ADMIN_CODE}`);
    console.log(`BASE_URL: ${BASE_URL}`);
    console.log(`Default edit expiry: ${DEFAULT_EDIT_UNTIL}`);
    console.log(`Database: PostgreSQL (Neon)`);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});

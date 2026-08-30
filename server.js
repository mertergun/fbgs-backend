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
    // Broadcast for every room
    const rooms = await pool.query('SELECT id FROM rooms');
    for (const r of rooms.rows) {
      const leaderboard = await getLeaderboard(r.id);
      broadcast({ type: 'leaderboard_update', roomId: r.id, data: leaderboard });
    }
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

// GET /api/invite/:token - Validate invite token (player or room)
app.get('/api/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    // Check if this is a room token
    if (token.startsWith('room_')) {
      const roomResult = await pool.query('SELECT * FROM rooms WHERE invite_token = $1', [token]);
      if (roomResult.rows.length === 0) return res.status(404).json({ error: 'Invalid room token' });
      const room = roomResult.rows[0];
      // List members of this room
      const members = await pool.query(
        `SELECT p.id, p.name, p.invite_token, rp.joined_at
         FROM room_players rp JOIN players p ON p.id = rp.player_id
         WHERE rp.room_id = $1 ORDER BY rp.joined_at`,
        [room.id]
      );
      return res.json({
        type: 'room',
        room: {
          id: room.id,
          name: room.name,
          inviteToken: room.invite_token,
          isLocked: Boolean(room.is_locked)
        },
        members: members.rows.map(m => ({ id: m.id, name: m.name, joinedAt: m.joined_at })),
        inviteUrl: `${BASE_URL}/?token=${room.invite_token}`
      });
    }
    // Otherwise treat as a player token
    const result = await pool.query('SELECT * FROM players WHERE invite_token = $1', [token]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invalid invite token' });

    const player = result.rows[0];
    const now = new Date();
    const canEdit = isTokenValid(player, now);
    const expired = player.edit_until && new Date(player.edit_until) <= now;

    // Find the player's room(s)
    const roomsResult = await pool.query(
      `SELECT r.id, r.name, r.invite_token, r.is_locked
       FROM room_players rp JOIN rooms r ON r.id = rp.room_id
       WHERE rp.player_id = $1`,
      [player.id]
    );

    res.json({
      type: 'player',
      player: {
        id: player.id,
        name: player.name,
        inviteToken: player.invite_token,
        editUntil: player.edit_until,
        canEdit,
        expired: !!expired
      },
      rooms: roomsResult.rows.map(r => ({
        id: r.id, name: r.name, inviteToken: r.invite_token, isLocked: Boolean(r.is_locked)
      })),
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

    let playerId = null;
    let roomId = null;

    if (token.startsWith('room_')) {
      // Room token — find the room, list all players in it
      const roomResult = await pool.query('SELECT id FROM rooms WHERE invite_token = $1', [token]);
      if (roomResult.rows.length === 0) return res.json(matches.map(formatMatch));
      roomId = roomResult.rows[0].id;
    } else {
      // Player token
      const playerResult = await pool.query('SELECT id FROM players WHERE invite_token = $1', [token]);
      if (playerResult.rows.length === 0) return res.json(matches.map(formatMatch));
      playerId = playerResult.rows[0].id;
      // Find which room to use — take the first room the player belongs to
      const roomResult = await pool.query(
        'SELECT room_id FROM room_players WHERE player_id = $1 LIMIT 1',
        [playerId]
      );
      if (roomResult.rows.length > 0) roomId = roomResult.rows[0].room_id;
    }

    if (!roomId) return res.json(matches.map(formatMatch));

    // Get all player IDs in this room
    const roomPlayers = await pool.query(
      'SELECT player_id FROM room_players WHERE room_id = $1',
      [roomId]
    );
    const playerIds = roomPlayers.rows.map(r => r.player_id);

    // Get the player's own guess
    let userGuessMap = new Map();
    if (playerId) {
      const myGuesses = await pool.query(
        'SELECT match_id, points FROM guesses WHERE player_id = $1',
        [playerId]
      );
      userGuessMap = new Map(myGuesses.rows.map(g => [g.match_id, g.points]));
    }

    // Get the room's lock state
    const roomRow = (await pool.query('SELECT is_locked FROM rooms WHERE id = $1', [roomId])).rows[0];
    const roomIsLocked = Boolean(roomRow && roomRow.is_locked);

    res.json(matches.map(m => {
      // Player's own guess is always visible to them
      const userGuess = playerId ? (userGuessMap.get(m.id) ?? null) : null;
      return {
        ...formatMatch(m),
        userGuess
      };
    }));
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

// GET /api/guesses - Get guesses for the match list
// Returns all guesses when the room is unlocked (players see their own guess per match).
// When room is locked, returns all players' guesses so the full leaderboard can render.
app.get('/api/guesses', async (req, res) => {
  try {
    const { token } = req.query;
    let playerId = null;
    let roomId = null;

    if (token && token.startsWith('room_')) {
      const roomResult = await pool.query('SELECT id FROM rooms WHERE invite_token = $1', [token]);
      if (roomResult.rows.length === 0) return res.json([]);
      roomId = roomResult.rows[0].id;
    } else if (token) {
      const playerResult = await pool.query('SELECT id FROM players WHERE invite_token = $1', [token]);
      if (playerResult.rows.length > 0) {
        playerId = playerResult.rows[0].id;
        const roomResult = await pool.query(
          'SELECT room_id FROM room_players WHERE player_id = $1 LIMIT 1',
          [playerId]
        );
        if (roomResult.rows.length > 0) roomId = roomResult.rows[0].room_id;
      }
    }

    if (!roomId) return res.json([]);

    const roomPlayers = await pool.query(
      'SELECT player_id FROM room_players WHERE room_id = $1',
      [roomId]
    );
    const playerIds = roomPlayers.rows.map(r => r.player_id);
    if (playerIds.length === 0) return res.json([]);

    // Check room lock state
    const roomRow = (await pool.query('SELECT is_locked FROM rooms WHERE id = $1', [roomId])).rows[0];
    const roomIsLocked = Boolean(roomRow && roomRow.is_locked);

    const result = await pool.query(
      `SELECT g.id, g.player_id, g.match_id, g.points, g.guessed_at, p.name as player_name, m.played
       FROM guesses g
       JOIN players p ON g.player_id = p.id
       JOIN matches m ON g.match_id = m.id
       WHERE g.player_id = ANY($1)
       ORDER BY g.guessed_at DESC`,
      [playerIds]
    );

    // When room is locked, everyone sees all guesses. When unlocked, each player only sees their own.
    res.json(result.rows
      .filter(r => roomIsLocked || r.player_id === playerId)
      .map(r => ({
        id: r.id,
        playerId: r.player_id,
        playerName: r.player_name,
        matchId: r.match_id,
        points: r.points,
        guessedAt: r.guessed_at
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/join - Add a player to a room
// Body: { user_id: <player invite_token>, invite_token: <room invite_token> }
app.post('/api/rooms/join', async (req, res) => {
  try {
    // Accept both naming conventions for compatibility
    const user_id = req.body.user_id || req.body.invite_token; // backwards compat
    const invite_token = req.body.invite_token || req.body.room_invite_token;
    if (!user_id || !invite_token) {
      return res.status(400).json({ error: 'user_id and invite_token required' });
    }

    const playerResult = await pool.query('SELECT id FROM players WHERE invite_token = $1', [user_id]);
    if (playerResult.rows.length === 0) {
      return res.status(401).json({ error: 'Geçersiz davet kodu. Lütfen yöneticinle iletişime geç.' });
    }
    const roomResult = await pool.query('SELECT id, name FROM rooms WHERE invite_token = $1', [invite_token]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Oda kodu bulunamadı. Lütfen doğru kodu girdiğinden emin ol.' });
    }

    await pool.query(
      'INSERT INTO room_players (room_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roomResult.rows[0].id, playerResult.rows[0].id]
    );
    res.json({ success: true, roomName: roomResult.rows[0].name, room: { id: roomResult.rows[0].id, name: roomResult.rows[0].name, inviteToken: invite_token } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms - List rooms a player belongs to
app.get('/api/rooms', async (req, res) => {
  try {
    const { playerToken } = req.query;
    if (!playerToken) return res.status(400).json({ error: 'playerToken required' });
    const playerResult = await pool.query('SELECT id FROM players WHERE invite_token = $1', [playerToken]);
    if (playerResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    const result = await pool.query(
      `SELECT r.id, r.name, r.invite_token
       FROM room_players rp JOIN rooms r ON r.id = rp.room_id
       WHERE rp.player_id = $1`,
      [playerResult.rows[0].id]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      inviteToken: r.invite_token
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

    // Check if the player's room is locked — no guesses accepted when room is locked
    const roomRow = await pool.query(
      `SELECT r.is_locked FROM room_players rp JOIN rooms r ON r.id = rp.room_id WHERE rp.player_id = $1 LIMIT 1`,
      [player.id]
    );
    if (roomRow.rows.length > 0 && roomRow.rows[0].is_locked) {
      return res.status(403).json({
        error: 'Bu oda kilitlendi. Tahmin kabul edilmiyor.',
        roomLocked: true
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

// GET /api/leaderboard - Get ranked leaderboard (room-scoped)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { roomId } = req.query;
    let resolvedRoomId = roomId ? parseInt(roomId) : null;

    // If no roomId, fall back to first room of the request — but keep API simple:
    // require roomId to be set (or pass first available)
    if (!resolvedRoomId) {
      // Find any room (for admin / first room fallback)
      const any = await pool.query('SELECT id FROM rooms ORDER BY id LIMIT 1');
      if (any.rows.length === 0) return res.json([]);
      resolvedRoomId = any.rows[0].id;
    }

    const leaderboard = await getLeaderboard(resolvedRoomId);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getLeaderboard(roomId) {
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
    FROM room_players rp
    JOIN players p ON p.id = rp.player_id
    LEFT JOIN guesses g ON p.id = g.player_id
    LEFT JOIN matches m ON g.match_id = m.id
    WHERE rp.room_id = $1 AND p.is_active = 1
    GROUP BY p.id, p.name
    ORDER BY total_points DESC
  `;
  const result = await pool.query(sql, [roomId]);
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
// Body: { name, editUntil?, roomId? }
//   - roomId: optional room ID; if omitted, falls back to the first/default room
app.post('/api/admin/players', requireAdmin, async (req, res) => {
  try {
    const { name, editUntil, roomId } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const inviteToken = generateToken();
    const expiresAt = editUntil || DEFAULT_EDIT_UNTIL;

    const result = await pool.query(
      'INSERT INTO players (name, invite_token, edit_until) VALUES ($1, $2, $3) RETURNING id',
      [name, inviteToken, expiresAt]
    );
    const playerId = result.rows[0].id;

    // Assign player to a room: explicit roomId wins; otherwise the first available room
    let assignedRoom = null;
    try {
      if (roomId !== undefined && roomId !== null && roomId !== '') {
        const roomCheck = await pool.query('SELECT id, name, invite_token FROM rooms WHERE id = $1', [roomId]);
        if (roomCheck.rows.length > 0) {
          await pool.query(
            'INSERT INTO room_players (room_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [roomCheck.rows[0].id, playerId]
          );
          assignedRoom = {
            id: roomCheck.rows[0].id,
            name: roomCheck.rows[0].name,
            inviteToken: roomCheck.rows[0].invite_token
          };
        }
      } else {
        // Default: first room
        const defaultRoom = await pool.query('SELECT id, name, invite_token FROM rooms ORDER BY id LIMIT 1');
        if (defaultRoom.rows.length > 0) {
          await pool.query(
            'INSERT INTO room_players (room_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [defaultRoom.rows[0].id, playerId]
          );
          assignedRoom = {
            id: defaultRoom.rows[0].id,
            name: defaultRoom.rows[0].name,
            inviteToken: defaultRoom.rows[0].invite_token
          };
        }
      }
    } catch (roomErr) {
      console.error('Failed to assign player to room:', roomErr.message);
    }

    const player = {
      id: playerId,
      name,
      inviteToken,
      editUntil: expiresAt,
      inviteUrl: `${BASE_URL}/?token=${inviteToken}`,
      room: assignedRoom
    };

    console.log(`Created player: ${name} → ${player.inviteUrl}${assignedRoom ? ' (room: ' + assignedRoom.name + ')' : ''}`);
    res.status(201).json({ player });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/players - List all players
app.get('/api/admin/players', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              r.id as room_id, r.name as room_name, r.invite_token as room_invite_token
       FROM players p
       LEFT JOIN room_players rp ON rp.player_id = p.id
       LEFT JOIN rooms r ON r.id = rp.room_id
       ORDER BY p.name`
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      inviteToken: r.invite_token,
      editUntil: r.edit_until,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      inviteUrl: `${BASE_URL}/?token=${r.invite_token}`,
      room: r.room_id ? {
        id: r.room_id,
        name: r.room_name,
        inviteToken: r.room_invite_token
      } : null
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

// POST /api/admin/rooms - Create a new room
app.post('/api/admin/rooms', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const inviteToken = 'room_' + crypto.randomBytes(6).toString('hex');
    const result = await pool.query(
      'INSERT INTO rooms (name, invite_token) VALUES ($1, $2) RETURNING id',
      [name, inviteToken]
    );
    const room = {
      id: result.rows[0].id,
      name,
      inviteToken,
      inviteUrl: `${BASE_URL}/?room=${inviteToken}`
    };
    console.log(`Created room: ${name} → ${room.inviteUrl}`);
    res.status(201).json({ room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/rooms - List all rooms
app.get('/api/admin/rooms', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms ORDER BY created_at DESC');
    const rooms = await Promise.all(result.rows.map(async r => {
      const members = await pool.query(
        `SELECT p.id, p.name, p.invite_token, rp.joined_at
         FROM room_players rp JOIN players p ON p.id = rp.player_id
         WHERE rp.room_id = $1`,
        [r.id]
      );
      return {
        id: r.id,
        name: r.name,
        inviteToken: r.invite_token,
        inviteUrl: `${BASE_URL}/?room=${r.invite_token}`,
        createdAt: r.created_at,
        isLocked: Boolean(r.is_locked),
        memberCount: members.rows.length
      };
    }));
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/rooms/:id - Delete a room
app.delete('/api/admin/rooms/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Room not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/rooms/:id/players - Add player to room
app.post('/api/admin/rooms/:id/players', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    await pool.query(
      'INSERT INTO room_players (room_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, playerId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/rooms/:id/players/:playerId - Remove player from room
app.delete('/api/admin/rooms/:id/players/:playerId', requireAdmin, async (req, res) => {
  try {
    const { id, playerId } = req.params;
    await pool.query('DELETE FROM room_players WHERE room_id = $1 AND player_id = $2', [id, playerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/rooms/:id/lock - Lock a room (reveal all guesses in that room)
app.post('/api/admin/rooms/:id/lock', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE rooms SET is_locked = true WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Room not found' });
    broadcast({ type: 'room_locked', roomId: parseInt(id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/rooms/:id/unlock - Unlock a room (re-hide all guesses)
app.post('/api/admin/rooms/:id/unlock', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE rooms SET is_locked = false WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Room not found' });
    broadcast({ type: 'room_unlocked', roomId: parseInt(id) });
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

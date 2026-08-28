require('dotenv').config();
const readline = require('readline');
const { Pool } = require('pg');

const ADMIN_CODE = process.env.ADMIN_CODE || 'admin-secret';
const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const DEFAULT_EDIT_UNTIL = process.env.DEFAULT_EDIT_UNTIL || '2026-09-16';

const isTTY = process.stdin.isTTY;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Code': ADMIN_CODE,
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadMatches() {
  const result = await pool.query('SELECT * FROM matches ORDER BY tournament, team, match_date');
  return result.rows;
}

async function loadPlayers() {
  const result = await pool.query('SELECT * FROM players ORDER BY name');
  return result.rows;
}

async function setResult(matchId, resultScore, resultPoints) {
  await apiFetch('/api/admin/results', {
    method: 'POST',
    body: JSON.stringify({ matchId, result_score: resultScore, result_points: resultPoints })
  });
  console.log(`✓ Updated: ${matchId} → ${resultScore} (${resultPoints} pts)`);
}

async function addPlayer(name, editUntil) {
  const expires = editUntil || DEFAULT_EDIT_UNTIL;
  const data = await apiFetch('/api/admin/players', {
    method: 'POST',
    body: JSON.stringify({ name, editUntil: expires })
  });
  console.log(`\n✓ Created player: ${name}`);
  console.log(`  Edit until: ${expires}`);
  console.log(`  Invite URL: ${data.player.inviteUrl}\n`);
  return data.player;
}

async function removePlayer(id) {
  await apiFetch(`/api/admin/players/${id}`, { method: 'DELETE' });
  console.log(`✓ Deleted player ID: ${id}`);
}

async function resetGuesses(force = false) {
  if (!force) {
    const confirmed = await askConfirmation('This will DELETE ALL guesses. Continue? (type YES to confirm): ');
    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }
  } else {
    console.log('Resetting all guesses...');
  }
  const result = await apiFetch('/api/admin/guesses/reset', { method: 'DELETE' });
  console.log(`✓ Deleted ${result.deleted} guess(es). Players preserved.`);
}

function displayMatches(matches) {
  console.log('\nMatches:\n');
  matches.forEach(m => {
    const status = m.played ? `✓ ${m.result_score} (${m.result_points}pts)` : '○ Pending';
    const name = `${m.team} vs ${m.opponent} (${m.home_or_away})`;
    console.log(`  ${String(m.id).padEnd(10)} [${String(m.team).padEnd(12)} ${m.tournament}] ${name.padEnd(50)} ${status}`);
  });
  console.log();
}

function displayPlayers(players) {
  if (players.length === 0) {
    console.log('\nNo players yet. Use "addplayer" to create one.\n');
    return;
  }
  console.log('\nPlayers:\n');
  players.forEach(p => {
    const status = p.is_active ? '✓' : '✗';
    const expired = p.edit_until && new Date(p.edit_until) < new Date() ? ' (EXPIRED)' : '';
    console.log(`  ${status} [${p.id}] ${String(p.name).padEnd(20)} Token: ${p.invite_token}${expired}`);
    console.log(`       ${API_BASE}/?token=${p.invite_token}`);
  });
  console.log();
}

function askConfirmation(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

function parseAddPlayerArgs(args) {
  const dateMatch = args.match(/(\d{4}-\d{2}-\d{2})$/);
  let name = args;
  let editUntil = DEFAULT_EDIT_UNTIL;
  if (dateMatch) {
    name = args.replace(dateMatch[0], '').trim();
    editUntil = dateMatch[1];
  }
  return { name, editUntil };
}

async function main() {
  console.log('=== FBGS Admin CLI ===\n');
  console.log(`  Target server: ${API_BASE}`);
  console.log(`  Default expiry: ${DEFAULT_EDIT_UNTIL}`);
  console.log(`  Database: PostgreSQL (Neon)\n`);
  console.log('Commands:');
  console.log('  list              - Show all matches');
  console.log('  set <id> <score> <pts>  - Set match result (pts: 0/1/3)');
  console.log('  players           - Show all players + invite URLs');
  console.log('  addplayer <name> [date]  - Create player (date: YYYY-MM-DD, default: ' + DEFAULT_EDIT_UNTIL + ')');
  console.log('  removeplayer <id> - Delete player (and their guesses)');
  console.log('  reset             - Delete ALL guesses (debug - requires "yes" confirmation)');
  console.log('  server            - Show current server URL');
  console.log('  quit              - Exit\n');

  const matches = await loadMatches();
  displayMatches(matches);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  while (true) {
    const input = await ask('admin> ');
    const trimmed = input.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    if (cmd === 'quit' || cmd === 'q' || cmd === 'exit') {
      console.log('Goodbye!');
      break;
    }

    if (cmd === 'list' || cmd === 'l') {
      try {
        const refreshed = await loadMatches();
        displayMatches(refreshed);
      } catch (e) {
        console.log('Error:', e.message);
      }
      continue;
    }

    if (cmd === 'set' && parts.length >= 4) {
      const matchId = parts[1];
      const resultScore = parts[2];
      const resultPoints = parseInt(parts[3]);
      if (![0, 1, 3].includes(resultPoints)) {
        console.log('Points must be 0, 1, or 3');
        continue;
      }
      try {
        await setResult(matchId, resultScore, resultPoints);
      } catch (e) {
        console.log('Error:', e.message);
      }
      continue;
    }

    if (cmd === 'players' || cmd === 'p') {
      try {
        const players = await loadPlayers();
        displayPlayers(players);
      } catch (e) {
        console.log('Error:', e.message);
      }
      continue;
    }

    if (cmd === 'addplayer') {
      const afterCmd = trimmed.substring('addplayer'.length).trim();
      if (!afterCmd) {
        console.log('Usage: addplayer <name> [date]');
        console.log('  Example: addplayer Mert 2026-09-20');
        continue;
      }
      const { name, editUntil } = parseAddPlayerArgs(afterCmd);
      try {
        await addPlayer(name, editUntil);
      } catch (e) {
        console.log('Error:', e.message);
      }
      continue;
    }

    if (cmd === 'removeplayer') {
      const id = parseInt(parts[1]);
      if (isNaN(id)) {
        console.log('Usage: removeplayer <id>');
        continue;
      }
      try {
        await removePlayer(id);
      } catch (e) {
        console.log('Error:', e.message);
      }
      continue;
    }

    if (cmd === 'reset') {
      const forceFlag = parts.includes('--yes') || parts.includes('-y');
      try {
        await resetGuesses(forceFlag);
      } catch (e) {
        console.log('Error:', e.message);
      }
      continue;
    }

    if (cmd === 'server') {
      console.log(`\n  Current server: ${API_BASE}\n`);
      continue;
    }

    console.log('Unknown command. Try: list, set, players, addplayer, removeplayer, reset, server, quit');
  }

  rl.close();
  await pool.end();
}

main().then(() => {
  if (isTTY) {
    console.log('Done.');
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

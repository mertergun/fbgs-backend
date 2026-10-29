const fs = require('node:fs/promises');
const { isDeepStrictEqual } = require('node:util');
const manifest = require('../fixtures/context-corrections-2026-10-29.json');

const fields = ['prev_league_context', 'next_league_context'];

function planCorrections(rows, corrections = manifest.corrections) {
    const byId = new Map(rows.map(row => [row.id, row]));
    if (rows.length !== corrections.length || byId.size !== corrections.length) {
        throw new Error(`Expected exactly ${corrections.length} unique fixture rows; found ${rows.length}`);
    }
    const changes = [];
    for (const correction of corrections) {
        const row = byId.get(correction.id);
        if (!row) throw new Error(`Missing fixture ${correction.id}`);
        for (const [field, expected] of Object.entries(correction.expectedIdentity)) {
            if (row[field] !== expected) throw new Error(`Fixture identity changed: ${row.id}.${field}`);
        }
        for (const field of fields) {
            if (row[field] !== correction.before[field] && row[field] !== correction.after[field]) {
                throw new Error(`Unreviewed value: ${row.id}.${field}`);
            }
        }
        if (fields.some(field => row[field] !== correction.after[field])) {
            changes.push({ id: row.id,
                before: Object.fromEntries(fields.map(field => [field, row[field]])),
                after: correction.after });
        }
    }
    return changes;
}

// Accept a single connected PostgreSQL client, never a pool: every statement
// and the backup must belong to the same transaction and snapshot.
async function updateLeagueContext(client, { apply = false, backupPath, writeBackup } = {}) {
    if (apply && !backupPath) throw new Error('--apply requires --backup <new-file>');
    const ids = manifest.corrections.map(c => c.id);
    let transaction = false;
    try {
        await client.query(apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' :
            'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        transaction = true;
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '30s'");
        await client.query("SET LOCAL DateStyle = 'ISO, YMD'");
        const readSql = 'SELECT *, match_date::text AS match_date FROM matches WHERE id = ANY($1::varchar[]) ORDER BY id';
        const { rows } = await client.query(readSql + (apply ? ' FOR UPDATE' : ''), [ids]);
        const changes = planCorrections(rows);
        const summary = { mode: apply ? 'apply' : 'dry-run', expectedRows: ids.length,
            pendingRows: changes.length, alreadyCorrectRows: ids.length - changes.length, changes };
        if (!apply || !changes.length) {
            await client.query('ROLLBACK');
            transaction = false;
            return summary;
        }
        const backup = JSON.stringify({ migration: 'league-context-2026-10-29',
            baselineCommit: manifest.baselineCommit, createdAt: new Date().toISOString(),
            pendingIds: changes.map(c => c.id), rows }, null, 2) + '\n';
        // Exclusive creation prevents accidentally replacing an earlier backup.
        await (writeBackup || ((file, text) => fs.writeFile(file, text, { flag: 'wx', mode: 0o600 })))(backupPath, backup);
        for (const change of changes) {
            const result = await client.query(
                `UPDATE matches SET prev_league_context=$1, next_league_context=$2
                 WHERE id=$3 AND prev_league_context IS NOT DISTINCT FROM $4
                   AND next_league_context IS NOT DISTINCT FROM $5 RETURNING id`,
                [change.after.prev_league_context, change.after.next_league_context, change.id,
                    change.before.prev_league_context, change.before.next_league_context]);
            if (result.rows.length !== 1) throw new Error(`Expected one updated row for ${change.id}`);
        }
        const after = (await client.query(readSql, [ids])).rows;
        if (planCorrections(after).length) throw new Error('Post-update context verification failed');
        const protectedValues = row => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
        if (!isDeepStrictEqual(rows.map(protectedValues), after.map(protectedValues))) {
            throw new Error('A protected fixture value changed; rolling back');
        }
        await client.query('COMMIT');
        transaction = false;
        return { ...summary, backupPath };
    } catch (error) {
        if (transaction) await client.query('ROLLBACK');
        throw error;
    }
}

function parseArgs(args) {
    const options = { apply: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--apply') options.apply = true;
        else if (args[i] === '--backup' && args[i + 1] && !args[i + 1].startsWith('--')) options.backupPath = args[++i];
        else if (args[i] !== '--dry-run') throw new Error('Usage: node scripts/update-league-context.js [--dry-run | --apply --backup <new-file>]');
    }
    if (args.includes('--dry-run') && options.apply) throw new Error('Choose --dry-run or --apply, not both');
    if (options.apply && !options.backupPath) throw new Error('--apply requires --backup <new-file>');
    return options;
}

async function main() {
    require('dotenv').config({ quiet: true });
    const options = parseArgs(process.argv.slice(2));
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured. No database was accessed.');
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
    try {
        await client.connect();
        console.log(JSON.stringify(await updateLeagueContext(client, options), null, 2));
    } finally {
        await client.end();
    }
}

if (require.main === module) main().catch(error => {
    // pg connection errors can contain credentials or endpoint details.
    const message = String(error.message).replaceAll(process.env.DATABASE_URL || '\0', '[DATABASE_URL]');
    console.error(message);
    process.exitCode = 1;
});

module.exports = { planCorrections, updateLeagueContext, parseArgs };

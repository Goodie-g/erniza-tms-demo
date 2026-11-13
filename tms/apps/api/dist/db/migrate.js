import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './client.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationDirCandidates = [
    path.resolve(here, '../../db/migrations'),
    path.resolve(process.cwd(), 'db/migrations'),
];
const migrationDir = migrationDirCandidates.find((candidate) => fs.existsSync(candidate));
export async function migrate(db = getDb()) {
    if (!migrationDir)
        throw new Error('Migration directory not found');
    await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
    const appliedResult = await db.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.name));
    const files = fs
        .readdirSync(migrationDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();
    const newlyApplied = [];
    for (const file of files) {
        if (applied.has(file))
            continue;
        const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
        await db.transaction(async (tx) => {
            await tx.exec(sql);
            await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        });
        newlyApplied.push(file);
    }
    return newlyApplied;
}

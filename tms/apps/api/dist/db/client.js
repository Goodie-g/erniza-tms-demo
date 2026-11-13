import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { config } from '../config.js';
const { Pool } = pg;
class PostgresDb {
    pool;
    constructor(connectionString) {
        this.pool = new Pool({
            connectionString,
            ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
            max: 10,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
        });
        this.pool.on('error', (error) => {
            // eslint-disable-next-line no-console
            console.error('Unexpected PostgreSQL pool error', error);
        });
    }
    async query(sql, params = []) {
        const result = await this.pool.query(sql, params);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    }
    async exec(sql) {
        await this.pool.query(sql);
    }
    async transaction(fn) {
        const client = await this.pool.connect();
        const tx = {
            query: async (sql, params = []) => {
                const result = await client.query(sql, params);
                return { rows: result.rows, rowCount: result.rowCount ?? 0 };
            },
            exec: async (sql) => {
                await client.query(sql);
            },
        };
        try {
            await client.query('BEGIN');
            const result = await fn(tx);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
    }
}
/**
 * PGlite is a single-connection WASM PostgreSQL used for local development and
 * integration tests. All operations are serialised so a transaction cannot be
 * interleaved with queries from another request.
 */
class PgliteDb {
    client;
    queue = Promise.resolve();
    constructor(dataDir) {
        if (dataDir !== 'memory://') {
            const resolved = path.resolve(dataDir);
            fs.mkdirSync(path.dirname(resolved), { recursive: true });
            this.client = new PGlite(resolved, { debug: Number(process.env.PGLITE_DEBUG ?? 1) });
        }
        else {
            this.client = new PGlite();
        }
    }
    enqueue(operation) {
        const run = this.queue.then(operation, operation);
        this.queue = run.then(() => undefined, () => undefined);
        return run;
    }
    async rawQuery(sql, params = []) {
        const result = await this.client.query(sql, params);
        return {
            rows: result.rows,
            rowCount: result.affectedRows ?? result.rows.length,
        };
    }
    query(sql, params = []) {
        return this.enqueue(() => this.rawQuery(sql, params));
    }
    exec(sql) {
        return this.enqueue(async () => {
            await this.client.exec(sql);
        });
    }
    transaction(fn) {
        return this.enqueue(async () => {
            await this.client.exec('BEGIN');
            const tx = {
                query: (sql, params = []) => this.rawQuery(sql, params),
                exec: async (sql) => {
                    await this.client.exec(sql);
                },
            };
            try {
                const result = await fn(tx);
                await this.client.exec('COMMIT');
                return result;
            }
            catch (error) {
                await this.client.exec('ROLLBACK');
                throw error;
            }
        });
    }
    async close() {
        await this.client.close();
    }
}
let instance = null;
export function createDb() {
    if (config.databaseUrl) {
        return new PostgresDb(config.databaseUrl);
    }
    return new PgliteDb(config.isTest ? 'memory://' : config.pglitePath);
}
export function getDb() {
    if (!instance)
        instance = createDb();
    return instance;
}
export async function closeDb() {
    if (instance) {
        await instance.close();
        instance = null;
    }
}

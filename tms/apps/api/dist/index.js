import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/client.js';
import { migrate } from './db/migrate.js';
import { logger } from './lib/logger.js';
async function main() {
    if (!config.isTest) {
        const applied = await migrate();
        if (applied.length > 0)
            logger.info({ migrations: applied }, 'Database migrations applied');
    }
    const app = createApp();
    const server = app.listen(config.port, () => {
        logger.info({
            port: config.port,
            environment: config.env,
            appUrl: config.appUrl,
            database: config.databaseUrl ? 'postgres' : 'pglite',
            storage: config.usingSupabaseStorage ? 'supabase' : 'local',
        }, `Erniza API listening on http://localhost:${config.port}`);
        if (!config.databaseUrl) {
            logger.warn('Using embedded PGlite. Set DATABASE_URL to a PostgreSQL/Supabase connection for production.');
        }
    });
    const shutdown = (signal) => {
        logger.info({ signal }, 'Shutting down');
        server.close(async () => {
            await closeDb();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
main().catch(async (error) => {
    logger.error({ err: error }, 'Failed to start API');
    await closeDb().catch(() => undefined);
    process.exit(1);
});

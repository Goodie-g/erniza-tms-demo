import { migrate } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
process.env.NODE_ENV = 'test';
process.env.PGLITE_PATH = '.data/test-pgdata';
process.env.UPLOAD_DIR = 'uploads-test';
await migrate();
await seedDatabase({ reset: true });

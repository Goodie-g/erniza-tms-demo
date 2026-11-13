import { migrate } from './migrate.js';
import { closeDb } from './client.js';
try {
    const applied = await migrate();
    if (applied.length === 0) {
        console.log('Database is up to date.');
    }
    else {
        console.log(`Applied migrations:\n${applied.map((name) => `  - ${name}`).join('\n')}`);
    }
}
catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
}
finally {
    await closeDb();
}

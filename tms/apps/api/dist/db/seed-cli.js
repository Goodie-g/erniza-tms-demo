import { closeDb } from './client.js';
import { runSeedCli } from './seed.js';
runSeedCli()
    .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await closeDb();
});

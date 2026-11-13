import { USER_ROLES } from '@erniza/shared';
import { config } from '../config.js';
import { closeDb } from './client.js';
import { createAdmin } from './create-admin.js';
import { migrate } from './migrate.js';
function argument(name) {
    const index = process.argv.indexOf(`--${name}`);
    if (index >= 0)
        return process.argv[index + 1];
    const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
    return inline?.slice(name.length + 3);
}
async function main() {
    const email = argument('email') ?? process.env.ADMIN_EMAIL ?? config.seedAdminEmail;
    const password = argument('password') ?? process.env.ADMIN_PASSWORD ?? config.seedAdminPassword;
    const fullName = argument('name') ?? process.env.ADMIN_NAME ?? config.seedAdminName;
    const roleInput = (argument('role') ?? process.env.ADMIN_ROLE ?? 'owner');
    if (!USER_ROLES.includes(roleInput)) {
        throw new Error(`Role must be one of: ${USER_ROLES.join(', ')}`);
    }
    await migrate();
    const result = await createAdmin({ email, password, fullName, role: roleInput });
    console.log(result.created
        ? `Created ${roleInput} account: ${email}`
        : `Updated existing account: ${email} (password and role refreshed)`);
    if (!argument('password') && !process.env.ADMIN_PASSWORD) {
        console.warn('No explicit password was supplied; the SEED_ADMIN_PASSWORD environment value was used.');
    }
}
main()
    .catch((error) => {
    console.error('Create admin failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await closeDb();
});

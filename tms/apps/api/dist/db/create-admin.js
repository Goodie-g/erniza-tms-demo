import { USER_ROLES } from '@erniza/shared';
import { getDb } from '../db/client.js';
import { hashPassword } from '../lib/password.js';
/**
 * Creates an administrator or resets the password/role of an existing account.
 * Safe to run repeatedly and intended for production bootstrap.
 */
export async function createAdmin(input) {
    const email = input.email.trim();
    const fullName = input.fullName.trim();
    const role = input.role ?? 'owner';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error('Enter a valid email address.');
    if (input.password.length < 10)
        throw new Error('The password must be at least 10 characters.');
    if (!fullName)
        throw new Error('A full name is required.');
    if (!USER_ROLES.includes(role))
        throw new Error(`Role must be one of: ${USER_ROLES.join(', ')}`);
    const passwordHash = await hashPassword(input.password);
    const db = getDb();
    const existing = await db.query('SELECT id FROM admin_users WHERE lower(email) = lower($1)', [email]);
    if (existing.rows[0]) {
        await db.query(`UPDATE admin_users SET password_hash = $2, full_name = $3, role = $4, is_active = true, updated_at = now()
        WHERE id = $1`, [existing.rows[0].id, passwordHash, fullName, role]);
        return { id: existing.rows[0].id, created: false };
    }
    const result = await db.query(`INSERT INTO admin_users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id`, [email, passwordHash, fullName, role]);
    return { id: result.rows[0].id, created: true };
}

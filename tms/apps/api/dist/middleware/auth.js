import { config, SESSION_COOKIE } from '../config.js';
import { getDb } from '../db/client.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { hashToken } from '../lib/password.js';
export function readSessionToken(req) {
    const cookieToken = req.cookies?.[SESSION_COOKIE];
    if (cookieToken)
        return cookieToken;
    const header = req.get('authorization');
    if (header?.startsWith('Bearer '))
        return header.slice(7).trim();
    return undefined;
}
export async function resolveSession(token) {
    const db = getDb();
    const result = await db.query(`SELECT s.id AS session_id, u.id, u.email, u.full_name, u.role
       FROM sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.is_active = true
      LIMIT 1`, [hashToken(token)]);
    const row = result.rows[0];
    if (!row)
        return null;
    return {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        sessionId: row.session_id,
    };
}
export async function requireAuth(req, res, next) {
    const token = readSessionToken(req);
    if (!token) {
        if (req.cookies?.[SESSION_COOKIE]) {
            res.clearCookie(SESSION_COOKIE, { path: '/' });
        }
        next(unauthorized());
        return;
    }
    try {
        const user = await resolveSession(token);
        if (!user) {
            res.clearCookie(SESSION_COOKIE, { path: '/' });
            next(unauthorized('Your session has expired. Please sign in again.'));
            return;
        }
        req.authUser = user;
        req.sessionToken = token;
        next();
    }
    catch (error) {
        next(error);
    }
}
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.authUser) {
            next(unauthorized());
            return;
        }
        if (!roles.includes(req.authUser.role)) {
            next(forbidden());
            return;
        }
        next();
    };
}
export function cookieOptions() {
    return {
        httpOnly: true,
        secure: config.sessionCookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: config.sessionTtlMs,
    };
}

import { changePasswordSchema, loginSchema, passwordResetConfirmSchema, passwordResetRequestSchema } from '@erniza/shared';
import { Router } from 'express';
import { config, SESSION_COOKIE } from '../../config.js';
import { getDb } from '../../db/client.js';
import { logAudit, requestAuditContext } from '../../lib/audit.js';
import { AppError, asyncHandler, badRequest, unauthorized } from '../../lib/errors.js';
import { hashPassword, hashToken, randomToken, verifyPassword } from '../../lib/password.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { passwordResetEmail, sendEmail } from '../../services/email.js';
export const authRouter = Router();
authRouter.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const db = getDb();
    const result = await db.query(`SELECT id, email, full_name, role, password_hash FROM admin_users
        WHERE lower(email) = lower($1) AND is_active = true LIMIT 1`, [email]);
    const user = result.rows[0];
    const valid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !valid) {
        throw unauthorized('Incorrect email or password.');
    }
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + config.sessionTtlMs);
    await db.transaction(async (tx) => {
        await tx.query(`INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5)`, [user.id, hashToken(token), expiresAt, req.ip, req.get('user-agent') ?? null]);
        await tx.query('UPDATE admin_users SET last_login_at = now(), updated_at = now() WHERE id = $1', [user.id]);
        await logAudit(tx, {
            actor: { id: user.id, email: user.email },
            action: 'auth.login',
            entityType: 'admin_user',
            entityId: user.id,
            ...requestAuditContext(req),
        });
    });
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: config.sessionCookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: config.sessionTtlMs,
    });
    res.json({
        data: {
            user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
            sessionToken: token,
        },
    });
}));
authRouter.post('/logout', asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] ??
        (req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization').slice(7) : undefined);
    if (token) {
        const db = getDb();
        await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ data: { success: true } });
}));
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const user = req.authUser;
    res.json({
        data: {
            user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        },
    });
}));
authRouter.post('/password-reset/request', validate(passwordResetRequestSchema), asyncHandler(async (req, res) => {
    const { email } = req.body;
    const db = getDb();
    const result = await db.query('SELECT id, email, full_name FROM admin_users WHERE lower(email) = lower($1) AND is_active = true LIMIT 1', [email]);
    const user = result.rows[0];
    if (user) {
        const token = randomToken(32);
        await db.query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '60 minutes')`, [user.id, hashToken(token)]);
        const resetUrl = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const emailContent = passwordResetEmail(user.full_name, resetUrl);
        try {
            await sendEmail({ to: user.email, ...emailContent });
        }
        catch (error) {
            // Do not leak whether the account exists; log only.
            // eslint-disable-next-line no-console
            console.error('Password reset email failed', error);
        }
    }
    // Always the same response to prevent account enumeration.
    res.json({ data: { message: 'If an account exists for that email, a reset link has been sent.' } });
}));
authRouter.post('/password-reset/confirm', validate(passwordResetConfirmSchema), asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const db = getDb();
    const result = await db.query(`SELECT t.id, t.user_id, u.email, u.full_name
         FROM password_reset_tokens t
         JOIN admin_users u ON u.id = t.user_id
        WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now()
        LIMIT 1`, [hashToken(token)]);
    const record = result.rows[0];
    if (!record)
        throw badRequest('This reset link is invalid or has expired.');
    const passwordHash = await hashPassword(password);
    await db.transaction(async (tx) => {
        await tx.query('UPDATE admin_users SET password_hash = $1, updated_at = now() WHERE id = $2', [
            passwordHash,
            record.user_id,
        ]);
        await tx.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [record.id]);
        await tx.query('DELETE FROM sessions WHERE user_id = $1', [record.user_id]);
        await logAudit(tx, {
            actor: { id: record.user_id, email: record.email },
            action: 'auth.password_reset',
            entityType: 'admin_user',
            entityId: record.user_id,
            ...requestAuditContext(req),
        });
    });
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ data: { message: 'Password updated. Please sign in.' } });
}));
authRouter.post('/change-password', requireAuth, validate(changePasswordSchema), asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.authUser;
    const db = getDb();
    const result = await db.query('SELECT password_hash FROM admin_users WHERE id = $1', [
        user.id,
    ]);
    const record = result.rows[0];
    if (!record || !(await verifyPassword(currentPassword, record.password_hash))) {
        throw new AppError(400, 'INVALID_PASSWORD', 'Your current password is incorrect.');
    }
    const hash = await hashPassword(newPassword);
    await db.transaction(async (tx) => {
        await tx.query('UPDATE admin_users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, user.id]);
        // Invalidate every other session but keep the current one.
        await tx.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [user.id, user.sessionId]);
        await logAudit(tx, {
            actor: { id: user.id, email: user.email },
            action: 'auth.password_changed',
            entityType: 'admin_user',
            entityId: user.id,
            ...requestAuditContext(req),
        });
    });
    res.json({ data: { message: 'Password changed.' } });
}));

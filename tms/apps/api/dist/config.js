import path from 'node:path';
import fs from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
// Load apps/api/.env first, then a repository-root .env as a fallback.
for (const candidate of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')]) {
    if (fs.existsSync(candidate))
        loadEnv({ path: candidate });
}
const booleanFromEnv = z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1');
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_URL: z.string().url().default('http://localhost:5173'),
    API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    LOG_LEVEL: z.string().default('info'),
    DATABASE_URL: z.string().optional(),
    DATABASE_SSL: z
        .string()
        .optional()
        .transform((value) => value !== 'false'),
    PGLITE_PATH: z.string().default('.data/pgdata'),
    SUPABASE_URL: z.string().url().optional().or(z.literal('')),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default('media'),
    UPLOAD_DIR: z.string().default('uploads'),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(8),
    SESSION_TTL_DAYS: z.coerce.number().positive().default(7),
    SESSION_COOKIE_SECURE: booleanFromEnv,
    TURNSTILE_SECRET_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Erniza Africa Safaris <no-reply@ernizaafricasafaris.com>'),
    SEED_ADMIN_EMAIL: z.string().email().default('owner@ernizaafricasafaris.com'),
    SEED_ADMIN_PASSWORD: z.string().min(10).default('Erniza#Dev2026'),
    SEED_ADMIN_NAME: z.string().default('Erniza Owner'),
});
const parsed = envSchema.parse(process.env);
export const config = {
    env: parsed.NODE_ENV,
    isProduction: parsed.NODE_ENV === 'production',
    isTest: parsed.NODE_ENV === 'test',
    port: parsed.PORT,
    appUrl: parsed.APP_URL,
    apiPublicUrl: parsed.API_PUBLIC_URL,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL,
    pglitePath: parsed.PGLITE_PATH,
    supabaseUrl: parsed.SUPABASE_URL || '',
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseBucket: parsed.SUPABASE_STORAGE_BUCKET,
    uploadDir: path.resolve(process.cwd(), parsed.UPLOAD_DIR),
    maxUploadBytes: parsed.MAX_UPLOAD_MB * 1024 * 1024,
    sessionTtlMs: parsed.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    sessionCookieSecure: parsed.SESSION_COOKIE_SECURE || parsed.NODE_ENV === 'production',
    turnstileSecret: parsed.TURNSTILE_SECRET_KEY || '',
    resendApiKey: parsed.RESEND_API_KEY || '',
    emailFrom: parsed.EMAIL_FROM,
    seedAdminEmail: parsed.SEED_ADMIN_EMAIL,
    seedAdminPassword: parsed.SEED_ADMIN_PASSWORD,
    seedAdminName: parsed.SEED_ADMIN_NAME,
    usingSupabaseStorage: Boolean(parsed.SUPABASE_URL && parsed.SUPABASE_SERVICE_ROLE_KEY),
};
export const SESSION_COOKIE = 'erniza_session';

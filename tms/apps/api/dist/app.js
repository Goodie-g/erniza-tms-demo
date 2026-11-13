import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { getDb } from './db/client.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { auditRouter } from './modules/audit/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { bookingsRouter } from './modules/bookings/routes.js';
import { activitiesRouter } from './modules/cms/activities.js';
import { categoriesRouter } from './modules/cms/categories.js';
import { destinationsRouter } from './modules/cms/destinations.js';
import { mediaRouter } from './modules/cms/media.js';
import { pagesRouter } from './modules/cms/pages.js';
import { productsRouter } from './modules/cms/products.js';
import { customersRouter } from './modules/customers/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { enquiriesRouter } from './modules/enquiries/routes.js';
import { invoicesRouter } from './modules/invoices/routes.js';
import { paymentsRouter } from './modules/payments/routes.js';
import { publicRouter } from './modules/public/routes.js';
import { quotationsRouter } from './modules/quotations/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { toursRouter } from './modules/tours/routes.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, '../../web/dist');
function originAllowed(origin) {
    if (!origin)
        return true;
    if (config.corsOrigins.includes('*'))
        return true;
    if (config.corsOrigins.includes(origin))
        return true;
    try {
        const parsed = new URL(origin);
        const configured = new URL(config.appUrl);
        if (parsed.origin === configured.origin)
            return true;
        // The static marketing site is often opened from the local file system.
        if (parsed.protocol === 'file:')
            return true;
    }
    catch {
        return false;
    }
    return false;
}
const skipRateLimit = () => config.isTest;
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 900,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipRateLimit,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' } },
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: skipRateLimit,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please wait 15 minutes.' } },
});
const publicWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipRateLimit,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many submissions. Please try again later or contact us on WhatsApp.' } },
});
export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    if (config.isProduction)
        app.set('trust proxy', 1);
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginEmbedderPolicy: false,
    }));
    app.use(pinoHttp({
        logger,
        autoLogging: {
            ignore: (req) => req.url === '/api/health' || req.url === '/api/v1/health',
        },
    }));
    app.use(cors({
        origin: (origin, callback) => {
            if (originAllowed(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`Origin ${origin} is not allowed by CORS`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }));
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: false, limit: '2mb' }));
    app.use(cookieParser());
    app.get('/api/health', healthHandler);
    app.get('/api/v1/health', healthHandler);
    app.use('/api', apiLimiter);
    app.use('/api/v1/auth/login', loginLimiter);
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/customers', customersRouter);
    app.use('/api/v1/enquiries', enquiriesRouter);
    app.use('/api/v1/invoices', invoicesRouter);
    app.use('/api/v1/quotations', quotationsRouter);
    app.use('/api/v1/bookings', bookingsRouter);
    app.use('/api/v1/payments', paymentsRouter);
    app.use('/api/v1/tours', toursRouter);
    app.use('/api/v1/cms/products', productsRouter);
    app.use('/api/v1/cms/destinations', destinationsRouter);
    app.use('/api/v1/cms/activities', activitiesRouter);
    app.use('/api/v1/cms/categories', categoriesRouter);
    app.use('/api/v1/cms/pages', pagesRouter);
    app.use('/api/v1/cms/media', mediaRouter);
    app.use('/api/v1/settings', settingsRouter);
    app.use('/api/v1/dashboard', dashboardRouter);
    app.use('/api/v1/reports', reportsRouter);
    app.use('/api/v1/audit-logs', auditRouter);
    app.use('/api/v1/public/enquiries', publicWriteLimiter);
    app.use('/api/v1/public', publicRouter);
    fs.mkdirSync(config.uploadDir, { recursive: true });
    app.use('/uploads', express.static(config.uploadDir, {
        maxAge: '1y',
        immutable: true,
        fallthrough: false,
        index: false,
    }));
    // Serve the built admin SPA (single service deployment). The marketing site
    // remains a separate static deployment and is not affected by this fallback.
    if (fs.existsSync(path.join(webDist, 'index.html'))) {
        app.use(express.static(webDist, {
            index: false,
            maxAge: '1h',
            setHeaders: (res, filePath) => {
                if (filePath.endsWith('index.html'))
                    res.setHeader('Cache-Control', 'no-cache');
            },
        }));
        app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(path.join(webDist, 'index.html'));
        });
    }
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
async function healthHandler(_req, res) {
    try {
        await getDb().query('SELECT 1');
        res.json({
            data: {
                status: 'ok',
                service: 'erniza-api',
                environment: config.env,
                database: config.databaseUrl ? 'postgres' : 'pglite',
                storage: config.usingSupabaseStorage ? 'supabase' : 'local',
                uptimeSeconds: Math.round(process.uptime()),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        logger.error({ err: error }, 'Health check failed');
        res.status(503).json({
            data: { status: 'degraded', service: 'erniza-api', timestamp: new Date().toISOString() },
        });
    }
}

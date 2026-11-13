import { ZodError } from 'zod';
import { AppError, zodDetails } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.originalUrl}` },
    });
}
export function errorHandler(error, req, res, _next) {
    if (error instanceof ZodError) {
        res.status(422).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Please correct the highlighted fields',
                details: zodDetails(error),
            },
        });
        return;
    }
    if (error instanceof AppError) {
        if (error.status >= 500)
            logger.error({ err: error, path: req.originalUrl }, error.message);
        res.status(error.status).json({
            error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
        });
        return;
    }
    // Multer and database constraint errors are mapped to safe messages.
    const maybeCode = error?.code;
    if (maybeCode === '23505') {
        res.status(409).json({
            error: { code: 'DUPLICATE', message: 'A record with these details already exists.' },
        });
        return;
    }
    if (maybeCode === '23503') {
        res.status(409).json({
            error: { code: 'IN_USE', message: 'This record is referenced by other records and cannot be changed.' },
        });
        return;
    }
    if (maybeCode === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'The uploaded file is too large.' } });
        return;
    }
    logger.error({ err: error, path: req.originalUrl }, 'Unhandled request error');
    const message = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again.'
        : error?.message || 'Unexpected error';
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
}

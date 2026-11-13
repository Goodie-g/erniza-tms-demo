import { ZodError } from 'zod';
import { unprocessable, zodDetails } from '../lib/errors.js';
export function validate(schema, source = 'body') {
    return (req, _res, next) => {
        try {
            const raw = req[source];
            const providedKeys = source === 'body' && raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw) : undefined;
            const parsed = schema.parse(raw);
            if (source === 'query') {
                // Express 5 exposes a getter-only query property; assign known fields safely.
                Object.assign(req.query, parsed);
            }
            else {
                req[source] = parsed;
            }
            if (providedKeys) {
                req.providedBodyKeys = providedKeys;
            }
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                next(unprocessable('Please correct the highlighted fields', zodDetails(error)));
                return;
            }
            next(error);
        }
    };
}
export function providedKeys(req) {
    return req.providedBodyKeys;
}

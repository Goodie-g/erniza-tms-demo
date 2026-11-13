import crypto from 'node:crypto';
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
function scryptAsync(password, salt, keyLength, options) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, keyLength, options, (error, derivedKey) => {
            if (error)
                reject(error);
            else
                resolve(derivedKey);
        });
    });
}
export async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const key = await scryptAsync(password, salt, KEY_LENGTH, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: 64 * 1024 * 1024,
    });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt')
        return false;
    const [, n, r, p, saltHex, hashHex] = parts;
    try {
        const salt = Buffer.from(saltHex, 'hex');
        const expected = Buffer.from(hashHex, 'hex');
        const actual = await scryptAsync(password, salt, expected.length, {
            N: Number(n),
            r: Number(r),
            p: Number(p),
            maxmem: 64 * 1024 * 1024,
        });
        return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    }
    catch {
        return false;
    }
}
export function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const ENCODING = 'base64' as const;

/**
 * Derives a 32-byte (256-bit) key buffer from the ENCRYPTION_KEY env variable.
 * Accepts either a raw 64-char hex string or any passphrase (derived via scrypt).
 * @returns {Buffer} 32-byte AES key
 */
function getKey(): Buffer {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('[Monito] ENCRYPTION_KEY is not set in environment variables.');
    }
    // If it looks like a 64-char hex string, use it directly as 32 bytes
    if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    // Otherwise derive 32 bytes via scrypt
    return crypto.scryptSync(raw, 'monito_aes_salt_v1', 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all base64 encoded, colon-separated).
 *
 * @param {string} plaintext - The raw string to encrypt
 * @returns {string} Cryptic ciphertext safe to store in the database
 */
export function encryptSecret(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);

    const authTag = cipher.getAuthTag().toString(ENCODING);

    return `${iv.toString(ENCODING)}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext string back to plaintext.
 * Expects the format produced by encryptSecret(): iv:authTag:ciphertext.
 *
 * @param {string} ciphertext - The stored cryptic string
 * @returns {string} Recovered plaintext secret
 */
export function decryptSecret(ciphertext: string): string {
    const key = getKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
        throw new Error('[Monito] Invalid ciphertext format. Expected iv:authTag:ciphertext.');
    }

    const iv        = Buffer.from(parts[0] as string, ENCODING);
    const authTag   = Buffer.from(parts[1] as string, ENCODING);
    const encrypted = Buffer.from(parts[2] as string, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted).toString('utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

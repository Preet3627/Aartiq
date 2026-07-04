export class EncryptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EncryptionError';
    }
}

export class DecryptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DecryptionError';
    }
}

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const PREFIX = 'E2EE2:';

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt.buffer as ArrayBuffer,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

function base64Decode(str: string): Uint8Array {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function base64Encode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export async function encrypt(text: string, passphrase: string): Promise<string> {
    if (!passphrase || passphrase.length < 8) {
        throw new EncryptionError('A passphrase of at least 8 characters is required.');
    }

    try {
        const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
        const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
        const key = await deriveKey(passphrase, salt);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
            key,
            new TextEncoder().encode(text)
        );

        const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

        const combinedBuf = new Uint8Array(combined);

        return `${PREFIX}${base64Encode(combinedBuf)}`;
    } catch (e) {
        throw new EncryptionError(`Encryption failed: ${(e as Error).message}`);
    }
}

export async function decrypt(encoded: string, passphrase: string): Promise<string> {
    if (!encoded.startsWith(PREFIX)) {
        throw new DecryptionError('Unrecognized ciphertext format.');
    }
    if (!passphrase) {
        throw new DecryptionError('Passphrase is required.');
    }

    try {
        const combined = base64Decode(encoded.slice(PREFIX.length));
        const salt = combined.slice(0, SALT_BYTES);
        const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
        const ciphertext = combined.slice(SALT_BYTES + IV_BYTES);

        const key = await deriveKey(passphrase, salt);
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
            key,
            ciphertext
        );

        return new TextDecoder().decode(plaintext);
    } catch {
        throw new DecryptionError('Decryption failed: wrong passphrase or corrupted data.');
    }
}

export function encodeLocalOnly(text: string): string {
    return `PLAINTEXT_LOCAL:${base64Encode(new TextEncoder().encode(text))}`;
}

export function isCiphertext(encoded: string): boolean {
    return encoded.startsWith(PREFIX);
}

export function migrateLegacyBlob(encoded: string): { prefix: string; data: string } | null {
    if (encoded.startsWith('LCL:')) {
        return { prefix: 'LCL:', data: encoded.slice(4) };
    }
    if (encoded.startsWith('E2EE:')) {
        return { prefix: 'E2EE:', data: encoded.slice(5) };
    }
    return null;
}

export async function decryptLegacyBlob(encoded: string, passphrase: string): Promise<string> {
    const blob = migrateLegacyBlob(encoded);
    if (!blob) {
        throw new DecryptionError('Not a legacy-format blob.');
    }

    if (blob.prefix === 'LCL:') {
        try {
            const decoded = base64Decode(blob.data);
            return new TextDecoder().decode(decoded);
        } catch {
            throw new DecryptionError('Failed to decode LCL: blob.');
        }
    }

    if (blob.prefix === 'E2EE:') {
        if (!passphrase) {
            throw new DecryptionError('Passphrase required to decrypt E2EE: blob.');
        }
        try {
            const raw = base64Decode(blob.data);
            const iv = raw.slice(0, 12);
            const ciphertext = raw.slice(12);

            const keyData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
            const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

            const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            return new TextDecoder().decode(plaintext);
        } catch (e) {
            throw new DecryptionError(`Legacy decryption failed: ${(e as Error).message}`);
        }
    }

    throw new DecryptionError('Unknown legacy blob format.');
}

export async function migrateToNewFormat(encoded: string, newPassphrase: string, oldPassphrase?: string): Promise<string> {
    const blob = migrateLegacyBlob(encoded);
    if (!blob) {
        return encoded;
    }

    let plaintext: string;
    if (blob.prefix === 'LCL:') {
        plaintext = await decryptLegacyBlob(encoded, '');
    } else {
        if (!oldPassphrase) {
            throw new DecryptionError('Old passphrase required to migrate E2EE: blob.');
        }
        plaintext = await decryptLegacyBlob(encoded, oldPassphrase);
    }

    return encrypt(plaintext, newPassphrase);
}

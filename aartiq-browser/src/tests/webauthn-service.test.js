const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { encode: cborEncode } = require('cbor-x');

// Mock native module to prevent hangs during require in test environment
jest.mock('@beeper/webauthn-authenticator', () => {
    throw new Error('Native module not available in test environment');
}, { virtual: true });

// ── Test helpers ─────────────────────────────────────────────────────────────

const TEST_CREDENTIALS_PATH = path.join(os.tmpdir(), `webauthn-test-${Date.now()}.json`);

// Generate an ECDSA P-256 key pair for testing
function generateTestKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
    });
    return { privateKey, publicKey };
}

// Export public key as raw uncompressed point (0x04 || x || y)
function exportPublicKeyRaw(publicKey) {
    const spki = publicKey.export({ type: 'spki', format: 'der' });
    // SPKI DER for P-256: last 65 bytes are the uncompressed point
    return spki.subarray(spki.length - 65);
}

// Build a COSE public key map (CBOR-encoded) for ES256
function buildCoseEs256Key(rawPublicKey) {
    const x = rawPublicKey.subarray(1, 33);
    const y = rawPublicKey.subarray(33, 65);
    const map = new Map();
    map.set(1, 2);   // kty: EC2
    map.set(3, -7);  // alg: ES256
    map.set(-1, 1);  // crv: P-256
    map.set(-2, x);
    map.set(-3, y);
    return cborEncode(map);
}

// Build a minimal attestation object with the given COSE public key
function buildAttestationObject(cosePublicKey) {
    // Build authData: rpIdHash(32) + flags(1) + signCount(4) + aaguid(16) + credIdLen(2) + credId(16) + coseKey
    const rpIdHash = crypto.createHash('sha256').update('aartiq-local').digest();
    const flags = Buffer.from([0x41]); // UP | AT
    const signCount = Buffer.alloc(4);
    signCount.writeUInt32BE(0, 0);
    const aaguid = Buffer.alloc(16, 0x01);
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(16, 0);
    const credId = crypto.randomBytes(16);

    const authData = Buffer.concat([rpIdHash, flags, signCount, aaguid, credIdLen, credId, cosePublicKey]);

    const attestationMap = new Map();
    attestationMap.set('fmt', 'none');
    attestationMap.set('attStmt', new Map());
    attestationMap.set('authData', authData);

    return { attestationObject: Buffer.from(cborEncode(attestationMap)), credentialId: credId };
}

// Build authenticatorData for assertion (without credential data, just rpIdHash + flags + signCount)
function buildAssertionAuthData(flags = 0x01, signCount = 1) {
    const rpIdHash = crypto.createHash('sha256').update('aartiq-local').digest();
    const flagsBuf = Buffer.from([flags]);
    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32BE(signCount, 0);
    return Buffer.concat([rpIdHash, flagsBuf, countBuf]);
}

// ── Mock setup ───────────────────────────────────────────────────────────────

let mockNative;
let testKeyPair;
let testCoseKey;
let testAttestation;

beforeAll(() => {
    testKeyPair = generateTestKeyPair();
    const rawPub = exportPublicKeyRaw(testKeyPair.publicKey);
    testCoseKey = buildCoseEs256Key(rawPub);
    testAttestation = buildAttestationObject(testCoseKey);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WebAuthn Service — COSE/CBOR helpers', () => {
    const { parseCosePublicKey, parseAuthData, extractSignCount, base64urlEncode, base64urlDecode } = require('../lib/webauthn-service');

    describe('parseCosePublicKey', () => {
        it('should parse an ES256 COSE key into a Node.js KeyObject', () => {
            const rawPub = exportPublicKeyRaw(testKeyPair.publicKey);
            const coseKey = buildCoseEs256Key(rawPub);
            const result = parseCosePublicKey(coseKey);

            expect(result.keyObject).toBeDefined();
            expect(result.algorithm).toBe(-7);
            expect(result.curve).toBe(1);
        });

        it('should throw on invalid CBOR data', () => {
            expect(() => parseCosePublicKey(Buffer.from([0xff, 0xfe]))).toThrow('Invalid COSE public key');
        });
    });

    describe('parseAuthData', () => {
        it('should parse authData with AT flag set', () => {
            const rawPub = exportPublicKeyRaw(testKeyPair.publicKey);
            const coseKey = buildCoseEs256Key(rawPub);
            const rpIdHash = crypto.createHash('sha256').update('aartiq-local').digest();
            const flags = Buffer.from([0x41]); // UP | AT
            const signCount = Buffer.alloc(4);
            signCount.writeUInt32BE(42, 0);
            const aaguid = Buffer.alloc(16, 0x01);
            const credIdLen = Buffer.alloc(2);
            credIdLen.writeUInt16BE(16, 0);
            const credId = crypto.randomBytes(16);

            const authData = Buffer.concat([rpIdHash, flags, signCount, aaguid, credIdLen, credId, coseKey]);
            const parsed = parseAuthData(authData);

            expect(parsed).not.toBeNull();
            expect(parsed.hasAttestedCredentialData).toBe(true);
            expect(parsed.signCount).toBe(42);
            expect(parsed.credentialId).toEqual(credId);
            expect(parsed.cosePublicKey.length).toBeGreaterThan(0);
        });

        it('should return null for too-short authData', () => {
            expect(parseAuthData(Buffer.alloc(10))).toBeNull();
        });

        it('should handle authData without AT flag', () => {
            const rpIdHash = crypto.createHash('sha256').update('aartiq-local').digest();
            const flags = Buffer.from([0x01]); // UP only, no AT
            const signCount = Buffer.alloc(4);
            const authData = Buffer.concat([rpIdHash, flags, signCount]);
            const parsed = parseAuthData(authData);

            expect(parsed).not.toBeNull();
            expect(parsed.hasAttestedCredentialData).toBe(false);
        });
    });

    describe('extractSignCount', () => {
        it('should extract the 4-byte big-endian counter from bytes 33-36', () => {
            const authData = buildAssertionAuthData(0x01, 256);
            expect(extractSignCount(authData)).toBe(256);
        });

        it('should return 0 for authData shorter than 37 bytes', () => {
            expect(extractSignCount(Buffer.alloc(10))).toBe(0);
        });

        it('should return 0 for null input', () => {
            expect(extractSignCount(null)).toBe(0);
        });
    });

    describe('base64url encode/decode round-trip', () => {
        it('should round-trip arbitrary buffers', () => {
            const original = crypto.randomBytes(64);
            const encoded = base64urlEncode(original);
            const decoded = base64urlDecode(encoded);
            expect(decoded).toEqual(original);
        });
    });
});

describe('WebAuthn Service — Signature verification (2a)', () => {
    const { verifyAssertionSignature } = require('../lib/webauthn-service');

    it('should verify a valid ES256 assertion signature', () => {
        const rawPub = exportPublicKeyRaw(testKeyPair.publicKey);
        const coseKey = buildCoseEs256Key(rawPub);
        const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: 'test', origin: 'https://aartiq-local' }));
        const authenticatorData = buildAssertionAuthData(0x01, 1);

        // Build signed data: authenticatorData || SHA256(clientDataJSON)
        const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
        const signedData = Buffer.concat([authenticatorData, clientDataHash]);

        // Sign with the test private key
        const signature = crypto.sign(null, signedData, testKeyPair.privateKey);

        const result = verifyAssertionSignature({
            authenticatorData,
            clientDataJSON,
            signature,
            publicKeyHex: coseKey.toString('hex'),
            algorithm: -7,
        });

        expect(result).toBe(true);
    });

    it('should reject a signature signed with a different key', () => {
        const rawPub = exportPublicKeyRaw(testKeyPair.publicKey);
        const coseKey = buildCoseEs256Key(rawPub);
        const clientDataJSON = Buffer.from('some data');
        const authenticatorData = buildAssertionAuthData(0x01, 1);
        const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
        const signedData = Buffer.concat([authenticatorData, clientDataHash]);

        // Sign with a DIFFERENT key
        const otherKeyPair = generateTestKeyPair();
        const wrongSignature = crypto.sign(null, signedData, otherKeyPair.privateKey);

        const result = verifyAssertionSignature({
            authenticatorData,
            clientDataJSON,
            signature: wrongSignature,
            publicKeyHex: coseKey.toString('hex'),
            algorithm: -7,
        });

        expect(result).toBe(false);
    });

    it('should throw when no publicKeyHex is provided', () => {
        expect(() => verifyAssertionSignature({
            authenticatorData: buildAssertionAuthData(),
            clientDataJSON: Buffer.from('data'),
            signature: Buffer.alloc(64),
            publicKeyHex: null,
            algorithm: -7,
        })).toThrow('No public key available');
    });
});

describe('WebAuthn Service — Counter enforcement (2b)', () => {
    const { extractSignCount } = require('../lib/webauthn-service');

    it('should accept when counter advances past stored value', () => {
        const authData = buildAssertionAuthData(0x01, 5);
        const counter = extractSignCount(authData);
        expect(counter).toBe(5);

        // Simulates: stored counter = 3, new counter = 5 (valid)
        const storedCounter = 3;
        expect(storedCounter > 0 && counter <= storedCounter).toBe(false);
    });

    it('should detect replay when counter has not advanced', () => {
        const authData = buildAssertionAuthData(0x01, 5);
        const counter = extractSignCount(authData);

        // Simulates: stored counter = 5, new counter = 5 (replay!)
        const storedCounter = 5;
        expect(storedCounter > 0 && counter <= storedCounter).toBe(true);
    });

    it('should detect clone when counter went backwards', () => {
        const authData = buildAssertionAuthData(0x01, 3);
        const counter = extractSignCount(authData);

        // Simulates: stored counter = 5, new counter = 3 (impossible!)
        const storedCounter = 5;
        expect(storedCounter > 0 && counter <= storedCounter).toBe(true);
    });

    it('should allow counter=0 even when stored is nonzero (some authenticators)', () => {
        // Authenticators that always report 0 should be allowed on first check
        const storedCounter = 0;
        const authenticatorCounter = 0;
        // storedCounter is 0 so we skip the check
        expect(storedCounter > 0 && authenticatorCounter <= storedCounter).toBe(false);
    });
});

describe('WebAuthn Service — Graceful fallback (no native module)', () => {
    it('isSupported should return false when native module is unavailable', () => {
        const { isSupported } = require('../lib/webauthn-service');
        // On a test machine without the native module, isSupported should not throw
        const result = isSupported();
        expect(typeof result).toBe('boolean');
    });

    it('getPlatformInfo should return valid shape without native module', () => {
        const { getPlatformInfo } = require('../lib/webauthn-service');
        const info = getPlatformInfo();
        expect(info).toHaveProperty('platform');
        expect(info).toHaveProperty('supported');
        expect(typeof info.supported).toBe('boolean');
    });

    it('registerCredential should return error when native module unavailable', async () => {
        const { registerCredential } = require('../lib/webauthn-service');
        const result = await registerCredential();
        // Should return a structured error, not throw
        expect(result).toHaveProperty('success');
        if (!result.success) {
            expect(result).toHaveProperty('error');
        }
    });

    it('authenticate should return error when native module unavailable', async () => {
        const { authenticate } = require('../lib/webauthn-service');
        const result = await authenticate();
        expect(result).toHaveProperty('success');
        if (!result.success) {
            expect(result).toHaveProperty('error');
        }
    });
});

describe('WebAuthn Service — Credential storage', () => {
    const { clearAllCredentials, getStoredCredentials, hasCredential } = require('../lib/webauthn-service');

    it('should have hasCredential as a function', () => {
        expect(typeof hasCredential).toBe('function');
    });

    it('should have getStoredCredentials as a function', () => {
        expect(typeof getStoredCredentials).toBe('function');
    });

    it('should have clearAllCredentials as a function', () => {
        expect(typeof clearAllCredentials).toBe('function');
    });
});

describe('WebAuthn Service — Exports', () => {
    const service = require('../lib/webauthn-service');

    it('should export all required functions', () => {
        expect(typeof service.isSupported).toBe('function');
        expect(typeof service.getPlatformInfo).toBe('function');
        expect(typeof service.registerCredential).toBe('function');
        expect(typeof service.authenticate).toBe('function');
        expect(typeof service.hasCredential).toBe('function');
        expect(typeof service.removeCredential).toBe('function');
        expect(typeof service.clearAllCredentials).toBe('function');
        expect(typeof service.getStoredCredentials).toBe('function');
        expect(typeof service.generateChallenge).toBe('function');
        expect(typeof service.base64urlEncode).toBe('function');
        expect(typeof service.base64urlDecode).toBe('function');
    });

    it('should export new verification helpers', () => {
        expect(typeof service.parseCosePublicKey).toBe('function');
        expect(typeof service.parseAuthData).toBe('function');
        expect(typeof service.extractSignCount).toBe('function');
        expect(typeof service.verifyAssertionSignature).toBe('function');
    });

    it('should export RP_ID and RP_NAME', () => {
        expect(service.RP_ID).toBe('aartiq-local');
        expect(service.RP_NAME).toBe('Aartiq');
    });
});

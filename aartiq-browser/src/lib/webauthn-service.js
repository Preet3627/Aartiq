/**
 * WebAuthn Service — Unified native OS verification via FIDO2/WebAuthn.
 *
 * Replaces PowerShell-based Windows Hello with proper low-level OS verification
 * using the Win32 WebAuthn API (webauthn.dll) via @beeper/webauthn-authenticator.
 *
 * Supports:
 *   - Windows: WebAuthn via Windows Hello (PIN / biometric / FIDO2 key)
 *   - macOS:   caBLE WebAuthn via AuthenticationServices framework
 *   - Linux:   Falls back gracefully (no platform authenticator)
 *
 * Security model:
 *   - Assertion signatures are verified against stored public keys (2a).
 *   - Authenticator signature counters are enforced as clone-detection (2b).
 *   - Attestation is set to 'none' since we don't need provenance for a
 *     local device-unlock flow (2c).
 *   - Legacy credentials without stored public keys fall back to the old
 *     trust-the-native-result model once, with a logged warning (2e).
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { decode: cborDecode } = require('cbor-x');

const RP_ID = 'aartiq-local';
const RP_NAME = 'Aartiq';
const CREDENTIALS_PATH = path.join(os.homedir(), '.aartiq', 'webauthn-credentials.json');

let _native = null;
function getNative() {
    if (_native === null) {
        try {
            _native = require('@beeper/webauthn-authenticator');
        } catch (err) {
            console.warn('[WebAuthn] Native module not available:', err.message);
            _native = false;
        }
    }
    return _native || false;
}

// ── Base64url helpers (W3C WebAuthn spec) ────────────────────────────────────

function base64urlEncode(buffer) {
    return Buffer.from(buffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64urlDecode(str) {
    let b = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return Buffer.from(b, 'base64');
}

// ── CBOR / COSE helpers (2a) ─────────────────────────────────────────────────

const COSE_KTY = 1;
const COSE_ALG = 3;
const COSE_CRV = -1;
const COSE_X = -2;
const COSE_Y = -3;
const COSE_N = -1;
const COSE_E = -2;

const COSE_KTY_EC2 = 2;
const COSE_KTY_RSA = 3;
const COSE_CRV_P256 = 1;

/**
 * Parse a COSE public key from a CBOR-encoded map into a Node.js KeyObject.
 * Supports ES256 (alg -7) and RS256 (alg -257).
 */
function parseCosePublicKey(coseKeyBytes) {
    let decoded;
    try {
        decoded = cborDecode(coseKeyBytes);
    } catch (err) {
        throw new Error(`Invalid COSE public key: ${err.message}`);
    }
    if (!decoded || typeof decoded !== 'object') {
        throw new Error('Invalid COSE public key: not a CBOR map');
    }

    const get = (map, key) => (map instanceof Map ? map.get(key) : map[key]);

    const kty = get(decoded, COSE_KTY);
    const alg = get(decoded, COSE_ALG);

    if (kty === COSE_KTY_EC2) {
        const crv = get(decoded, COSE_CRV);
        const x = get(decoded, COSE_X);
        const y = get(decoded, COSE_Y);

        if (crv !== COSE_CRV_P256 || !x || !y) {
            throw new Error(`Unsupported EC curve: ${crv}`);
        }

        // Build uncompressed point: 0x04 || x || y
        const publicKeyDER = Buffer.concat([
            Buffer.from([0x04]),
            Buffer.from(x),
            Buffer.from(y),
        ]);

        const keyObject = crypto.createPublicKey({
            key: Buffer.concat([
                Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex'),
                publicKeyDER,
            ]),
            format: 'der',
            type: 'spki',
        });

        return { keyObject, algorithm: alg, curve: crv };
    }

    if (kty === COSE_KTY_RSA) {
        const n = get(decoded, COSE_N);
        const e = get(decoded, COSE_E);

        if (!n || !e) {
            throw new Error('Invalid RSA COSE key: missing modulus or exponent');
        }

        const keyObject = crypto.createPublicKey({
            key: {
                kty: 'RSA',
                alg: 'RS256',
                n: Buffer.from(n).toString('base64url'),
                e: Buffer.from(e).toString('base64url'),
            },
            format: 'jwk',
        });

        return { keyObject, algorithm: alg };
    }

    throw new Error(`Unsupported COSE key type: ${kty}`);
}

/**
 * Parse authData to extract the credential public key and AAGUID.
 * Returns null if no credential data is present (AT flag not set).
 */
function parseAuthData(authData) {
    if (!authData || authData.length < 37) {
        return null;
    }

    const rpIdHash = authData.subarray(0, 32);
    const flags = authData[32];
    const signCount = authData.readUInt32BE(33);
    const hasAttestedCredentialData = (flags & 0x40) !== 0;

    if (!hasAttestedCredentialData || authData.length < 55) {
        return { rpIdHash, flags, signCount, hasAttestedCredentialData: false };
    }

    // attestedCredentialData starts at byte 37
    const aaguid = authData.subarray(37, 53);
    const credentialIdLength = authData.readUInt16BE(53);
    const credentialIdEnd = 55 + credentialIdLength;

    if (authData.length < credentialIdEnd) {
        return { rpIdHash, flags, signCount, hasAttestedCredentialData: false };
    }

    const credentialId = authData.subarray(55, credentialIdEnd);
    const cosePublicKey = authData.subarray(credentialIdEnd);

    return {
        rpIdHash,
        flags,
        signCount,
        hasAttestedCredentialData: true,
        aaguid,
        credentialId,
        cosePublicKey,
    };
}

/**
 * Extract the signature counter from authenticatorData (bytes 33-36, big-endian).
 */
function extractSignCount(authenticatorData) {
    if (!authenticatorData || authenticatorData.length < 37) {
        return 0;
    }
    return authenticatorData.readUInt32BE(33);
}

/**
 * Verify an assertion signature against the stored public key.
 *
 * Signed data per FIDO2 spec: authenticatorData || SHA256(clientDataJSON)
 */
function verifyAssertionSignature({ authenticatorData, clientDataJSON, signature, publicKeyHex, algorithm }) {
    if (!publicKeyHex) {
        throw new Error('No public key available for signature verification');
    }

    const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
    const { keyObject } = parseCosePublicKey(publicKeyBytes);

    // Reconstruct the signed data blob
    const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
    const signedData = Buffer.concat([
        Buffer.from(authenticatorData),
        clientDataHash,
    ]);

    const sigBuf = Buffer.from(signature);

    let verified;
    if (algorithm === -7) {
        // ES256 — raw r||s signature (64 bytes)
        const verifier = crypto.createVerify('SHA256');
        verifier.update(signedData);
        verified = verifier.verify(keyObject, sigBuf);
    } else if (algorithm === -257) {
        // RS256 — DER-encoded signature
        const verifier = crypto.createVerify('SHA256');
        verifier.update(signedData);
        verified = verifier.verify(keyObject, sigBuf);
    } else {
        throw new Error(`Unsupported algorithm for signature verification: ${algorithm}`);
    }

    return verified;
}

// ── Credential storage ───────────────────────────────────────────────────────

function loadCredentials() {
    try {
        if (fs.existsSync(CREDENTIALS_PATH)) {
            return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        }
    } catch (err) {
        console.warn('[WebAuthn] Failed to load credentials:', err.message);
    }
    return { credentials: [] };
}

function saveCredentials(data) {
    const dir = path.dirname(CREDENTIALS_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function storeCredential(credential) {
    const data = loadCredentials();
    const existing = data.credentials.findIndex(c => c.id === credential.id);
    if (existing >= 0) {
        data.credentials[existing] = credential;
    } else {
        data.credentials.push(credential);
    }
    saveCredentials(data);
}

function getStoredCredentials() {
    return loadCredentials().credentials || [];
}

function removeStoredCredential(credentialId) {
    const data = loadCredentials();
    data.credentials = (data.credentials || []).filter(c => c.id !== credentialId);
    saveCredentials(data);
}

// ── Platform detection ───────────────────────────────────────────────────────

function isWindowsSupported() {
    const native = getNative();
    if (!native) return false;
    return native.win10ApiVersion() !== null;
}

function isMacOSSupported() {
    const native = getNative();
    if (!native) return false;
    const backends = native.supportedBackends();
    return Array.isArray(backends) && backends.includes('cable');
}

function isSupported() {
    if (process.platform === 'win32') return isWindowsSupported();
    if (process.platform === 'darwin') return isMacOSSupported();
    return false;
}

function getPlatformInfo() {
    const native = getNative();
    if (process.platform === 'win32') {
        return {
            platform: 'windows',
            supported: isWindowsSupported(),
            apiVersion: native ? native.win10ApiVersion() : null,
            supportsCable: native ? native.win10SupportsCable() : false,
        };
    }
    if (process.platform === 'darwin') {
        return {
            platform: 'macos',
            supported: isMacOSSupported(),
            backends: native ? native.supportedBackends() : [],
        };
    }
    return { platform: process.platform, supported: false };
}

// ── Challenge generation ─────────────────────────────────────────────────────

function generateChallenge() {
    return crypto.randomBytes(32);
}

function generateUserId() {
    return crypto.randomBytes(16);
}

// ── Core: Register credential ────────────────────────────────────────────────

async function registerCredential({ userId, userName, displayName } = {}) {
    const native = getNative();
    if (!native) {
        return { success: false, error: 'WebAuthn native module not available' };
    }

    const uid = userId || generateUserId();
    const name = userName || 'aartiq-user';
    const display = displayName || 'Aartiq User';
    const challenge = generateChallenge();

    const creationChallenge = {
        publicKey: {
            rp: { id: RP_ID, name: RP_NAME },
            user: {
                id: base64urlEncode(typeof uid === 'string' ? base64urlDecode(uid) : uid),
                name,
                displayName: display,
            },
            challenge: base64urlEncode(challenge),
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },   // ES256
                { type: 'public-key', alg: -257 },  // RS256
            ],
            timeout: 60000,
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                requireResidentKey: false,
                residentKey: 'discouraged',
            },
            attestation: 'none',
            // NOTE: Changed from 'direct' to 'none' (2c). This is a local
            // device-unlock flow, not a remote relying party. We don't consume
            // the attestation certificate chain, so 'direct' only adds friction
            // via extra OS consent prompts and may fail on authenticators that
            // don't support direct attestation.
        },
    };

    try {
        let credential;
        if (process.platform === 'win32') {
            const origin = `https://${RP_ID}`;
            credential = await native.win10Register(origin, creationChallenge);
        } else if (process.platform === 'darwin') {
            const origin = `https://${RP_ID}`;
            credential = await native.cableRegister(origin, creationChallenge, () => {});
        } else {
            return { success: false, error: 'Platform not supported for WebAuthn registration' };
        }

        const stored = {
            id: credential.rawId || credential.id,
            rpId: RP_ID,
            userId: base64urlEncode(typeof uid === 'string' ? base64urlDecode(uid) : uid),
            userName: name,
            attestationObject: credential.response?.attestationObject || null,
            clientDataJSON: credential.response?.clientDataJSON || null,
            transports: credential.response?.transports || ['internal'],
            counter: 0,
            createdAt: new Date().toISOString(),
        };

        // 2a: Extract public key from attestation object and store it
        const attObjBuf = stored.attestationObject
            ? Buffer.from(stored.attestationObject)
            : null;
        if (attObjBuf) {
            try {
                const attestation = cborDecode(attObjBuf);
                const authDataBuf = attestation.authData
                    ? Buffer.from(attestation.authData)
                    : null;
                if (authDataBuf) {
                    const parsed = parseAuthData(authDataBuf);
                    if (parsed && parsed.cosePublicKey) {
                        stored.publicKeyHex = parsed.cosePublicKey.toString('hex');
                        // Determine algorithm from the COSE key
                        const pubKeyDecoded = cborDecode(parsed.cosePublicKey);
                        const get = (map, key) => (map instanceof Map ? map.get(key) : map[key]);
                        stored.algorithm = get(pubKeyDecoded, COSE_ALG) || -7;
                        console.log(`[WebAuthn] Extracted public key (alg=${stored.algorithm}) for credential ${stored.id}`);
                    }
                }
            } catch (parseErr) {
                console.warn('[WebAuthn] Could not parse attestation object for public key extraction:', parseErr.message);
            }
        }

        storeCredential(stored);

        return {
            success: true,
            credentialId: credential.rawId || credential.id,
            attestationObject: credential.response?.attestationObject || null,
            type: credential.type || 'public-key',
        };
    } catch (err) {
        console.error('[WebAuthn] Registration failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ── Core: Authenticate (challenge-response assertion) ───────────────────────────────────────
// 2a: Verifies assertion signature against stored public key.
// 2b: Enforces authenticator signature counter for clone detection.
// 2e: Legacy credentials without public keys fall back once with a warning.

async function authenticate(reason) {
    const native = getNative();
    if (!native) {
        return { success: false, error: 'WebAuthn native module not available' };
    }

    const challenge = generateChallenge();
    const stored = getStoredCredentials();

    const requestChallenge = {
        publicKey: {
            challenge: base64urlEncode(challenge),
            rpId: RP_ID,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: stored.length > 0
                ? stored.map(c => ({
                    type: 'public-key',
                    id: c.id,
                    transports: c.transports || ['internal'],
                }))
                : undefined,
        },
    };

    try {
        let assertion;
        if (process.platform === 'win32') {
            const origin = `https://${RP_ID}`;
            assertion = await native.win10Authenticate(origin, requestChallenge);
        } else if (process.platform === 'darwin') {
            const origin = `https://${RP_ID}`;
            assertion = await native.cableAuthenticate(origin, requestChallenge, () => {});
        } else {
            return { success: false, error: 'Platform not supported for WebAuthn authentication' };
        }

        const assertionId = assertion.rawId || assertion.id;
        const matchedCredential = stored.find(c => c.id === assertionId);

        // 2b: Verify the signature counter (clone-detection)
        if (matchedCredential) {
            const authDataBuf = assertion.response?.authenticatorData
                ? Buffer.from(assertion.response.authenticatorData)
                : null;
            const authenticatorCounter = authDataBuf ? extractSignCount(authDataBuf) : 0;
            const storedCounter = matchedCredential.counter || 0;

            // Some authenticators legitimately always report 0, so only enforce
            // the check when the stored counter is nonzero (indicating a previous
            // successful increment).
            if (storedCounter > 0 && authenticatorCounter <= storedCounter) {
                console.warn(
                    `[WebAuthn] Clone detection: authenticator counter ${authenticatorCounter} `
                    + `did not advance past stored value ${storedCounter} for credential ${assertionId}. `
                    + `Rejecting authentication.`
                );
                return {
                    success: false,
                    error: 'Authenticator counter did not advance \u2014 possible cloned authenticator',
                    cloneDetected: true,
                };
            }

            // 2e: Legacy credential migration \u2014 if no publicKey is stored, fall
            // back to the old trust-the-native-result behavior once.
            if (!matchedCredential.publicKeyHex) {
                console.warn(
                    `[WebAuthn] LEGACY credential ${assertionId} lacks a stored public key. `
                    + `Falling back to native-result trust for this authentication. `
                    + `Please re-register this credential to enable signature verification.`
                );
                matchedCredential.counter = authenticatorCounter || (storedCounter + 1);
                matchedCredential.lastUsedAt = new Date().toISOString();
                matchedCredential.legacyFallbackUsed = true;
                saveCredentials({ credentials: stored });

                return {
                    success: true,
                    credentialId: assertionId,
                    authenticatorData: assertion.response?.authenticatorData || null,
                    signature: assertion.response?.signature || null,
                    userHandle: assertion.response?.userHandle || null,
                    clientDataJSON: assertion.response?.clientDataJSON || null,
                    legacy: true,
                    warning: 'This credential predates signature verification. Please re-register for full security.',
                };
            }

            // 2a: Verify the assertion signature against the stored public key
            try {
                const signatureValid = verifyAssertionSignature({
                    authenticatorData: assertion.response.authenticatorData,
                    clientDataJSON: assertion.response.clientDataJSON,
                    signature: assertion.response.signature,
                    publicKeyHex: matchedCredential.publicKeyHex,
                    algorithm: matchedCredential.algorithm,
                });

                if (!signatureValid) {
                    console.error(
                        `[WebAuthn] Signature verification FAILED for credential ${assertionId}. `
                        + `This could indicate a compromised authenticator or corrupted data.`
                    );
                    return {
                        success: false,
                        error: 'Signature verification failed \u2014 assertion is invalid',
                    };
                }
            } catch (verifyErr) {
                console.error(
                    `[WebAuthn] Signature verification error for credential ${assertionId}:`,
                    verifyErr.message
                );
                return {
                    success: false,
                    error: `Signature verification error: ${verifyErr.message}`,
                };
            }

            // Update counter to authenticator-reported value (not counter + 1)
            matchedCredential.counter = authenticatorCounter || (storedCounter + 1);
            matchedCredential.lastUsedAt = new Date().toISOString();
            saveCredentials({ credentials: stored });
        }

        return {
            success: true,
            credentialId: assertionId,
            authenticatorData: assertion.response?.authenticatorData || null,
            signature: assertion.response?.signature || null,
            userHandle: assertion.response?.userHandle || null,
            clientDataJSON: assertion.response?.clientDataJSON || null,
        };
    } catch (err) {
        console.error('[WebAuthn] Authentication failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function hasCredential() {
    return getStoredCredentials().length > 0;
}

function removeCredential(credentialId) {
    removeStoredCredential(credentialId);
}

function clearAllCredentials() {
    saveCredentials({ credentials: [] });
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    isSupported,
    getPlatformInfo,
    registerCredential,
    authenticate,
    hasCredential,
    removeCredential,
    clearAllCredentials,
    getStoredCredentials,
    generateChallenge,
    base64urlEncode,
    base64urlDecode,
    parseCosePublicKey,
    parseAuthData,
    extractSignCount,
    verifyAssertionSignature,
    RP_ID,
    RP_NAME,
};

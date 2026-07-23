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
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
            attestation: 'direct',
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

// ── Core: Authenticate (challenge-response assertion) ────────────────────────

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

        // Update the counter for the matched credential
        const matchedCredential = stored.find(c => c.id === (assertion.rawId || assertion.id));
        if (matchedCredential) {
            matchedCredential.counter = (matchedCredential.counter || 0) + 1;
            matchedCredential.lastUsedAt = new Date().toISOString();
            saveCredentials({ credentials: stored });
        }

        return {
            success: true,
            credentialId: assertion.rawId || assertion.id,
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
    RP_ID,
    RP_NAME,
};

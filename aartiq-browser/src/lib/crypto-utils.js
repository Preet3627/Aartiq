"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecryptionError = exports.EncryptionError = void 0;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.encodeLocalOnly = encodeLocalOnly;
exports.isCiphertext = isCiphertext;
exports.migrateLegacyBlob = migrateLegacyBlob;
exports.decryptLegacyBlob = decryptLegacyBlob;
exports.migrateToNewFormat = migrateToNewFormat;
var EncryptionError = /** @class */ (function (_super) {
    __extends(EncryptionError, _super);
    function EncryptionError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'EncryptionError';
        return _this;
    }
    return EncryptionError;
}(Error));
exports.EncryptionError = EncryptionError;
var DecryptionError = /** @class */ (function (_super) {
    __extends(DecryptionError, _super);
    function DecryptionError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'DecryptionError';
        return _this;
    }
    return DecryptionError;
}(Error));
exports.DecryptionError = DecryptionError;
var PBKDF2_ITERATIONS = 600000;
var SALT_BYTES = 16;
var IV_BYTES = 12;
var PREFIX = 'E2EE2:';
function deriveKey(passphrase, salt) {
    return __awaiter(this, void 0, void 0, function () {
        var baseKey;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])];
                case 1:
                    baseKey = _a.sent();
                    return [2 /*return*/, crypto.subtle.deriveKey({
                            name: 'PBKDF2',
                            salt: salt.buffer,
                            iterations: PBKDF2_ITERATIONS,
                            hash: 'SHA-256',
                        }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])];
            }
        });
    });
}
function base64Decode(str) {
    var binary = atob(str);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
function base64Encode(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
function encrypt(text, passphrase) {
    return __awaiter(this, void 0, void 0, function () {
        var salt, iv, key, ciphertext, combined, combinedBuf, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!passphrase || passphrase.length < 8) {
                        throw new EncryptionError('A passphrase of at least 8 characters is required.');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
                    iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
                    return [4 /*yield*/, deriveKey(passphrase, salt)];
                case 2:
                    key = _a.sent();
                    return [4 /*yield*/, crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer }, key, new TextEncoder().encode(text))];
                case 3:
                    ciphertext = _a.sent();
                    combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
                    combined.set(salt, 0);
                    combined.set(iv, salt.length);
                    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
                    combinedBuf = new Uint8Array(combined);
                    return [2 /*return*/, "".concat(PREFIX).concat(base64Encode(combinedBuf))];
                case 4:
                    e_1 = _a.sent();
                    throw new EncryptionError("Encryption failed: ".concat(e_1.message));
                case 5: return [2 /*return*/];
            }
        });
    });
}
function decrypt(encoded, passphrase) {
    return __awaiter(this, void 0, void 0, function () {
        var combined, salt, iv, ciphertext, key, plaintext, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!encoded.startsWith(PREFIX)) {
                        throw new DecryptionError('Unrecognized ciphertext format.');
                    }
                    if (!passphrase) {
                        throw new DecryptionError('Passphrase is required.');
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    combined = base64Decode(encoded.slice(PREFIX.length));
                    salt = combined.slice(0, SALT_BYTES);
                    iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
                    ciphertext = combined.slice(SALT_BYTES + IV_BYTES);
                    return [4 /*yield*/, deriveKey(passphrase, salt)];
                case 2:
                    key = _b.sent();
                    return [4 /*yield*/, crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer }, key, ciphertext)];
                case 3:
                    plaintext = _b.sent();
                    return [2 /*return*/, new TextDecoder().decode(plaintext)];
                case 4:
                    _a = _b.sent();
                    throw new DecryptionError('Decryption failed: wrong passphrase or corrupted data.');
                case 5: return [2 /*return*/];
            }
        });
    });
}
function encodeLocalOnly(text) {
    return "PLAINTEXT_LOCAL:".concat(base64Encode(new TextEncoder().encode(text)));
}
function isCiphertext(encoded) {
    return encoded.startsWith(PREFIX);
}
function migrateLegacyBlob(encoded) {
    if (encoded.startsWith('LCL:')) {
        return { prefix: 'LCL:', data: encoded.slice(4) };
    }
    if (encoded.startsWith('E2EE:')) {
        return { prefix: 'E2EE:', data: encoded.slice(5) };
    }
    return null;
}
function decryptLegacyBlob(encoded, passphrase) {
    return __awaiter(this, void 0, void 0, function () {
        var blob, decoded, raw, iv, ciphertext, keyData, key, plaintext, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    blob = migrateLegacyBlob(encoded);
                    if (!blob) {
                        throw new DecryptionError('Not a legacy-format blob.');
                    }
                    if (blob.prefix === 'LCL:') {
                        try {
                            decoded = base64Decode(blob.data);
                            return [2 /*return*/, new TextDecoder().decode(decoded)];
                        }
                        catch (_b) {
                            throw new DecryptionError('Failed to decode LCL: blob.');
                        }
                    }
                    if (!(blob.prefix === 'E2EE:')) return [3 /*break*/, 6];
                    if (!passphrase) {
                        throw new DecryptionError('Passphrase required to decrypt E2EE: blob.');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    raw = base64Decode(blob.data);
                    iv = raw.slice(0, 12);
                    ciphertext = raw.slice(12);
                    return [4 /*yield*/, crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase))];
                case 2:
                    keyData = _a.sent();
                    return [4 /*yield*/, crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt'])];
                case 3:
                    key = _a.sent();
                    return [4 /*yield*/, crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext)];
                case 4:
                    plaintext = _a.sent();
                    return [2 /*return*/, new TextDecoder().decode(plaintext)];
                case 5:
                    e_2 = _a.sent();
                    throw new DecryptionError("Legacy decryption failed: ".concat(e_2.message));
                case 6: throw new DecryptionError('Unknown legacy blob format.');
            }
        });
    });
}
function migrateToNewFormat(encoded, newPassphrase, oldPassphrase) {
    return __awaiter(this, void 0, void 0, function () {
        var blob, plaintext;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    blob = migrateLegacyBlob(encoded);
                    if (!blob) {
                        return [2 /*return*/, encoded];
                    }
                    if (!(blob.prefix === 'LCL:')) return [3 /*break*/, 2];
                    return [4 /*yield*/, decryptLegacyBlob(encoded, '')];
                case 1:
                    plaintext = _a.sent();
                    return [3 /*break*/, 4];
                case 2:
                    if (!oldPassphrase) {
                        throw new DecryptionError('Old passphrase required to migrate E2EE: blob.');
                    }
                    return [4 /*yield*/, decryptLegacyBlob(encoded, oldPassphrase)];
                case 3:
                    plaintext = _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/, encrypt(plaintext, newPassphrase)];
            }
        });
    });
}

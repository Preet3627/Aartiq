"use strict";
/**
 * Peer-to-Peer File Sync Service
 * Syncs files, folders, images, PDFs across devices without cloud storage
 * Uses WebRTC for direct device-to-device transfer
 */
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2PFileSyncService = void 0;
exports.getP2PSync = getP2PSync;
var events_1 = require("events");
var FirebaseService_1 = __importDefault(require("./FirebaseService"));
var database_1 = require("firebase/database");
var storage_1 = require("firebase/storage");
// Type guard function
function isErrorResult(result) {
    return result.error !== undefined;
}
var P2PFileSyncService = /** @class */ (function (_super) {
    __extends(P2PFileSyncService, _super);
    function P2PFileSyncService(deviceId) {
        var _this = _super.call(this) || this;
        _this.peerConnection = null;
        _this.dataChannel = null;
        _this.syncFolders = new Map();
        _this.isConnected = false;
        _this.db = null;
        _this.storage = null; // Add storage property
        _this.userId = null;
        _this.remoteDeviceId = null; // Track the device we are trying to connect to
        _this._relayListenerOff = null;
        _this.deviceId = deviceId;
        _this.initializeFirebase();
        return _this;
    }
    P2PFileSyncService.prototype.initializeFirebase = function () {
        var _this = this;
        FirebaseService_1.default.onAuthReady(function () {
            var _a;
            if (FirebaseService_1.default.app && ((_a = FirebaseService_1.default.auth) === null || _a === void 0 ? void 0 : _a.currentUser)) {
                _this.db = (0, database_1.getDatabase)(FirebaseService_1.default.app);
                _this.storage = (0, storage_1.getStorage)(FirebaseService_1.default.app);
                _this.userId = FirebaseService_1.default.auth.currentUser.uid;
                console.log('[P2P] Firebase initialized for user:', _this.userId);
                _this.emit('firebase-ready', _this.userId);
                _this._listenForRelayFiles(); // Start listening for relayed files
            }
            else {
                console.warn('[P2P] Firebase not ready or no user logged in.');
            }
        });
    };
    // Call this from the renderer process when a connection is desired
    P2PFileSyncService.prototype.connectToRemoteDevice = function (remoteDeviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var signalRef;
            var _this = this;
            return __generator(this, function (_a) {
                this.remoteDeviceId = remoteDeviceId;
                if (!this.userId) {
                    console.error('[P2P] User not authenticated for Firebase signaling.');
                    return [2 /*return*/, false];
                }
                signalRef = (0, database_1.ref)(this.db, "p2p_signals/".concat(this.userId, "/").concat(this.remoteDeviceId));
                (0, database_1.onValue)(signalRef, function (snapshot) { return _this._handleFirebaseSignal(snapshot); });
                return [2 /*return*/, this.initializeP2PConnection(remoteDeviceId)];
            });
        });
    };
    // Method to send signaling data via Firebase
    P2PFileSyncService.prototype.sendSignal = function (signal, remoteDeviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var signalPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.db || !this.userId || !remoteDeviceId) {
                            console.error('[P2P] Cannot send signal: Firebase not ready, no user, or no remote device.');
                            return [2 /*return*/];
                        }
                        signalPath = "p2p_signals/".concat(this.userId, "/").concat(remoteDeviceId);
                        // Push the signal to Firebase. Use a timestamp or unique ID to order messages.
                        return [4 /*yield*/, (0, database_1.set)((0, database_1.ref)(this.db, signalPath), { signal: signal, sender: this.deviceId, timestamp: Date.now() })];
                    case 1:
                        // Push the signal to Firebase. Use a timestamp or unique ID to order messages.
                        _a.sent();
                        console.log("[P2P] Sent signal to ".concat(remoteDeviceId, " via Firebase:"), signal);
                        return [2 /*return*/];
                }
            });
        });
    };
    // Handle incoming signaling data from Firebase
    P2PFileSyncService.prototype._handleFirebaseSignal = function (snapshot) {
        var data = snapshot.val();
        if (data && data.sender !== this.deviceId) { // Ignore signals sent by self
            console.log('[P2P] Received signal from Firebase:', data.signal);
            var signal = data.signal;
            if (this.peerConnection) {
                if (signal.sdp) {
                    this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                        .catch(function (e) { return console.error('[P2P] Error setting remote description:', e); });
                }
                else if (signal.candidate) {
                    this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
                        .catch(function (e) { return console.error('[P2P] Error adding ICE candidate:', e); });
                }
            }
            // Clear the signal after processing to avoid re-processing
            (0, database_1.set)(snapshot.ref, null);
        }
    };
    /**
     * Initialize WebRTC connection for P2P file transfer
     */
    P2PFileSyncService.prototype.initializeP2PConnection = function (remoteDeviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                try {
                    // Create peer connection with STUN servers
                    this.peerConnection = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    });
                    this.peerConnection.onicecandidate = function (event) {
                        if (event.candidate) {
                            _this.sendSignal({ candidate: event.candidate }, remoteDeviceId);
                        }
                    };
                    this.peerConnection.onnegotiationneeded = function () { return __awaiter(_this, void 0, void 0, function () {
                        var offer, err_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    return [4 /*yield*/, this.peerConnection.createOffer()];
                                case 1:
                                    offer = _a.sent();
                                    return [4 /*yield*/, this.peerConnection.setLocalDescription(offer)];
                                case 2:
                                    _a.sent();
                                    this.sendSignal({ sdp: this.peerConnection.localDescription }, remoteDeviceId);
                                    return [3 /*break*/, 4];
                                case 3:
                                    err_1 = _a.sent();
                                    console.error('[P2P] Error creating or sending offer:', err_1);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); };
                    this.peerConnection.ondatachannel = function (event) {
                        _this.dataChannel = event.channel;
                        _this.setupDataChannel();
                    };
                    return [2 /*return*/, true];
                }
                catch (error) {
                    console.error('[P2P] Connection failed:', error);
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    P2PFileSyncService.prototype.setupDataChannel = function () {
        var _this = this;
        if (!this.dataChannel)
            return;
        this.dataChannel.onopen = function () {
            _this.isConnected = true;
            _this.emit('connected');
            console.log('[P2P] Data channel opened');
        };
        this.dataChannel.onclose = function () {
            _this.isConnected = false;
            _this.emit('disconnected');
            console.log('[P2P] Data channel closed');
        };
        this.dataChannel.onmessage = function (event) {
            _this.handleIncomingData(event.data);
        };
    };
    /**
     * Add folder to sync configuration
     */
    P2PFileSyncService.prototype.addSyncFolder = function (config) {
        var id = "sync-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
        var folder = __assign(__assign({}, config), { id: id, lastSync: 0 });
        this.syncFolders.set(id, folder);
        this.emit('folder-added', folder);
        return id;
    };
    /**
     * Remove folder from sync
     */
    P2PFileSyncService.prototype.removeSyncFolder = function (id) {
        var removed = this.syncFolders.delete(id);
        if (removed) {
            this.emit('folder-removed', id);
        }
        return removed;
    };
    /**
     * Get all sync folders
     */
    P2PFileSyncService.prototype.getSyncFolders = function () {
        return Array.from(this.syncFolders.values());
    };
    /**
     * Scan folder and get file metadata
     */
    /**
     * Scan folder and get file metadata
     */
    P2PFileSyncService.prototype.scanFolder = function (folderPath, types) {
        return __awaiter(this, void 0, void 0, function () {
            var fs, path, results, scanRecursive, e_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(typeof window !== 'undefined' && window.electronAPI)) return [3 /*break*/, 2];
                        return [4 /*yield*/, window.electronAPI.scanFolder(folderPath, types)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        fs = require('fs');
                        path = require('path');
                        results = [];
                        scanRecursive = function (currentPath) { return __awaiter(_this, void 0, void 0, function () {
                            var entries, _i, entries_1, entry, fullPath, ext, match, stats;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        entries = fs.readdirSync(currentPath, { withFileTypes: true });
                                        _i = 0, entries_1 = entries;
                                        _a.label = 1;
                                    case 1:
                                        if (!(_i < entries_1.length)) return [3 /*break*/, 5];
                                        entry = entries_1[_i];
                                        fullPath = path.join(currentPath, entry.name);
                                        if (!entry.isDirectory()) return [3 /*break*/, 3];
                                        return [4 /*yield*/, scanRecursive(fullPath)];
                                    case 2:
                                        _a.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        ext = path.extname(entry.name).toLowerCase();
                                        match = false;
                                        if (types.includes('all'))
                                            match = true;
                                        else if (types.includes('images') && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext))
                                            match = true;
                                        else if (types.includes('pdfs') && ext === '.pdf')
                                            match = true;
                                        else if (types.includes('documents') && ['.doc', '.docx', '.txt', '.md', '.rtf'].includes(ext))
                                            match = true;
                                        if (match) {
                                            stats = fs.statSync(fullPath);
                                            results.push({
                                                id: "file-".concat(Date.now(), "-").concat(Math.random().toString(36).substring(2, 7)),
                                                name: entry.name,
                                                path: fullPath,
                                                size: stats.size,
                                                type: ext.substring(1),
                                                hash: '',
                                                modifiedTime: stats.mtimeMs
                                            });
                                        }
                                        _a.label = 4;
                                    case 4:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); };
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, scanRecursive(folderPath)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        e_1 = _a.sent();
                        console.error('[P2P] Scan error:', e_1);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Sync specific folder
     */
    P2PFileSyncService.prototype.syncFolder = function (folderId) {
        return __awaiter(this, void 0, void 0, function () {
            var folder, localFiles, filesSynced, _i, localFiles_1, file, transferred, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        folder = this.syncFolders.get(folderId);
                        if (!folder) {
                            return [2 /*return*/, { success: false, filesSynced: 0 }];
                        }
                        if (!this.isConnected) {
                            console.error('[P2P] Not connected to remote device');
                            return [2 /*return*/, { success: false, filesSynced: 0 }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 9]);
                        return [4 /*yield*/, this.scanFolder(folder.localPath, folder.syncTypes)];
                    case 2:
                        localFiles = _a.sent();
                        // Request remote file list
                        this.sendMessage({
                            type: 'file-list-request',
                            folderId: folderId,
                            path: folder.remotePath
                        });
                        // Wait for response and compare
                        // Transfer only changed files
                        this.emit('sync-started', { folderId: folderId, fileCount: localFiles.length });
                        filesSynced = 0;
                        _i = 0, localFiles_1 = localFiles;
                        _a.label = 3;
                    case 3:
                        if (!(_i < localFiles_1.length)) return [3 /*break*/, 6];
                        file = localFiles_1[_i];
                        return [4 /*yield*/, this.transferFile(file)];
                    case 4:
                        transferred = _a.sent();
                        if (transferred)
                            filesSynced++;
                        this.emit('sync-progress', {
                            folderId: folderId,
                            current: filesSynced,
                            total: localFiles.length
                        });
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        folder.lastSync = Date.now();
                        this.emit('sync-completed', { folderId: folderId, filesSynced: filesSynced });
                        return [2 /*return*/, { success: true, filesSynced: filesSynced }];
                    case 7:
                        error_1 = _a.sent();
                        console.error('[P2P] Sync failed, attempting relay...', error_1);
                        return [4 /*yield*/, this.syncViaRelay(folderId)];
                    case 8: 
                    // RELAY LOGIC: If P2P fails (offline), use temporary server relay
                    return [2 /*return*/, _a.sent()];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Relay & Queue System (For Offline Hardware)
     * Saves temporary file to server, deletes after sync complete.
     */
    P2PFileSyncService.prototype.syncViaRelay = function (folderId) {
        return __awaiter(this, void 0, void 0, function () {
            var folder, localFiles, filesQueued, passphrase, _i, localFiles_2, file, fileData, encryptResult, encryptedData, iv, authTag, salt, storagePath, fileRef, downloadURL, fileRelayMetadata, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        folder = this.syncFolders.get(folderId);
                        if (!folder || !this.db || !this.storage || !this.userId || !this.remoteDeviceId) {
                            console.error('[Relay] Offline sync failed: folder, DB, Storage, userId, or remoteDeviceId not available.');
                            return [2 /*return*/, { success: false, filesSynced: 0 }];
                        }
                        console.log("[Relay] Device ".concat(this.remoteDeviceId, " is offline. Queueing files to temporary Firebase Storage..."));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 11, , 12]);
                        return [4 /*yield*/, this.scanFolder(folder.localPath, folder.syncTypes)];
                    case 2:
                        localFiles = _a.sent();
                        filesQueued = 0;
                        passphrase = 'temp-key';
                        _i = 0, localFiles_2 = localFiles;
                        _a.label = 3;
                    case 3:
                        if (!(_i < localFiles_2.length)) return [3 /*break*/, 10];
                        file = localFiles_2[_i];
                        return [4 /*yield*/, this.readFileData(file.path)];
                    case 4:
                        fileData = _a.sent();
                        return [4 /*yield*/, this.encryptData(fileData, passphrase)];
                    case 5:
                        encryptResult = _a.sent();
                        if (isErrorResult(encryptResult)) {
                            console.error('[Relay] Encryption failed:', encryptResult.error);
                            return [3 /*break*/, 9];
                        }
                        encryptedData = encryptResult.encryptedData, iv = encryptResult.iv, authTag = encryptResult.authTag, salt = encryptResult.salt;
                        storagePath = "users/".concat(this.userId, "/temp_relay_files/").concat(this.remoteDeviceId, "/").concat(file.id);
                        fileRef = (0, storage_1.ref)(this.storage, storagePath);
                        return [4 /*yield*/, (0, storage_1.uploadBytes)(fileRef, new Uint8Array(encryptedData))];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, (0, storage_1.getDownloadURL)(fileRef)];
                    case 7:
                        downloadURL = _a.sent();
                        fileRelayMetadata = __assign(__assign({}, file), { storagePath: storagePath, downloadURL: downloadURL, iv: Buffer.from(iv).toString('base64'), authTag: Buffer.from(authTag).toString('base64'), salt: Buffer.from(salt).toString('base64'), senderDeviceId: this.deviceId, timestamp: Date.now() });
                        return [4 /*yield*/, (0, database_1.set)((0, database_1.ref)(this.db, "p2p_relay_metadata/".concat(this.remoteDeviceId, "/").concat(file.id)), fileRelayMetadata)];
                    case 8:
                        _a.sent();
                        console.log("[Relay] Uploaded ".concat(file.name, " to Firebase Storage and added metadata to DB."));
                        filesQueued++;
                        _a.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 3];
                    case 10:
                        this.emit('relay-queued', { folderId: folderId, count: filesQueued });
                        return [2 /*return*/, { success: true, filesSynced: filesQueued }];
                    case 11:
                        e_2 = _a.sent();
                        console.error('[Relay] Offline queue failed:', e_2);
                        return [2 /*return*/, { success: false, filesSynced: 0 }];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    P2PFileSyncService.prototype._listenForRelayFiles = function () {
        var _this = this;
        if (!this.db || !this.storage || !this.userId)
            return;
        var relayRef = (0, database_1.ref)(this.db, "p2p_relay_metadata/".concat(this.deviceId));
        this._relayListenerOff = (0, database_1.onValue)(relayRef, function (snapshot) { return __awaiter(_this, void 0, void 0, function () {
            var filesToProcess, _a, _b, _c, _i, fileId, fileMetadata, fileRef, arrayBuffer, passphrase, decryptResult, decryptedData, e_3;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        filesToProcess = snapshot.val();
                        if (!filesToProcess)
                            return [2 /*return*/];
                        _a = filesToProcess;
                        _b = [];
                        for (_c in _a)
                            _b.push(_c);
                        _i = 0;
                        _d.label = 1;
                    case 1:
                        if (!(_i < _b.length)) return [3 /*break*/, 10];
                        _c = _b[_i];
                        if (!(_c in _a)) return [3 /*break*/, 9];
                        fileId = _c;
                        fileMetadata = filesToProcess[fileId];
                        console.log("[Relay] Device ".concat(this.deviceId, " detected new file to download: ").concat(fileMetadata.name));
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 8, , 9]);
                        fileRef = (0, storage_1.ref)(this.storage, fileMetadata.storagePath);
                        return [4 /*yield*/, fetch(fileMetadata.downloadURL)];
                    case 3: return [4 /*yield*/, (_d.sent()).arrayBuffer()];
                    case 4:
                        arrayBuffer = _d.sent();
                        passphrase = 'temp-key';
                        return [4 /*yield*/, this.decryptData(arrayBuffer, passphrase, Buffer.from(fileMetadata.iv, 'base64').buffer, Buffer.from(fileMetadata.authTag, 'base64').buffer, Buffer.from(fileMetadata.salt, 'base64').buffer)];
                    case 5:
                        decryptResult = _d.sent();
                        if (isErrorResult(decryptResult)) {
                            console.error('[Relay] Decryption failed:', decryptResult.error);
                            return [3 /*break*/, 9];
                        }
                        decryptedData = decryptResult.decryptedData;
                        // TODO: Save file locally (Electron main process will handle this via IPC)
                        console.log("[Relay] Decrypted ".concat(fileMetadata.name, ". Ready to save locally."));
                        // Delete metadata and file from Firebase after successful processing
                        return [4 /*yield*/, (0, database_1.set)((0, database_1.ref)(this.db, "p2p_relay_metadata/".concat(this.deviceId, "/").concat(fileId)), null)];
                    case 6:
                        // Delete metadata and file from Firebase after successful processing
                        _d.sent();
                        return [4 /*yield*/, (0, storage_1.deleteObject)(fileRef)];
                    case 7:
                        _d.sent();
                        console.log("[Relay] Cleaned up ".concat(fileMetadata.name, " from Firebase."));
                        this.emit('file-relayed', __assign(__assign({}, fileMetadata), { decryptedData: decryptedData }));
                        return [3 /*break*/, 9];
                    case 8:
                        e_3 = _d.sent();
                        console.error("[Relay] Error processing relayed file ".concat(fileMetadata.name, ":"), e_3);
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 1];
                    case 10: return [2 /*return*/];
                }
            });
        }); });
    };
    /**
     * Transfer single file via P2P
     */
    P2PFileSyncService.prototype.transferFile = function (file) {
        return __awaiter(this, void 0, void 0, function () {
            var CHUNK_SIZE, fileData, offset, chunk, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
                            return [2 /*return*/, false];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, , 9]);
                        CHUNK_SIZE = 16384;
                        return [4 /*yield*/, this.readFileData(file.path)];
                    case 2:
                        fileData = _a.sent();
                        // Send file metadata
                        this.sendMessage({
                            type: 'file-transfer-start',
                            metadata: file
                        });
                        offset = 0;
                        _a.label = 3;
                    case 3:
                        if (!(offset < fileData.byteLength)) return [3 /*break*/, 7];
                        chunk = fileData.slice(offset, offset + CHUNK_SIZE);
                        this.dataChannel.send(chunk);
                        _a.label = 4;
                    case 4:
                        if (!(this.dataChannel.bufferedAmount > CHUNK_SIZE * 4)) return [3 /*break*/, 6];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 6:
                        offset += CHUNK_SIZE;
                        return [3 /*break*/, 3];
                    case 7:
                        // Send completion message
                        this.sendMessage({
                            type: 'file-transfer-complete',
                            fileId: file.id
                        });
                        return [2 /*return*/, true];
                    case 8:
                        error_2 = _a.sent();
                        console.error('[P2P] File transfer failed:', error_2);
                        return [2 /*return*/, false];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    P2PFileSyncService.prototype.readFileData = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var fs, buffer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(typeof window !== 'undefined' && window.electronAPI)) return [3 /*break*/, 2];
                        return [4 /*yield*/, window.electronAPI.readFileBuffer(filePath)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        fs = require('fs');
                        try {
                            buffer = fs.readFileSync(filePath);
                            return [2 /*return*/, buffer.buffer];
                        }
                        catch (e) {
                            console.error('[P2P] Read file error:', e);
                            return [2 /*return*/, new ArrayBuffer(0)];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    P2PFileSyncService.prototype.encryptData = function (data, key) {
        return __awaiter(this, void 0, void 0, function () {
            var crypto;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(typeof window !== 'undefined' && window.electronAPI)) return [3 /*break*/, 2];
                        return [4 /*yield*/, window.electronAPI.encryptData(data, key)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        crypto = require('crypto');
                        return [2 /*return*/, new Promise(function (resolve) {
                                try {
                                    var salt_1 = crypto.randomBytes(16);
                                    crypto.pbkdf2(key, salt_1, 100000, 32, 'sha512', function (err, derivedKey) {
                                        if (err) {
                                            resolve({ error: err.message });
                                            return;
                                        }
                                        var iv = crypto.randomBytes(16);
                                        var cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
                                        var encrypted = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
                                        var authTag = cipher.getAuthTag();
                                        resolve({
                                            encryptedData: encrypted.buffer,
                                            iv: iv.buffer,
                                            authTag: authTag.buffer,
                                            salt: salt_1.buffer
                                        });
                                    });
                                }
                                catch (e) {
                                    resolve({ error: e.message });
                                }
                            })];
                }
            });
        });
    };
    P2PFileSyncService.prototype.decryptData = function (encryptedData, key, iv, authTag, salt) {
        return __awaiter(this, void 0, void 0, function () {
            var crypto;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(typeof window !== 'undefined' && window.electronAPI)) return [3 /*break*/, 2];
                        return [4 /*yield*/, window.electronAPI.decryptData(encryptedData, key, iv, authTag, salt)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        crypto = require('crypto');
                        return [2 /*return*/, new Promise(function (resolve) {
                                try {
                                    crypto.pbkdf2(key, Buffer.from(salt), 100000, 32, 'sha512', function (err, derivedKey) {
                                        if (err) {
                                            resolve({ error: err.message });
                                            return;
                                        }
                                        var decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(iv));
                                        decipher.setAuthTag(Buffer.from(authTag));
                                        var decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData)), decipher.final()]);
                                        resolve({ decryptedData: decrypted.buffer });
                                    });
                                }
                                catch (e) {
                                    resolve({ error: e.message });
                                }
                            })];
                }
            });
        });
    };
    P2PFileSyncService.prototype.sendMessage = function (message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        }
    };
    P2PFileSyncService.prototype.handleIncomingData = function (data) {
        try {
            if (typeof data === 'string') {
                var message = JSON.parse(data);
                this.emit('message', message);
                switch (message.type) {
                    case 'file-list-request':
                        this.handleFileListRequest(message);
                        break;
                    case 'file-transfer-start':
                        this.handleFileTransferStart(message);
                        break;
                    case 'file-transfer-complete':
                        this.handleFileTransferComplete(message);
                        break;
                }
            }
            else {
                // Binary data (file chunk)
                this.emit('file-chunk', data);
            }
        }
        catch (error) {
            console.error('[P2P] Message handling failed:', error);
        }
    };
    P2PFileSyncService.prototype.handleFileListRequest = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var files;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.scanFolder(message.path, ['all'])];
                    case 1:
                        files = _a.sent();
                        this.sendMessage({
                            type: 'file-list-response',
                            folderId: message.folderId,
                            files: files
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    P2PFileSyncService.prototype.handleFileTransferStart = function (message) {
        this.emit('file-receiving', message.metadata);
    };
    P2PFileSyncService.prototype.handleFileTransferComplete = function (message) {
        this.emit('file-received', message.fileId);
    };
    /**
     * Disconnect P2P connection
     */
    P2PFileSyncService.prototype.disconnect = function () {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.db && this.userId && this.remoteDeviceId) {
            // Clean up Firebase signaling listener
            var signalRef = (0, database_1.ref)(this.db, "p2p_signals/".concat(this.userId, "/").concat(this.remoteDeviceId));
            (0, database_1.off)(signalRef);
        }
        // Clean up Firebase relay listener
        if (this._relayListenerOff) {
            this._relayListenerOff();
            this._relayListenerOff = null;
        }
        this.isConnected = false;
        this.emit('disconnected');
    };
    /**
     * Get connection status
     */
    P2PFileSyncService.prototype.getStatus = function () {
        return {
            connected: this.isConnected,
            deviceId: this.deviceId,
            syncFolders: this.syncFolders.size
        };
    };
    return P2PFileSyncService;
}(events_1.EventEmitter));
exports.P2PFileSyncService = P2PFileSyncService;
// Singleton instance
var p2pSyncInstance = null;
function getP2PSync(deviceId) {
    if (!p2pSyncInstance && deviceId) {
        p2pSyncInstance = new P2PFileSyncService(deviceId);
    }
    return p2pSyncInstance;
}

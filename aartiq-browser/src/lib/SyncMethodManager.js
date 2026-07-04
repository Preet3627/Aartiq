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
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncMethodManager = exports.SyncMethodManager = void 0;
var events_1 = require("events");
var WiFiSyncService_1 = require("./WiFiSyncService");
var CloudSyncService_1 = require("./CloudSyncService");
var SyncMethodManager = /** @class */ (function (_super) {
    __extends(SyncMethodManager, _super);
    function SyncMethodManager() {
        var _this = _super.call(this) || this;
        _this.currentMode = 'local';
        _this.wifiSync = null;
        _this.cloudSync = null;
        _this.syncOptions = {
            clipboard: true,
            history: true,
            files: true,
            desktopControl: true
        };
        _this.devices = new Map();
        _this.localDeviceId = '';
        _this.deviceName = '';
        return _this;
    }
    SyncMethodManager.getInstance = function () {
        if (!SyncMethodManager.instance) {
            SyncMethodManager.instance = new SyncMethodManager();
        }
        return SyncMethodManager.instance;
    };
    SyncMethodManager.prototype.initialize = function (deviceId, deviceName, deviceType) {
        this.localDeviceId = deviceId;
        this.deviceName = deviceName;
        console.log("[SyncMethodManager] Initialized for ".concat(deviceType, ": ").concat(deviceName, " (").concat(deviceId, ")"));
    };
    SyncMethodManager.prototype.setMode = function (mode) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("[SyncMethodManager] Switching to mode: ".concat(mode));
                        this.currentMode = mode;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 10, , 11]);
                        _a = mode;
                        switch (_a) {
                            case 'local': return [3 /*break*/, 2];
                            case 'cloud': return [3 /*break*/, 4];
                            case 'local_cloud': return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 9];
                    case 2: return [4 /*yield*/, this._initLocalSync()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 4: return [4 /*yield*/, this._initCloudSync()];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 6: return [4 /*yield*/, this._initLocalSync()];
                    case 7:
                        _b.sent();
                        return [4 /*yield*/, this._initCloudSync()];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        this.emit('mode-changed', mode);
                        return [2 /*return*/, true];
                    case 10:
                        error_1 = _b.sent();
                        console.error('[SyncMethodManager] Failed to set mode:', error_1);
                        return [2 /*return*/, false];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    SyncMethodManager.prototype.getMode = function () {
        return this.currentMode;
    };
    SyncMethodManager.prototype.getWifiSync = function () {
        return this.wifiSync;
    };
    SyncMethodManager.prototype.getCloudSync = function () {
        return this.cloudSync;
    };
    SyncMethodManager.prototype.setSyncOptions = function (options) {
        this.syncOptions = __assign(__assign({}, this.syncOptions), options);
        this.emit('options-changed', this.syncOptions);
    };
    SyncMethodManager.prototype.getSyncOptions = function () {
        return __assign({}, this.syncOptions);
    };
    SyncMethodManager.prototype.setCloudConfig = function (config) {
        var _a, _b;
        return (_b = (_a = this.cloudSync) === null || _a === void 0 ? void 0 : _a.configure(config)) !== null && _b !== void 0 ? _b : Promise.resolve(false);
    };
    SyncMethodManager.prototype.loginToCloud = function (email, password) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                return [2 /*return*/, (_b = (_a = this.cloudSync) === null || _a === void 0 ? void 0 : _a.login(email, password)) !== null && _b !== void 0 ? _b : Promise.resolve(false)];
            });
        });
    };
    SyncMethodManager.prototype.logoutFromCloud = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                return [2 /*return*/, (_b = (_a = this.cloudSync) === null || _a === void 0 ? void 0 : _a.logout()) !== null && _b !== void 0 ? _b : Promise.resolve()];
            });
        });
    };
    SyncMethodManager.prototype.isCloudConnected = function () {
        var _a, _b;
        return (_b = (_a = this.cloudSync) === null || _a === void 0 ? void 0 : _a.isConnected()) !== null && _b !== void 0 ? _b : false;
    };
    SyncMethodManager.prototype.connectToDevice = function (targetDeviceId_1) {
        return __awaiter(this, arguments, void 0, function (targetDeviceId, connectionType) {
            if (connectionType === void 0) { connectionType = 'cloud'; }
            return __generator(this, function (_a) {
                console.log("[SyncMethodManager] Connecting to device: ".concat(targetDeviceId, " via ").concat(connectionType));
                if (connectionType === 'local' && this.wifiSync) {
                    return [2 /*return*/, this.wifiSync.connectToDevice(targetDeviceId)];
                }
                else if (connectionType === 'cloud' && this.cloudSync) {
                    return [2 /*return*/, this.cloudSync.connectToDevice(targetDeviceId)];
                }
                return [2 /*return*/, false];
            });
        });
    };
    SyncMethodManager.prototype.disconnectFromDevice = function (targetDeviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var device;
            return __generator(this, function (_a) {
                device = this.devices.get(targetDeviceId);
                if (!device)
                    return [2 /*return*/];
                if (device.connectionType === 'local' && this.wifiSync) {
                    this.wifiSync.disconnectFromDevice(targetDeviceId);
                }
                else if (device.connectionType === 'cloud' && this.cloudSync) {
                    this.cloudSync.disconnectFromDevice(targetDeviceId);
                }
                device.isOnline = false;
                this.devices.set(targetDeviceId, device);
                this.emit('device-disconnected', targetDeviceId);
                return [2 /*return*/];
            });
        });
    };
    SyncMethodManager.prototype.getDevices = function () {
        return Array.from(this.devices.values());
    };
    SyncMethodManager.prototype.getLocalDevices = function () {
        return Array.from(this.devices.values()).filter(function (d) { return d.connectionType === 'local'; });
    };
    SyncMethodManager.prototype.getCloudDevices = function () {
        return Array.from(this.devices.values()).filter(function (d) { return d.connectionType === 'cloud'; });
    };
    SyncMethodManager.prototype.getOnlineDevices = function () {
        return Array.from(this.devices.values()).filter(function (d) { return d.isOnline; });
    };
    SyncMethodManager.prototype._initLocalSync = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.wifiSync) {
                    this.wifiSync = new WiFiSyncService_1.WiFiSyncService(3004);
                    this.wifiSync.start();
                    console.log('[SyncMethodManager] Local WiFi sync started');
                }
                return [2 /*return*/];
            });
        });
    };
    SyncMethodManager.prototype._initCloudSync = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.cloudSync) return [3 /*break*/, 2];
                        this.cloudSync = CloudSyncService_1.CloudSyncService.getInstance();
                        return [4 /*yield*/, this.cloudSync.initialize()];
                    case 1:
                        _a.sent();
                        console.log('[SyncMethodManager] Cloud sync initialized');
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    SyncMethodManager.prototype.stop = function () {
        if (this.wifiSync) {
            this.wifiSync.stop();
            this.wifiSync = null;
        }
        if (this.cloudSync) {
            this.cloudSync.disconnect();
            this.cloudSync = null;
        }
        console.log('[SyncMethodManager] All sync services stopped');
    };
    SyncMethodManager.prototype.syncClipboard = function (text) {
        var _a, _b;
        if (this.syncOptions.clipboard) {
            if (this.currentMode === 'local' || this.currentMode === 'local_cloud') {
                (_a = this.wifiSync) === null || _a === void 0 ? void 0 : _a.broadcastClipboard(text);
            }
            if (this.currentMode === 'cloud' || this.currentMode === 'local_cloud') {
                (_b = this.cloudSync) === null || _b === void 0 ? void 0 : _b.syncClipboard(text);
            }
        }
    };
    SyncMethodManager.prototype.syncHistory = function (history) {
        var _a;
        if (this.syncOptions.history) {
            if (this.currentMode === 'cloud' || this.currentMode === 'local_cloud') {
                (_a = this.cloudSync) === null || _a === void 0 ? void 0 : _a.syncHistory(history);
            }
        }
    };
    SyncMethodManager.prototype.sendDesktopControl = function (action, args) {
        return __awaiter(this, void 0, void 0, function () {
            var targetDevices, _i, targetDevices_1, device;
            return __generator(this, function (_a) {
                targetDevices = this.getOnlineDevices().filter(function (d) { return d.deviceType === 'desktop'; });
                for (_i = 0, targetDevices_1 = targetDevices; _i < targetDevices_1.length; _i++) {
                    device = targetDevices_1[_i];
                    if (device.connectionType === 'local' && this.wifiSync) {
                        return [2 /*return*/, this.wifiSync.sendDesktopControl(action, args)];
                    }
                    else if (device.connectionType === 'cloud' && this.cloudSync) {
                        return [2 /*return*/, this.cloudSync.sendDesktopControl(device.deviceId, action, args)];
                    }
                }
                throw new Error('No desktop device available');
            });
        });
    };
    SyncMethodManager.prototype.forwardPromptToDesktop = function (prompt, promptId) {
        if (this.syncOptions.desktopControl) {
            var desktopDevices = this.getOnlineDevices().filter(function (d) { return d.deviceType === 'desktop'; });
            for (var _i = 0, desktopDevices_1 = desktopDevices; _i < desktopDevices_1.length; _i++) {
                var device = desktopDevices_1[_i];
                if (device.connectionType === 'local' && this.wifiSync) {
                    this.wifiSync.sendAIResponse(promptId || Date.now().toString(), prompt, false);
                }
                else if (device.connectionType === 'cloud' && this.cloudSync) {
                    this.cloudSync.forwardPrompt(device.deviceId, prompt, promptId);
                }
            }
        }
    };
    return SyncMethodManager;
}(events_1.EventEmitter));
exports.SyncMethodManager = SyncMethodManager;
exports.syncMethodManager = SyncMethodManager.getInstance();

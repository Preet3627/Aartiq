"use strict";
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
var app_1 = require("firebase/app");
var auth_1 = require("firebase/auth");
var firestore_1 = require("firebase/firestore");
var firebaseConfigStorage_1 = require("./firebaseConfigStorage");
var FirebaseService = /** @class */ (function () {
    function FirebaseService() {
        this.app = null;
        this.auth = null;
        this.firestore = null;
        this.authReadyCallbacks = [];
        this.authInitialized = false;
        this.persistenceReady = Promise.resolve();
        this.initializeFirebase();
    }
    FirebaseService.prototype.reinitialize = function () {
        console.log("[Firebase] Reinitializing with new config...");
        this.initializeFirebase();
    };
    FirebaseService.prototype.initializeFirebase = function () {
        var _this = this;
        try {
            // Get Firebase config from stored config (from landing page) or fallback to env vars
            var getFirebaseConfig = function () {
                // First, try to load from localStorage (received from landing page)
                var storedConfig = firebaseConfigStorage_1.firebaseConfigStorage.load();
                if (storedConfig) {
                    return storedConfig;
                }
                // Fallback to environment variables
                return {
                    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
                    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
                    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
                    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
                    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
                };
            };
            var firebaseConfig = getFirebaseConfig();
            // Only initialize if we have valid config
            if (firebaseConfig.apiKey) {
                this.app = !(0, app_1.getApps)().length ? (0, app_1.initializeApp)(firebaseConfig) : (0, app_1.getApp)();
                this.auth = (0, auth_1.getAuth)(this.app);
                this.firestore = (0, firestore_1.getFirestore)(this.app);
                this.persistenceReady = (0, auth_1.setPersistence)(this.auth, auth_1.browserLocalPersistence)
                    .then(function () {
                    console.log('[Firebase] Auth persistence set to local.');
                })
                    .catch(function (error) {
                    console.warn('[Firebase] Failed to enable local auth persistence:', error);
                });
                // Listen for the initial auth state to set authInitialized
                this.auth.onAuthStateChanged(function () {
                    _this.authInitialized = true;
                    _this.authReadyCallbacks.forEach(function (cb) { return cb(); });
                    _this.authReadyCallbacks = []; // Clear callbacks after execution
                });
            }
        }
        catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    };
    FirebaseService.prototype.onAuthReady = function (callback) {
        if (this.authInitialized) {
            callback();
        }
        else {
            this.authReadyCallbacks.push(callback);
        }
    };
    FirebaseService.prototype.ensurePersistenceReady = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.persistenceReady];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    FirebaseService.prototype.signInWithCustomToken = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.auth)
                            return [2 /*return*/, null];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.ensurePersistenceReady()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, auth_1.signInWithCustomToken)(this.auth, token)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.user];
                    case 4:
                        error_1 = _a.sent();
                        console.error("Error signing in with custom token:", error_1);
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    FirebaseService.prototype.signInWithCredential = function (credential) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.auth)
                            return [2 /*return*/, null];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.ensurePersistenceReady()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, auth_1.signInWithCredential)(this.auth, credential)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.user];
                    case 4:
                        error_2 = _a.sent();
                        console.error("Error signing in with credential:", error_2);
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    FirebaseService.prototype.signInWithGoogle = function () {
        return __awaiter(this, void 0, void 0, function () {
            var provider, result, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.auth)
                            return [2 /*return*/, null];
                        provider = new auth_1.GoogleAuthProvider();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.ensurePersistenceReady()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, auth_1.signInWithPopup)(this.auth, provider)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.user];
                    case 4:
                        error_3 = _a.sent();
                        console.error("Error signing in with Google:", error_3);
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    FirebaseService.prototype.handleRedirectResult = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.auth)
                            return [2 /*return*/, null];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.ensurePersistenceReady()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, auth_1.getRedirectResult)(this.auth)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result ? result.user : null];
                    case 4:
                        error_4 = _a.sent();
                        console.error("Error handling redirect result:", error_4);
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // Sign out
    FirebaseService.prototype.signOut = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.auth) {
                            console.error("Firebase Auth not initialized.");
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, auth_1.signOut)(this.auth)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        console.error("Error during sign-out:", error_5);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Listen for auth state changes
    FirebaseService.prototype.onAuthStateChanged = function (callback) {
        var _this = this;
        if (!this.auth) {
            // If auth isn't ready, wait for it and then register the callback
            this.onAuthReady(function () {
                if (_this.auth) {
                    var unsubscribe = (0, auth_1.onAuthStateChanged)(_this.auth, callback);
                }
            });
            return function () { }; // return empty cleanup for now
        }
        return (0, auth_1.onAuthStateChanged)(this.auth, callback);
    };
    // Add a new history entry for a user
    FirebaseService.prototype.addHistoryEntry = function (userId, url, title) {
        return __awaiter(this, void 0, void 0, function () {
            var historyCollectionRef, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.firestore) {
                            console.error("Firebase Firestore not initialized.");
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        if (!userId) {
                            throw new Error("User ID is required to add a history entry.");
                        }
                        historyCollectionRef = (0, firestore_1.collection)(this.firestore, "users/".concat(userId, "/history"));
                        return [4 /*yield*/, (0, firestore_1.addDoc)(historyCollectionRef, {
                                url: url,
                                title: title,
                                timestamp: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_6 = _a.sent();
                        console.error("Error adding history entry:", error_6);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Get a user's history
    FirebaseService.prototype.getHistory = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var historyCollectionRef, q, querySnapshot, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.firestore) {
                            console.error("Firebase Firestore not initialized.");
                            return [2 /*return*/, []];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        if (!userId) {
                            throw new Error("User ID is required to get history.");
                        }
                        historyCollectionRef = (0, firestore_1.collection)(this.firestore, "users/".concat(userId, "/history"));
                        q = (0, firestore_1.query)(historyCollectionRef, (0, firestore_1.orderBy)("timestamp", "desc"));
                        return [4 /*yield*/, (0, firestore_1.getDocs)(q)];
                    case 2:
                        querySnapshot = _a.sent();
                        return [2 /*return*/, querySnapshot.docs.map(function (doc) { return (__assign({ id: doc.id }, doc.data())); })];
                    case 3:
                        error_7 = _a.sent();
                        console.error("Error getting history:", error_7);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return FirebaseService;
}());
var firebaseService = new FirebaseService();
exports.default = firebaseService;

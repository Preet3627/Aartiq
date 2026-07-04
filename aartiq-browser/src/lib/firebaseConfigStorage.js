"use strict";
// Utility to store and retrieve Firebase config from localStorage
// This allows the desktop app to receive Firebase config from the landing page
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseConfigStorage = void 0;
var FIREBASE_CONFIG_KEY = 'comet-firebase-config';
exports.firebaseConfigStorage = {
    save: function (config) {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
            }
        }
        catch (error) {
            console.error('Failed to save Firebase config:', error);
        }
    },
    load: function () {
        try {
            if (typeof window !== 'undefined') {
                var stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
                if (stored) {
                    return JSON.parse(stored);
                }
            }
        }
        catch (error) {
            console.error('Failed to load Firebase config:', error);
        }
        return null;
    },
    clear: function () {
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(FIREBASE_CONFIG_KEY);
            }
        }
        catch (error) {
            console.error('Failed to clear Firebase config:', error);
        }
    }
};

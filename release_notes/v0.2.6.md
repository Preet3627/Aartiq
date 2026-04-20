# Comet AI Browser - Release Notes v0.2.6

**Release Date:** March 30, 2026

---

## 🎯 What's New

### Native Google Sign-In with Firebase Auth

#### Fast & Reliable Authentication
- **Native Google Sign-In** - Uses `google_sign_in` package for native dialog instead of web redirect
- **Firebase Auth Integration** - Same user identity works across mobile and desktop
- **Secure Token Storage** - Auth tokens stored using `FlutterSecureStorage` with Android Keystore/iOS Keychain

#### How It Works
```
┌─────────────────────────────────────────────────────────────────┐
│  1. User taps "Sign in with Google" in Flutter app               │
│  2. Native Google sign-in dialog opens                           │
│  3. User selects Google account                                  │
│  4. Firebase Auth receives credentials                          │
│  5. Tokens stored securely in Android Keystore / iOS Keychain   │
│  6. User is logged in and synced to cloud                       │
└─────────────────────────────────────────────────────────────────┘
```

#### Cloud Sync Benefits
- **Same Identity** - Firebase Auth ensures one user ID across all devices
- **Real-time Sync** - Desktop can verify mobile user via Firebase
- **Cross-Device Auth** - Mobile sign-in enables desktop features

---

## 🔐 Security Features

### Secure Storage Implementation
```dart
// Android: Uses Android Keystore with EncryptedSharedPreferences
FlutterSecureStorage(
  aOptions: AndroidOptions(
    encryptedSharedPreferences: true,
    sharedPreferencesName: 'comet_secure_prefs',
  ),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
)
```

### Token Storage Keys
- `comet_auth_user_id` - Firebase UID
- `comet_auth_user_email` - User email
- `comet_auth_user_name` - Display name
- `comet_auth_user_photo` - Profile photo URL
- `comet_auth_id_token` - Firebase ID token

---

## 📱 Deep Link Support

### Supported Deep Links
| Deep Link | Purpose |
|-----------|---------|
| `comet-ai://auth` | Open auth page |
| `comet-ai://connect` | Connect desktop page |
| `comet-ai://chat?message=...` | Open AI chat with message |

---

## 🚀 Technical Changes

### Flutter Dependencies
- `google_sign_in: ^6.2.1` - Native Google Sign-In (already present)
- `firebase_auth: ^5.5.1` - Firebase Authentication (already present)
- `flutter_secure_storage: ^9.2.2` - Secure token storage

### Files Modified

#### Flutter App
- `lib/auth_service.dart` - Rewritten with native Google Sign-In + Firebase Auth
- `lib/pages/auth_page.dart` - Updated to use `AuthService().signInWithGoogle()`
- `lib/main.dart` - Simplified deep link handling for auth

#### Android
- `android/app/src/main/AndroidManifest.xml` - Added Google Sign-In metadata

### AuthService Methods
| Method | Description |
|--------|-------------|
| `signInWithGoogle()` | Native Google sign-in via `google_sign_in` + Firebase |
| `signOut()` | Sign out from both Google and Firebase |
| `currentFirebaseUser` | Access Firebase User object directly |
| `refreshIdToken()` | Get fresh ID token from Firebase |

---

## 📲 Mobile Authentication Flow

### Native vs Web OAuth
| Aspect | Native (Current) | Web OAuth (Previous) |
|--------|------------------|---------------------|
| Dialog | Native Google picker | Opens browser |
| Reliability | Higher (no redirect) | Lower (network dependent) |
| Cloud Sync | ✅ Firebase Auth | ⚠️ Manual token exchange |
| Speed | Faster | Slower |
| User Experience | Better | Requires tab switching |

---

## 🔄 Cross-Device Sync Updates

### Authentication State Sync
- `FirebaseAuth.instance.authStateChanges()` listener for real-time auth state
- Auth state streams via `onAuthStateChanged` in `AuthService`
- Desktop can verify mobile user identity via Firebase UID

### Cloud Sync Features
- Firebase Auth for unified identity
- Firebase Realtime Database for real-time sync
- Clipboard synchronization
- AI prompt streaming between devices
- File generation notifications

---

## 📋 Migration Guide

### For Users
1. No action required - app works as before
2. First sign-in will use native Google dialog
3. Sessions persist securely across restarts

### For Developers
```dart
// Access Firebase user directly
final user = AuthService().currentFirebaseUser;
if (user != null) {
  final idToken = await user.getIdToken();
  // Use for desktop verification
}
```

---

## 🐛 Bug Fixes

| Issue | Fix |
|-------|-----|
| Web OAuth redirect failures | Migrated to native Google Sign-In |
| Inconsistent user identity | Using Firebase Auth UID |
| Auth state not persisting | Implemented secure storage |

---

## 📦 Dependencies (Key Packages)

```yaml
dependencies:
  firebase_auth: ^5.5.1      # Firebase Authentication
  google_sign_in: ^6.2.1      # Native Google Sign-In
  flutter_secure_storage: ^9.2.2  # Secure token storage
```

---

## 🙏 Thanks

Thanks to the community for feedback on authentication flows!

---

**Full Changelog:** [CHANGELOG.md](./CHANGELOG.md)

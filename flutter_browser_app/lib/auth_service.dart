import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  static const _storageKeyUserId = 'comet_auth_user_id';
  static const _storageKeyUserEmail = 'comet_auth_user_email';
  static const _storageKeyUserName = 'comet_auth_user_name';
  static const _storageKeyUserPhoto = 'comet_auth_user_photo';
  static const _storageKeyAuthToken = 'comet_auth_token';
  static const _storageKeyIdToken = 'comet_auth_id_token';
  static const _storageKeyRefreshToken = 'comet_auth_refresh_token';

  late FlutterSecureStorage _secureStorage;
  late GoogleSignIn _googleSignIn;
  FirebaseAuth get _firebaseAuth => FirebaseAuth.instance;

  String? _userId;
  String? _userEmail;
  String? _displayName;
  String? _photoUrl;
  String? _idToken;

  final StreamController<Map<String, dynamic>?> _authStateController =
      StreamController<Map<String, dynamic>?>.broadcast();
  Stream<Map<String, dynamic>?> get onAuthStateChanged =>
      _authStateController.stream;

  bool _isInitialized = false;

  static const String _iosClientId =
      '507073680966-4k6edbtnlnc0shv1knirfl436pou53e1.apps.googleusercontent.com';
  static const String _serverClientId =
      '507073680966-htnpcip4v3o5fhse7iqsdon9rqq8bhmk.apps.googleusercontent.com';

  Future<void> initialize() async {
    if (_isInitialized) return;

    _secureStorage = const FlutterSecureStorage(
      aOptions: AndroidOptions(
        encryptedSharedPreferences: true,
        sharedPreferencesName: 'comet_secure_prefs',
        preferencesKeyPrefix: 'comet_',
      ),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    );

    _googleSignIn = GoogleSignIn(
      clientId:
          defaultTargetPlatform == TargetPlatform.iOS ? _iosClientId : null,
      serverClientId: !kIsWeb ? _serverClientId : null,
      scopes: const ['email', 'profile'],
    );

    _firebaseAuth.authStateChanges().listen((user) {
      if (user != null) {
        _syncFromFirebaseUser(user);
      } else {
        _authStateController.add(null);
      }
    });

    await _loadStoredCredentials();
    _isInitialized = true;
  }

  Future<void> _loadStoredCredentials() async {
    try {
      _userId = await _secureStorage.read(key: _storageKeyUserId);
      _userEmail = await _secureStorage.read(key: _storageKeyUserEmail);
      _displayName = await _secureStorage.read(key: _storageKeyUserName);
      _photoUrl = await _secureStorage.read(key: _storageKeyUserPhoto);
      _idToken = await _secureStorage.read(key: _storageKeyIdToken);

      _authStateController.add(_getUserMap());
      print('[Auth] Loaded credentials for: $_userEmail');
    } catch (e) {
      print('[Auth] Failed to load credentials: $e');
    }
  }

  Future<void> _syncFromFirebaseUser(User user) async {
    _userId = user.uid;
    _userEmail = user.email;
    _displayName = user.displayName;
    _photoUrl = user.photoURL;

    try {
      _idToken = await user.getIdToken();
    } catch (e) {
      print('[Auth] Failed to get ID token: $e');
    }

    await _saveCredentials();
    _authStateController.add(_getUserMap());
  }

  Map<String, dynamic>? _getUserMap() {
    if (_userId == null) return null;
    return {
      'userId': _userId,
      'email': _userEmail,
      'displayName': _displayName,
      'photoUrl': _photoUrl,
      'idToken': _idToken,
    };
  }

  Future<bool> signInWithGoogle() async {
    try {
      print('[Auth] Starting native Google Sign-In...');

      try {
        await _googleSignIn.signOut();
      } catch (_) {}
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        print('[Auth] Google sign-in cancelled by user');
        return false;
      }

      print('[Auth] Google user: ${googleUser.email}');

      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final idToken = googleAuth.idToken;
      final accessToken = googleAuth.accessToken;
      if ((idToken == null || idToken.isEmpty) &&
          (accessToken == null || accessToken.isEmpty)) {
        print('[Auth] Google sign-in completed without Firebase tokens');
        return false;
      }

      final credential = GoogleAuthProvider.credential(
        accessToken: accessToken,
        idToken: idToken,
      );

      final UserCredential userCredential =
          await _firebaseAuth.signInWithCredential(credential);
      final User? user = userCredential.user ?? _firebaseAuth.currentUser;

      if (user != null) {
        await _syncFromFirebaseUser(user);
        print('[Auth] Firebase sign-in successful: ${user.email}');
        return true;
      }

      return false;
    } on FirebaseAuthException catch (e) {
      print(
          '[Auth] FirebaseAuth error during Google sign-in: ${e.code} ${e.message}');
      return false;
    } on PlatformException catch (e) {
      print(
          '[Auth] Platform error during Google sign-in: ${e.code} ${e.message}');
      return false;
    } catch (e) {
      print('[Auth] Google sign-in error: $e');
      return false;
    }
  }

  Future<void> _saveCredentials() async {
    try {
      if (_userId != null)
        await _secureStorage.write(key: _storageKeyUserId, value: _userId);
      if (_userEmail != null)
        await _secureStorage.write(
            key: _storageKeyUserEmail, value: _userEmail);
      if (_displayName != null)
        await _secureStorage.write(
            key: _storageKeyUserName, value: _displayName);
      if (_photoUrl != null)
        await _secureStorage.write(key: _storageKeyUserPhoto, value: _photoUrl);
      if (_idToken != null)
        await _secureStorage.write(key: _storageKeyIdToken, value: _idToken);
    } catch (e) {
      print('[Auth] Failed to save credentials: $e');
    }
  }

  Future<void> signOut() async {
    try {
      await _firebaseAuth.signOut();
      await _googleSignIn.signOut();

      await _secureStorage.delete(key: _storageKeyUserId);
      await _secureStorage.delete(key: _storageKeyUserEmail);
      await _secureStorage.delete(key: _storageKeyUserName);
      await _secureStorage.delete(key: _storageKeyUserPhoto);
      await _secureStorage.delete(key: _storageKeyAuthToken);
      await _secureStorage.delete(key: _storageKeyIdToken);
      await _secureStorage.delete(key: _storageKeyRefreshToken);

      _userId = null;
      _userEmail = null;
      _displayName = null;
      _photoUrl = null;
      _idToken = null;

      _authStateController.add(null);
      print('[Auth] Signed out');
    } catch (e) {
      print('[Auth] Sign-out error: $e');
    }
  }

  Future<void> continueAsGuest() async {
    _userId = 'guest_${DateTime.now().millisecondsSinceEpoch}';
    _displayName = 'Guest';
    _userEmail = null;
    _photoUrl = null;
    _idToken = null;
    print('[Auth] Continuing as guest');
    _authStateController.add(_getUserMap());
  }

  Future<bool> refreshIdToken() async {
    if (_userId == null) return false;

    try {
      final user = _firebaseAuth.currentUser;
      if (user != null) {
        _idToken = await user.getIdToken(true);
        await _secureStorage.write(key: _storageKeyIdToken, value: _idToken);
        return true;
      }
    } catch (e) {
      print('[Auth] Token refresh failed: $e');
    }
    return false;
  }

  String? get userId => _userId;
  String? get userEmail => _userEmail;
  String? get displayName => _displayName;
  String? get photoUrl => _photoUrl;
  String? get idToken => _idToken;

  bool get isAuthenticated => _userId != null && !_userId!.startsWith('guest_');
  bool get isGuest => _userId == null || _userId!.startsWith('guest_');
  User? get currentFirebaseUser => _firebaseAuth.currentUser;
}

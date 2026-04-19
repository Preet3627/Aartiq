const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HELPER_FILE = 'SharedKeychain.swift';
const SHARED_ACCOUNT = 'default';
const IDENTITY_SESSION_SERVICE = 'in.ponsri.shared.google.identity';
const WORKSPACE_SESSION_SERVICE = 'in.ponsri.shared.google.workspace';
const GOOGLE_SCOPE_PREFIX = 'https://www.googleapis.com/auth/';

const SHARED_KEYCHAIN_SCRIPT = String.raw`import Foundation
import Security

struct KeychainResponse: Codable {
    let success: Bool
    let found: Bool?
    let value: String?
    let error: String?
}

func emit(_ response: KeychainResponse) {
    let encoder = JSONEncoder()
    let data = try! encoder.encode(response)
    print(String(data: data, encoding: .utf8)!)
}

let args = Array(CommandLine.arguments.dropFirst())

guard args.count >= 4 else {
    emit(KeychainResponse(success: false, found: nil, value: nil, error: "Usage: SharedKeychain.swift <get|set|delete> <service> <account> <synchronizable:0|1> [accessGroup] [base64Value]"))
    exit(1)
}

let action = args[0]
let service = args[1]
let account = args[2]
let synchronizable = args[3] == "1"
let accessGroup = args.count > 4 ? args[4] : ""
let base64Value = args.count > 5 ? args[5] : ""

func buildQuery(returnData: Bool = false) -> [String: Any] {
    var query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecUseDataProtectionKeychain as String: true
    ]

    query[kSecAttrSynchronizable as String] = synchronizable ? kCFBooleanTrue : kCFBooleanFalse

    if !accessGroup.isEmpty {
        query[kSecAttrAccessGroup as String] = accessGroup
    }

    if returnData {
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
    }

    return query
}

switch action {
case "get":
    var item: CFTypeRef?
    let status = SecItemCopyMatching(buildQuery(returnData: true) as CFDictionary, &item)

    if status == errSecItemNotFound {
        emit(KeychainResponse(success: true, found: false, value: nil, error: nil))
        exit(0)
    }

    guard status == errSecSuccess else {
        emit(KeychainResponse(success: false, found: nil, value: nil, error: "SecItemCopyMatching failed with status \(status)"))
        exit(1)
    }

    guard let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
        emit(KeychainResponse(success: false, found: nil, value: nil, error: "Stored value could not be decoded as UTF-8"))
        exit(1)
    }

    emit(KeychainResponse(success: true, found: true, value: value, error: nil))

case "set":
    guard let decoded = Data(base64Encoded: base64Value) else {
        emit(KeychainResponse(success: false, found: nil, value: nil, error: "Invalid base64 payload"))
        exit(1)
    }

    let query = buildQuery()
    let attributes: [String: Any] = [kSecValueData as String: decoded]
    let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)

    if updateStatus == errSecSuccess {
        emit(KeychainResponse(success: true, found: true, value: nil, error: nil))
        exit(0)
    }

    if updateStatus != errSecItemNotFound {
        SecItemDelete(query as CFDictionary)
    }

    var addQuery = query
    addQuery[kSecValueData as String] = decoded
    let addStatus = SecItemAdd(addQuery as CFDictionary, nil)

    guard addStatus == errSecSuccess else {
        emit(KeychainResponse(success: false, found: nil, value: nil, error: "SecItemAdd failed with status \(addStatus)"))
        exit(1)
    }

    emit(KeychainResponse(success: true, found: true, value: nil, error: nil))

case "delete":
    let status = SecItemDelete(buildQuery() as CFDictionary)

    guard status == errSecSuccess || status == errSecItemNotFound else {
        emit(KeychainResponse(success: false, found: nil, value: nil, error: "SecItemDelete failed with status \(status)"))
        exit(1)
    }

    emit(KeychainResponse(success: true, found: status == errSecSuccess, value: nil, error: nil))

default:
    emit(KeychainResponse(success: false, found: nil, value: nil, error: "Unknown action \(action)"))
    exit(1)
}
`;

function getAccessGroup() {
  return (
    process.env.SHARED_KEYCHAIN_ACCESS_GROUP ||
    process.env.COMET_SHARED_KEYCHAIN_ACCESS_GROUP ||
    ''
  );
}

function ensureHelper(app) {
  const dir = path.join(app.getPath('userData'), 'swift');
  fs.mkdirSync(dir, { recursive: true });
  const helperPath = path.join(dir, HELPER_FILE);
  fs.writeFileSync(helperPath, SHARED_KEYCHAIN_SCRIPT, 'utf8');
  return helperPath;
}

function runHelper(app, action, service, payload) {
  const helperPath = ensureHelper(app);
  const args = [
    helperPath,
    action,
    service,
    SHARED_ACCOUNT,
    '1',
    getAccessGroup(),
  ];

  if (payload !== undefined) {
    args.push(Buffer.from(payload, 'utf8').toString('base64'));
  }

  const stdout = execFileSync('/usr/bin/swift', args, { encoding: 'utf8' });
  return JSON.parse(stdout);
}

function parseScopes(sessionPayload = {}) {
  if (Array.isArray(sessionPayload.scopes)) {
    return sessionPayload.scopes.filter(Boolean);
  }

  if (typeof sessionPayload.scope === 'string') {
    return sessionPayload.scope.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
  }

  return [];
}

function serializeFirebaseConfig(firebaseConfig) {
  if (!firebaseConfig) {
    return null;
  }

  if (typeof firebaseConfig === 'string') {
    return firebaseConfig;
  }

  try {
    return JSON.stringify(firebaseConfig);
  } catch {
    return null;
  }
}

function buildSharedSession(sessionPayload = {}) {
  const user = sessionPayload.user || {};
  const scopes = parseScopes(sessionPayload);
  const expiresAt =
    sessionPayload.expires_at ||
    sessionPayload.expiresAt ||
    (Number.isFinite(sessionPayload.expiresIn)
      ? Math.floor(Date.now() / 1000) + Number(sessionPayload.expiresIn) - 60
      : null);

  return {
    uid: user.uid || sessionPayload.uid || null,
    email: user.email || sessionPayload.email || null,
    name: user.displayName || sessionPayload.name || null,
    photo: user.photoURL || sessionPayload.photo || null,
    access_token:
      sessionPayload.accessToken || sessionPayload.access_token || null,
    refresh_token:
      sessionPayload.refreshToken || sessionPayload.refresh_token || null,
    id_token: sessionPayload.idToken || sessionPayload.id_token || null,
    expires_at: expiresAt,
    scopes,
    firebase_config: serializeFirebaseConfig(
      sessionPayload.firebaseConfig || sessionPayload.firebase_config,
    ),
    source: sessionPayload.source || 'comet-browser',
  };
}

function parseSharedSession(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const session = JSON.parse(rawValue);
    let firebaseConfig = session.firebase_config || null;

    if (typeof firebaseConfig === 'string') {
      try {
        firebaseConfig = JSON.parse(firebaseConfig);
      } catch {
        firebaseConfig = null;
      }
    }

    return {
      token: session.id_token || session.access_token || null,
      accessToken: session.access_token || null,
      refreshToken: session.refresh_token || null,
      idToken: session.id_token || null,
      expiresAt: session.expires_at || null,
      scope: Array.isArray(session.scopes) ? session.scopes.join(' ') : '',
      scopes: Array.isArray(session.scopes) ? session.scopes : [],
      user:
        session.uid || session.email
          ? {
              uid: session.uid || '',
              email: session.email || '',
              displayName:
                session.name || (session.email ? session.email.split('@')[0] : ''),
              photoURL: session.photo || '',
            }
          : null,
      firebaseConfig,
      provider: session.source || 'shared-keychain',
      source: session.source || 'shared-keychain',
    };
  } catch {
    return null;
  }
}

function hasWorkspaceScopes(scopes = []) {
  return scopes.some(
    (scope) =>
      scope.startsWith(`${GOOGLE_SCOPE_PREFIX}gmail`) ||
      scope.startsWith(`${GOOGLE_SCOPE_PREFIX}drive`),
  );
}

function saveSharedAuthSession(app, sessionPayload = {}) {
  const sharedSession = buildSharedSession(sessionPayload);
  runHelper(app, 'set', IDENTITY_SESSION_SERVICE, JSON.stringify(sharedSession));

  if (
    hasWorkspaceScopes(sharedSession.scopes) ||
    sharedSession.refresh_token ||
    sharedSession.access_token
  ) {
    runHelper(
      app,
      'set',
      WORKSPACE_SESSION_SERVICE,
      JSON.stringify(sharedSession),
    );
  }
}

function loadSharedAuthSession(app) {
  const workspaceResponse = runHelper(app, 'get', WORKSPACE_SESSION_SERVICE);
  if (workspaceResponse?.found && workspaceResponse.value) {
    return parseSharedSession(workspaceResponse.value);
  }

  const identityResponse = runHelper(app, 'get', IDENTITY_SESSION_SERVICE);
  if (identityResponse?.found && identityResponse.value) {
    return parseSharedSession(identityResponse.value);
  }

  return null;
}

function clearSharedAuthSession(app) {
  runHelper(app, 'delete', IDENTITY_SESSION_SERVICE);
  runHelper(app, 'delete', WORKSPACE_SESSION_SERVICE);
}

module.exports = {
  saveSharedAuthSession,
  loadSharedAuthSession,
  clearSharedAuthSession,
};

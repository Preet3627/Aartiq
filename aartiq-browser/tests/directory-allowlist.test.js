/**
 * directory-allowlist.test.js — Tests for the directory allowlist system.
 *
 * Covers:
 *   §2 — Path canonicalization (symlink/traversal prevention)
 *   §6 — Sandbox profile generation (Seatbelt/bubblewrap)
 *   §8 — Read/write separation enforcement
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  canonicalizePath,
  isPathAllowed,
  getSandboxDirs,
  DEFAULT_ALLOWED_DIRECTORIES,
} = require('../src/core/directory-allowlist');

const {
  generateSeatbeltProfile,
  buildBubblewrapArgs,
} = require('../src/core/sandbox-executor');

// ---------------------------------------------------------------------------
// §2 — Path Canonicalization (security-critical)
// ---------------------------------------------------------------------------

describe('Path Canonicalization (§2)', () => {
  it('should resolve a normal absolute path', () => {
    const { canonical, resolved } = canonicalizePath('/usr/local/bin');
    assert.strictEqual(canonical, '/usr/local/bin');
    assert.strictEqual(resolved, true);
  });

  it('should expand ~ to home directory', () => {
    const { canonical } = canonicalizePath('~/Documents');
    assert.strictEqual(canonical, path.join(os.homedir(), 'Documents'));
  });

  it('should normalize .. traversal segments', () => {
    const { canonical } = canonicalizePath('/usr/local/../bin');
    assert.strictEqual(canonical, '/usr/bin');
  });

  it('should resolve a symlink to its real target', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-test-'));
    const realDir = path.join(tmpDir, 'real');
    const linkDir = path.join(tmpDir, 'link');
    fs.mkdirSync(realDir);
    fs.symlinkSync(realDir, linkDir);

    try {
      const { canonical, resolved } = canonicalizePath(linkDir);
      // Both realDir and linkDir should resolve to the same canonical path
      const { canonical: expectedReal } = canonicalizePath(realDir);
      assert.strictEqual(canonical, expectedReal);
      assert.strictEqual(resolved, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should detect symlink traversal out of allowed boundary', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-test-'));
    const allowedDir = path.join(tmpDir, 'allowed');
    const secretDir = path.join(tmpDir, 'secret');
    const symlinkInAllowed = path.join(allowedDir, 'escape');

    fs.mkdirSync(allowedDir);
    fs.mkdirSync(secretDir);
    fs.symlinkSync(secretDir, symlinkInAllowed);

    try {
      const { canonical } = canonicalizePath(symlinkInAllowed);
      const { canonical: expectedSecret } = canonicalizePath(secretDir);
      const { canonical: expectedAllowed } = canonicalizePath(allowedDir);
      // The symlink resolves OUTSIDE the allowed directory
      assert.strictEqual(canonical, expectedSecret);
      assert.ok(!canonical.startsWith(expectedAllowed + path.sep));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should handle non-existent paths by resolving parent', () => {
    const { canonical, resolved } = canonicalizePath('/tmp/nonexistent/deep/file.txt');
    assert.ok(canonical.startsWith('/tmp'));
    // resolved should be false since the full path doesn't exist
    assert.strictEqual(resolved, false);
  });

  it('should return empty string for invalid input', () => {
    const { canonical, resolved } = canonicalizePath('');
    assert.strictEqual(canonical, '');
    assert.strictEqual(resolved, false);
  });

  it('should return empty string for null/undefined input', () => {
    assert.deepStrictEqual(canonicalizePath(null), { canonical: '', resolved: false });
    assert.deepStrictEqual(canonicalizePath(undefined), { canonical: '', resolved: false });
  });
});

// ---------------------------------------------------------------------------
// §2 + §8 — isPathAllowed with canonicalization and read/write separation
// ---------------------------------------------------------------------------

describe('isPathAllowed (§2 + §8)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-test-'));
  const allowedRw = path.join(tmpDir, 'rw');
  const allowedReadOnly = path.join(tmpDir, 'readonly');
  const outsideDir = path.join(tmpDir, 'outside');

  fs.mkdirSync(allowedRw);
  fs.mkdirSync(allowedReadOnly);
  fs.mkdirSync(outsideDir);

  // Canonicalize for comparisons
  const { canonical: realAllowedRw } = canonicalizePath(allowedRw);
  const { canonical: realAllowedReadOnly } = canonicalizePath(allowedReadOnly);
  const { canonical: realOutsideDir } = canonicalizePath(outsideDir);

  const allowlist = [
    { path: allowedRw, recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'test' },
    { path: allowedReadOnly, recursive: true, access: 'read', grantedAt: 0, grantedVia: 'test' },
  ];

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should allow read access to read-write directory', () => {
    const result = isPathAllowed(path.join(allowedRw, 'file.txt'), allowlist, 'read');
    assert.strictEqual(result.allowed, true);
  });

  it('should allow write access to read-write directory', () => {
    const result = isPathAllowed(path.join(allowedRw, 'file.txt'), allowlist, 'write');
    assert.strictEqual(result.allowed, true);
  });

  it('should allow read access to read-only directory', () => {
    const result = isPathAllowed(path.join(allowedReadOnly, 'file.txt'), allowlist, 'read');
    assert.strictEqual(result.allowed, true);
  });

  it('should deny write access to read-only directory (§8)', () => {
    const result = isPathAllowed(path.join(allowedReadOnly, 'file.txt'), allowlist, 'write');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('read-only'));
  });

  it('should deny access to path outside all allowed directories', () => {
    const result = isPathAllowed(path.join(outsideDir, 'file.txt'), allowlist, 'read');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('outside'));
  });

  it('should deny traversal escape via .. in path', () => {
    const traversalPath = path.join(allowedRw, '..', 'outside', 'file.txt');
    const result = isPathAllowed(traversalPath, allowlist, 'read');
    assert.strictEqual(result.allowed, false);
  });

  it('should deny symlink traversal out of boundary', () => {
    const linkDir = path.join(allowedRw, 'escape-link');
    const secretFile = path.join(outsideDir, 'secret.txt');
    try {
      fs.symlinkSync(outsideDir, linkDir);
      const result = isPathAllowed(path.join(linkDir, 'secret.txt'), allowlist, 'read');
      assert.strictEqual(result.allowed, false);
    } finally {
      try { fs.unlinkSync(linkDir); } catch (e) {}
    }
  });

  it('should reject empty/invalid input', () => {
    assert.strictEqual(isPathAllowed('', allowlist, 'read').allowed, false);
    assert.strictEqual(isPathAllowed(null, allowlist, 'read').allowed, false);
    assert.strictEqual(isPathAllowed('/tmp/x', [], 'read').allowed, false);
    assert.strictEqual(isPathAllowed('/tmp/x', allowlist, 'invalid').allowed, false);
  });

  it('should deny write when allowlist is empty', () => {
    assert.strictEqual(isPathAllowed('/tmp/x', [], 'write').allowed, false);
  });
});

// ---------------------------------------------------------------------------
// §1 — Default allowlist entries
// ---------------------------------------------------------------------------

describe('Default Allowlist (§1)', () => {
  it('should have at least 1 default entry (Aartiq Browser data directory)', () => {
    assert.ok(DEFAULT_ALLOWED_DIRECTORIES.length >= 1);
  });

  it('each default entry should have required fields', () => {
    for (const entry of DEFAULT_ALLOWED_DIRECTORIES) {
      assert.ok(entry.path, 'entry must have a path');
      assert.strictEqual(typeof entry.recursive, 'boolean');
      assert.ok(['read', 'read-write'].includes(entry.access));
      assert.strictEqual(typeof entry.grantedAt, 'number');
      assert.ok(entry.grantedVia, 'entry must have grantedVia');
    }
  });

  it('default entries should include the Aartiq Browser data directory', () => {
    const aartiqEntry = DEFAULT_ALLOWED_DIRECTORIES.find(e => e.path.includes('aartiq'));
    assert.ok(aartiqEntry, 'should include the Aartiq Browser data directory');
    assert.strictEqual(aartiqEntry.access, 'read-write');
  });

  it('should NOT include the entire home directory by default', () => {
    const homeEntry = DEFAULT_ALLOWED_DIRECTORIES.find(e => e.path === os.homedir());
    assert.ok(!homeEntry, 'should not include the entire home directory');
  });
});

// ---------------------------------------------------------------------------
// §6 — Sandbox profile generation from allowlist
// ---------------------------------------------------------------------------

describe('Sandbox Profile Generation (§6)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-test-'));
  const dirRW = path.join(tmpDir, 'rw-dir');
  const dirRO = path.join(tmpDir, 'ro-dir');
  const dirNo = path.join(tmpDir, 'no-access');
  fs.mkdirSync(dirRW);
  fs.mkdirSync(dirRO);
  fs.mkdirSync(dirNo);

  // Canonicalize paths (macOS resolves /tmp to /private/tmp)
  const { canonical: realDirRW } = canonicalizePath(dirRW);
  const { canonical: realDirRO } = canonicalizePath(dirRO);
  const { canonical: realDirNo } = canonicalizePath(dirNo);

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Seatbelt profile (macOS)', () => {
    const allowlist = [
      { path: dirRW, recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'test' },
      { path: dirRO, recursive: true, access: 'read', grantedAt: 0, grantedVia: 'test' },
    ];

    it('should include read-write dir in both write and read rules', () => {
      const profile = generateSeatbeltProfile({ directoryAllowlist: allowlist });
      assert.ok(profile.includes(realDirRW), 'read-write dir should appear in profile');
      assert.ok(profile.includes('file-write*'), 'should contain file-write rules');
      assert.ok(profile.includes('file-read*'), 'should contain file-read rules');
    });

    it('should NOT include no-access dir', () => {
      const profile = generateSeatbeltProfile({ directoryAllowlist: allowlist });
      assert.ok(!profile.includes(realDirNo), 'no-access dir should NOT appear in profile');
    });

    it('should include /tmp for write', () => {
      const { canonical: realTmp } = canonicalizePath('/tmp');
      const profile = generateSeatbeltProfile({ directoryAllowlist: allowlist });
      assert.ok(profile.includes(realTmp), 'should include /tmp');
    });

    it('should deny network when no network allowlist', () => {
      const profile = generateSeatbeltProfile({ directoryAllowlist: allowlist });
      assert.ok(profile.includes('(deny network*)'));
    });

    it('should allow specific network when network allowlist provided', () => {
      const profile = generateSeatbeltProfile({
        directoryAllowlist: allowlist,
        networkAllowlist: ['api.openai.com'],
      });
      // The domain is regex-escaped in the profile (dots become \.)
      assert.ok(profile.includes('api\\.openai\\.com') || profile.includes('api.openai.com'));
    });

    it('should fallback to workspace-only when no allowlist', () => {
      const profile = generateSeatbeltProfile({ workspace: '/fallback' });
      assert.ok(profile.includes('/fallback'));
    });

    it('adding a directory should make it appear in profile', () => {
      const profile1 = generateSeatbeltProfile({ directoryAllowlist: [] });
      const profile2 = generateSeatbeltProfile({
        directoryAllowlist: [{ path: dirRW, recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'test' }],
      });
      assert.ok(!profile1.includes(realDirRW), 'before: dir should not appear');
      assert.ok(profile2.includes(realDirRW), 'after: dir should appear');
    });

    it('revoking a directory should remove it from profile', () => {
      const full = [{ path: dirRW, recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'test' }];
      const empty = [];
      const profile1 = generateSeatbeltProfile({ directoryAllowlist: full });
      const profile2 = generateSeatbeltProfile({ directoryAllowlist: empty });
      assert.ok(profile1.includes(realDirRW), 'before revoke: dir should appear');
      assert.ok(!profile2.includes(realDirRW), 'after revoke: dir should NOT appear');
    });
  });

  describe('Bubblewrap args (Linux)', () => {
    const allowlist = [
      { path: dirRW, recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'test' },
      { path: dirRO, recursive: true, access: 'read', grantedAt: 0, grantedVia: 'test' },
    ];

    it('should emit --bind for read-write dirs', () => {
      const args = buildBubblewrapArgs('ls', [], { directoryAllowlist: allowlist });
      const bindIdx = args.indexOf('--bind');
      assert.ok(bindIdx >= 0, 'should have --bind');
      assert.strictEqual(args[bindIdx + 1], realDirRW);
    });

    it('should emit --ro-bind for read-only dirs', () => {
      const args = buildBubblewrapArgs('ls', [], { directoryAllowlist: allowlist });
      let found = false;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--ro-bind' && args[i + 1] === realDirRO) {
          found = true;
          break;
        }
      }
      assert.ok(found, 'should have --ro-bind for read-only dir');
    });

    it('should NOT include no-access dir', () => {
      const args = buildBubblewrapArgs('ls', [], { directoryAllowlist: allowlist });
      assert.ok(!args.includes(realDirNo), 'no-access dir should not appear');
    });

    it('should fallback to workspace when no allowlist', () => {
      const args = buildBubblewrapArgs('ls', [], { workspace: '/fallback' });
      const bindIdx = args.indexOf('--bind');
      assert.ok(bindIdx >= 0);
      assert.strictEqual(args[bindIdx + 1], '/fallback');
    });
  });
});

// ---------------------------------------------------------------------------
// getSandboxDirs utility
// ---------------------------------------------------------------------------

describe('getSandboxDirs', () => {
  it('should separate read and write dirs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-test-'));
    const rwDir = path.join(tmpDir, 'rw');
    const roDir = path.join(tmpDir, 'ro');
    fs.mkdirSync(rwDir);
    fs.mkdirSync(roDir);
    const { canonical: realRwDir } = canonicalizePath(rwDir);
    const { canonical: realRoDir } = canonicalizePath(roDir);

    try {
      const allowlist = [
        { path: rwDir, recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'test' },
        { path: roDir, recursive: true, access: 'read', grantedAt: 0, grantedVia: 'test' },
      ];
      const { readDirs, writeDirs } = getSandboxDirs(allowlist);
      assert.ok(writeDirs.includes(realRwDir));
      assert.ok(readDirs.includes(realRoDir));
      assert.ok(!writeDirs.includes(realRoDir));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should include /tmp in read dirs', () => {
    const { canonical: realTmp } = canonicalizePath('/tmp');
    const { readDirs } = getSandboxDirs([{ path: '/tmp/x', recursive: true, access: 'read', grantedAt: 0, grantedVia: 'test' }]);
    assert.ok(readDirs.includes(realTmp));
  });

  it('should return empty arrays for empty/null input', () => {
    assert.deepStrictEqual(getSandboxDirs([]), { readDirs: [], writeDirs: [] });
    assert.deepStrictEqual(getSandboxDirs(null), { readDirs: [], writeDirs: [] });
  });
});

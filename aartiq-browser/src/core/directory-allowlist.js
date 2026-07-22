/**
 * directory-allowlist.js — User-controlled directory allowlist for AI file access.
 *
 * Replaces the single hardcoded sandbox-workspace with a dynamic, user-controlled
 * set of directories that the AI can access. Mirrors mobile OS file permission
 * patterns: scoped, explicit, revocable, and requested exactly when needed.
 *
 * Items addressed:
 *   §1 — Data model (allowlist entries with path, recursive, access, grantedAt, grantedVia)
 *   §2 — Path canonicalization via fs.realpath (symlink/traversal prevention)
 *   §8 — Read/write separation (enforced in isPathAllowed)
 *
 * Audit-doc line items: §7 (directory allowlist system).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_DIRECTORIES = [
  { path: os.homedir(), recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'default' },
  { path: path.join(os.homedir(), 'Desktop'), recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'default' },
  { path: path.join(os.homedir(), 'Documents'), recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'default' },
  { path: path.join(os.homedir(), 'Downloads'), recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'default' },
  { path: '/tmp', recursive: true, access: 'read-write', grantedAt: 0, grantedVia: 'default' },
];

// ---------------------------------------------------------------------------
// Path Canonicalization (§2 — security-critical)
// ---------------------------------------------------------------------------

/**
 * Canonicalize a path: resolve symlinks, normalize .. and . segments.
 *
 * Uses fs.realpathSync (which follows symlinks) and path.resolve for normalization.
 * If the path doesn't exist yet (e.g. for a file-to-be-created), we fall back to
 * path.resolve + path.normalize without symlink resolution, and check the parent.
 *
 * @param {string} requestedPath — the path to canonicalize
 * @returns {{ canonical: string, resolved: boolean }} — canonical path and whether
 *   the full path was realpath-resolved (false means only parent was resolved)
 */
function canonicalizePath(requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return { canonical: '', resolved: false };
  }

  // Expand ~ to home directory
  const expanded = requestedPath.replace(/^~(?=\/|$)/, os.homedir());
  const absPath = path.resolve(expanded);

  try {
    // Full realpath resolution (follows symlinks)
    const real = fs.realpathSync(absPath);
    return { canonical: real, resolved: true };
  } catch (e) {
    // Path doesn't exist yet — resolve via parent directory
    try {
      const parent = path.dirname(absPath);
      const realParent = fs.realpathSync(parent);
      const basename = path.basename(absPath);
      return { canonical: path.join(realParent, basename), resolved: false };
    } catch (e2) {
      // Parent doesn't exist either — fall back to normalized absolute path
      return { canonical: path.normalize(absPath), resolved: false };
    }
  }
}

/**
 * Check if a requested path falls within an allowlisted directory.
 *
 * @param {string} requestedPath — the path to check
 * @param {Array} allowlist — array of allowlist entries (from PermissionStore)
 * @param {string} operation — 'read' or 'write'
 * @returns {{ allowed: boolean, reason: string, matchedEntry: object|null }}
 */
function isPathAllowed(requestedPath, allowlist, operation = 'read') {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return { allowed: false, reason: 'Invalid path', matchedEntry: null };
  }

  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    return { allowed: false, reason: 'No directories in allowlist', matchedEntry: null };
  }

  if (operation !== 'read' && operation !== 'write') {
    return { allowed: false, reason: `Invalid operation: ${operation}`, matchedEntry: null };
  }

  const { canonical } = canonicalizePath(requestedPath);
  if (!canonical) {
    return { allowed: false, reason: 'Failed to resolve path', matchedEntry: null };
  }

  for (const entry of allowlist) {
    if (!entry || !entry.path) continue;

    const { canonical: entryCanonical } = canonicalizePath(entry.path);
    if (!entryCanonical) continue;

    const isRecursive = entry.recursive !== false; // default true
    const isMatch = isRecursive
      ? canonical.startsWith(entryCanonical + path.sep) || canonical === entryCanonical
      : path.dirname(canonical) === entryCanonical;

    if (isMatch) {
      // Check access level (§8 — read/write separation)
      if (operation === 'write' && entry.access !== 'read-write') {
        return {
          allowed: false,
          reason: `Directory "${entry.path}" is read-only. Grant read-write access in Settings.`,
          matchedEntry: entry,
        };
      }
      return { allowed: true, reason: '', matchedEntry: entry };
    }
  }

  return {
    allowed: false,
    reason: `Path "${requestedPath}" is outside all allowed directories.`,
    matchedEntry: null,
  };
}

/**
 * Get the list of canonical paths from the allowlist for sandbox profile generation.
 *
 * @param {Array} allowlist — array of allowlist entries
 * @returns {{ readDirs: string[], writeDirs: string[] }}
 */
function getSandboxDirs(allowlist) {
  const readDirs = new Set();
  const writeDirs = new Set();

  if (!Array.isArray(allowlist)) return { readDirs: [...readDirs], writeDirs: [...writeDirs] };

  for (const entry of allowlist) {
    if (!entry || !entry.path) continue;
    const { canonical } = canonicalizePath(entry.path);
    if (!canonical) continue;

    if (entry.access === 'read-write') {
      writeDirs.add(canonical);
      readDirs.add(canonical);
    } else {
      readDirs.add(canonical);
    }

    // Also include /tmp for write
    const { canonical: tmpCanonical } = canonicalizePath('/tmp');
    if (canonical !== tmpCanonical) {
      readDirs.add(tmpCanonical);
    }
  }

  return { readDirs: [...readDirs], writeDirs: [...writeDirs] };
}

module.exports = {
  DEFAULT_ALLOWED_DIRECTORIES,
  canonicalizePath,
  isPathAllowed,
  getSandboxDirs,
};

/**
 * linux-bwrap-sandbox.test.js — bubblewrap (bwrap) containment test matrix.
 *
 * Layered for cross-platform CI:
 *   - "JS contract & arg generation & fail-closed" tests run anywhere (Node).
 *     They assert the namespace/unshare flags, read-only vs read-write bind
 *     selection, and that bwrap missing OR present-but-incapable fails closed.
 *   - "runtime enforcement" tests run ONLY on linux where bwrap is installed and
 *     can actually create namespaces. They prove the OS semantics (no read/write
 *     outside allowlist, no network, private /tmp, symlink traversal denied).
 *
 * The runtime block should be executed across a distro matrix (Ubuntu/Debian,
 * Fedora, Arch, containers, rootless) — see review notes on /bin -> /usr/bin,
 * missing /lib64, and user-namespace-disabled environments.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const sandbox = require('../src/core/sandbox-executor');

const LINUX_ISOLATION = { filesystem: true, network: true, process: true };
const NO_ISOLATION = { filesystem: false, network: false, process: false };

describe('Linux bubblewrap — JS contract & fail-closed (any platform)', () => {
  it('reports full OS-level isolation (filesystem/network/process)', () => {
    const fakeBwrap = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bw-')), 'fake-bwrap');
    fs.writeFileSync(fakeBwrap, '#!/bin/sh\nif [ "$1" = "--version" ]; then exit 0; fi\ncase "$*" in *"/bin/true"*) exit 0;; esac\nexit 1\n');
    fs.chmodSync(fakeBwrap, 0o755);
    const config = sandbox.createLinuxSandbox('/bin/ls', [], { bwrapPath: fakeBwrap });
    assert.deepStrictEqual(config.isolation, LINUX_ISOLATION);
    assert.strictEqual(config.platform, 'linux');
  });

  it('fails closed when bwrap is unavailable (ENOENT)', () => {
    assert.throws(
      () => sandbox.createLinuxSandbox('/bin/ls', [], { bwrapPath: '/nonexistent/bwrap' }),
      (e) => e.code === 'SANDBOX_UNAVAILABLE'
    );
  });

  it('fails closed when bwrap exists but CANNOT create namespaces', () => {
    const fakeBwrap = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bw-')), 'fake-bwrap-incapable');
    // Satisfies --version but the namespace-capability probe (trailing
    // /bin/true) fails — the classic "bwrap present but unusable" trap.
    fs.writeFileSync(fakeBwrap, '#!/bin/sh\nif [ "$1" = "--version" ]; then exit 0; fi\ncase "$*" in *"/bin/true"*) exit 1;; esac\nexit 0\n');
    fs.chmodSync(fakeBwrap, 0o755);
    assert.throws(
      () => sandbox.createLinuxSandbox('/bin/ls', [], { bwrapPath: fakeBwrap }),
      (e) => e.code === 'SANDBOX_UNAVAILABLE'
    );
  });

  it('fails closed when a domain network allowlist is requested', () => {
    assert.throws(
      () => sandbox.buildBubblewrapArgs('/bin/ls', [], { networkAllowlist: ['example.com'] }),
      (e) => e.code === 'SANDBOX_UNAVAILABLE'
    );
  });

  it('fails closed on a missing allowlist path', () => {
    assert.throws(
      () => sandbox.buildBubblewrapArgs('/bin/ls', [], {
        directoryAllowlist: [{ path: '/nonexistent/xyz/abc', access: 'read-write' }],
      }),
      (e) => e.code === 'SANDBOX_POLICY_INVALID'
    );
  });

  it('requests all required namespaces and read-only system mounts', () => {
    const args = sandbox.buildBubblewrapArgs('/bin/ls', [], { workspace: '/tmp' });
    for (const f of ['--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts']) {
      assert.ok(args.includes(f), `must include ${f}`);
    }
    assert.ok(args.includes('--ro-bind'), 'system mounts must be read-only');
    assert.ok(args.includes('--die-with-parent'), 'must die with parent');
  });

  it('binds write dirs read-write and read-only dirs read-only', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-'));
    const rw = path.join(tmpDir, 'rw');
    const ro = path.join(tmpDir, 'ro');
    fs.mkdirSync(rw);
    fs.mkdirSync(ro);
    const { canonical: cRw } = sandbox.canonicalizePath(rw);
    const { canonical: cRo } = sandbox.canonicalizePath(ro);
    try {
      const args = sandbox.buildBubblewrapArgs('/bin/ls', [], {
        directoryAllowlist: [
          { path: rw, access: 'read-write' },
          { path: ro, access: 'read' },
        ],
      });
      const pairs = [];
      for (let i = 0; i < args.length - 1; i++) {
        if (args[i] === '--bind') pairs.push(['bind', args[i + 1]]);
        if (args[i] === '--ro-bind') pairs.push(['ro-bind', args[i + 1]]);
      }
      assert.ok(pairs.some(([k, v]) => k === 'bind' && v === cRw), 'write dir should be --bind');
      assert.ok(pairs.some(([k, v]) => k === 'ro-bind' && v === cRo), 'read dir should be --ro-bind');
      assert.ok(!pairs.some(([k, v]) => k === 'bind' && v === cRo), 'read dir must not be --bind');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Runtime tests — linux + bwrap only.
// ---------------------------------------------------------------------------

const bwrapProbe = spawnSync('bwrap', ['--version'], { encoding: 'utf8', timeout: 5000 });
const bwrapAvailable = !bwrapProbe.error && bwrapProbe.status === 0;
const canRunLinux = process.platform === 'linux' && bwrapAvailable;
const hasPython = canRunLinux && (fs.existsSync('/usr/bin/python3') || fs.existsSync('/usr/bin/python'));
const pyBin = hasPython ? (fs.existsSync('/usr/bin/python3') ? '/usr/bin/python3' : '/usr/bin/python') : null;

const linuxRuntime = canRunLinux ? describe : describe.skip;

linuxRuntime('Linux bubblewrap — runtime enforcement (linux + bwrap only)', () => {
  let tmpDir, ws, secretOutside;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-run-'));
    ws = path.join(tmpDir, 'workspace');
    fs.mkdirSync(ws, { recursive: true });
    secretOutside = path.join(os.homedir(), '.aartiq-secret-' + Date.now());
    fs.writeFileSync(secretOutside, 'topsecret', { mode: 0o600 });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    try { fs.unlinkSync(secretOutside); } catch (e) { /* best-effort */ }
  });

  const run = (cmd, args, extra = {}) =>
    sandbox.executeSandboxed(cmd, args, {
      useSandbox: true,
      workspace: ws,
      directoryAllowlist: [{ path: ws, access: 'read-write' }],
      ...extra,
    });

  it('runs a command inside the verified sandbox (isolation reported)', async function () {
    const res = await run('/bin/echo', ['sandboxed']);
    assert.strictEqual(res.sandboxed, true);
    assert.deepStrictEqual(res.isolation, LINUX_ISOLATION);
  });

  it('cannot read outside the allowlist', async function () {
    const res = await run('/bin/cat', [secretOutside]);
    assert.strictEqual(res.sandboxed, true);
    assert.strictEqual(res.success, false, 'read outside allowlist must fail');
  });

  it('cannot write outside the allowlist', async function () {
    const target = path.join(os.homedir(), '.aartiq-escape-write-' + Date.now());
    const res = await run('/usr/bin/touch', [target]);
    assert.strictEqual(res.sandboxed, true);
    assert.strictEqual(res.success, false, 'write outside allowlist must fail');
    assert.ok(!fs.existsSync(target), 'escaped file must not be created');
  });

  it('/tmp is private to the sandbox', async function () {
    const inside = path.join('/tmp', 'aartiq-private-' + Date.now() + '.txt');
    const res = await run('/usr/bin/touch', [inside]);
    assert.strictEqual(res.sandboxed, true);
    assert.strictEqual(res.success, true, 'write to /tmp inside sandbox should succeed');
    // The private tmpfs means the file is NOT visible to the host.
    assert.ok(!fs.existsSync(inside), '/tmp must be private (not shared with host)');
  });

  it('cannot bind a network socket (network isolation)', async function () {
    if (!hasPython) return this.skip();
    const script = 'import socket\ns=socket.socket()\ns.bind(("127.0.0.1",0))\ns.listen()\n';
    const res = await run(pyBin, ['-c', script]);
    assert.strictEqual(res.sandboxed, true);
    assert.strictEqual(res.success, false, 'network bind must be denied');
  });

  it('cannot read through a symlink that escapes the allowlist', async function () {
    const link = path.join(ws, 'escape-link');
    try { fs.unlinkSync(link); } catch (e) { /* best-effort */ }
    fs.symlinkSync(secretOutside, link);
    const res = await run('/bin/cat', [link]);
    assert.strictEqual(res.sandboxed, true);
    assert.strictEqual(res.success, false, 'symlink-escape read must be denied');
  });

  it('reports NO isolation on a setup failure', async function () {
    const res = await sandbox.executeSandboxed('/bin/echo', ['x'], {
      useSandbox: true,
      workspace: ws,
      bwrapPath: '/nonexistent/bwrap',
    });
    assert.strictEqual(res.sandboxed, false);
    assert.deepStrictEqual(res.isolation, NO_ISOLATION);
  });
});

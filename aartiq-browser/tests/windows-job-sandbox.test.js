/**
 * windows-job-sandbox.test.js — Windows Job Object containment test matrix.
 *
 * Layered so it is USEFUL ON EVERY PLATFORM:
 *   - "JS contract & invariants" tests run anywhere (Node + the runner script
 *     text). They assert the security-critical guarantees are encoded and that
 *     the JS layer fails closed. This is what runs in CI on macOS/Linux.
 *   - "runtime containment" tests run ONLY on win32 with PowerShell present and
 *     exercise the real runner: suspended start, verified job assignment,
 *     grandchild containment, secret isolation, and KILL_ON_JOB_CLOSE.
 *
 * The runtime block is the dedicated Windows test matrix called for in review:
 * it should be executed on a Windows CI matrix (multiple Windows versions /
 * configurations) because Job Object + nested-job semantics vary by build.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const sandbox = require('../src/core/sandbox-executor');

const WIN_ISOLATION = { filesystem: false, network: false, process: true };
const NO_ISOLATION = { filesystem: false, network: false, process: false };

describe('Windows Job Object — JS contract & invariants', () => {
  it('reports process containment only (no OS-level FS/network isolation)', () => {
    const config = sandbox.createWindowsSandbox('node', ['--version'], {});
    assert.deepStrictEqual(config.isolation, WIN_ISOLATION);
    assert.strictEqual(config.platform, 'win32');
  });

  it('fails closed when a network policy is requested (cannot enforce on Windows)', () => {
    assert.throws(
      () => sandbox.createWindowsSandbox('cmd.exe', ['/c', 'ver'], { networkAllowlist: [] }),
      (e) => e.code === 'SANDBOX_UNAVAILABLE'
    );
  });

  it('rejects a missing allowlist path even though Windows does not enforce FS at OS level', () => {
    assert.throws(
      () => sandbox.createWindowsSandbox('cmd.exe', ['/c', 'ver'], {
        directoryAllowlist: [{ path: '/nonexistent/x', access: 'read-write' }],
      }),
      (e) => e.code === 'SANDBOX_POLICY_INVALID'
    );
  });

  it('encodes the suspended-start + verified-assignment + kill-on-close invariants', () => {
    const runner = sandbox.getWindowsJobRunnerScript();
    // Target must be created SUSPENDED and only resumed after assignment.
    assert.ok(/CREATE_SUSPENDED/.test(runner), 'target must be created suspended');
    // Break away from any parent job so OUR job owns the process. This is the
    // CREATE_SUSPENDED | CREATE_BREAKAWAY_FROM_JOB combination under review.
    assert.ok(/CREATE_BREAKAWAY_FROM_JOB/.test(runner), 'must break away from a parent job');
    // Must verify the assignment before resuming (cannot assume success).
    assert.ok(/IsProcessInJob/.test(runner), 'must verify assignment into the job');
    assert.ok(/AssignProcessToJobObject/.test(runner), 'must assign to the job before resume');
    // Whole tree dies if the helper (job owner) exits.
    assert.ok(/JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/.test(runner), 'must kill tree on helper exit');
    // Limits are applied and verified before the target runs.
    assert.ok(/JOB_OBJECT_LIMIT_ACTIVE_PROCESS/.test(runner), 'must cap active processes');
  });

  it('parseWindowsHelperOutput reports isolation only on a verified success', () => {
    const ok = sandbox.parseWindowsHelperOutput(
      'out\nAARTIQ_SANDBOX_RESULT:{"exitCode":0,"sandboxed":true,"jobAssigned":true}',
      ''
    );
    assert.deepStrictEqual(ok.isolation, WIN_ISOLATION);

    const fail = sandbox.parseWindowsHelperOutput(
      '',
      'AARTIQ_SANDBOX_RESULT:{"error":"x","code":"SANDBOX_SETUP_FAILED","sandboxed":false}'
    );
    assert.deepStrictEqual(fail.isolation, NO_ISOLATION);
  });

  it('parseWindowsHelperOutput fails closed when no result marker is present', () => {
    const res = sandbox.parseWindowsHelperOutput('garbage', '');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.sandboxed, false);
    assert.deepStrictEqual(res.isolation, NO_ISOLATION);
  });
});

// ---------------------------------------------------------------------------
// Runtime tests — win32 only, real PowerShell runner.
// ---------------------------------------------------------------------------

const canRunWin = process.platform === 'win32';
const psExe = canRunWin
  ? (process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe')
  : null;
const psExists = canRunWin && fs.existsSync(psExe);

const winRuntime = psExists ? describe : describe.skip;

winRuntime('Windows Job Object — runtime containment (win32 only)', () => {
  it('target starts suspended, is assigned to the job, and runs', async function () {
    const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winjob-'));
    const res = await sandbox.executeSandboxed('cmd.exe', ['/c', 'echo contained'], {
      useSandbox: true,
      workspace: wsDir,
    });
    assert.strictEqual(res.sandboxed, true);
    assert.strictEqual(res.jobAssigned, true, 'target must be verified inside the Job Object');
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.isolation, WIN_ISOLATION);
  });

  it('grandchildren spawned by the target remain inside the job', async function () {
    const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winjob-'));
    // cmd -> cmd -> echo: the grandchild must still be contained by the job.
    const res = await sandbox.executeSandboxed(
      'cmd.exe',
      ['/c', 'cmd.exe /c echo grandchild'],
      { useSandbox: true, workspace: wsDir }
    );
    assert.strictEqual(res.sandboxed, true);
    assert.strictEqual(res.jobAssigned, true);
    assert.strictEqual(res.success, true);
  });

  it('secrets do not enter the sandbox environment', async function () {
    const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winjob-'));
    process.env.AWS_SECRET_ACCESS_KEY = 'should-not-leak';
    try {
      const res = await sandbox.executeSandboxed(
        'cmd.exe',
        ['/c', 'echo %AWS_SECRET_ACCESS_KEY%'],
        { useSandbox: true, workspace: wsDir }
      );
      assert.strictEqual(res.sandboxed, true);
      assert.ok(!String(res.stdout).includes('should-not-leak'), 'secret must not leak into sandbox');
    } finally {
      delete process.env.AWS_SECRET_ACCESS_KEY;
    }
  });

  it('helper termination kills the target before it completes (KILL_ON_JOB_CLOSE)', async function () {
    const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winjob-'));
    const targetFile = path.join(wsDir, 'should-not-appear.txt');
    // Build the real launch config but spawn the runner ourselves so we can
    // kill the helper (job owner) mid-run and prove the target dies with it.
    const config = sandbox.createWindowsSandbox(
      'cmd.exe',
      ['/c', `ping -n 30 127.0.0.1 >nul & echo done > "${targetFile}"`],
      { workspace: wsDir }
    );
    const child = spawn(config.command, config.args, { stdio: 'ignore' });
    // Let the (long) target start, then kill the helper after a short delay.
    await new Promise((r) => setTimeout(r, 2000));
    child.kill('SIGKILL');
    await new Promise((r) => child.on('exit', r));
    if (config.cleanup) { try { config.cleanup(); } catch (e) { /* best-effort */ } }
    // If KILL_ON_JOB_CLOSE worked, the target ping was terminated and never
    // wrote the file.
    assert.ok(!fs.existsSync(targetFile), 'target must be killed when the helper exits');
  });
});

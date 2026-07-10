const { execFile } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = util.promisify(execFile);

const CRED_TYPE_GENERIC = 1;

function buildPsScript(action, { target, account, password, label }) {
  const safeTarget = (target || '').replace(/[\\"']/g, '');
  const safeAccount = (account || '').replace(/[\\"']/g, '');
  const safePassword = (password || '').replace(/[\\"']/g, '');
  const safeLabel = (label || '').replace(/[\\"']/g, '');

  return `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public long LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredWriteW(ref CREDENTIAL credential, uint flags);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredReadW(string target, int type, int reservedFlag, out IntPtr credential);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredDeleteW(string target, int type, int reservedFlag);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern void CredFree(IntPtr buffer);

  public static bool Write(string name, string username, string secret, string comment) {
    byte[] byteArray = System.Text.Encoding.Unicode.GetBytes(secret);
    IntPtr blob = Marshal.AllocHGlobal(byteArray.Length);
    Marshal.Copy(byteArray, 0, blob, byteArray.Length);
    var cred = new CREDENTIAL();
    cred.Type = ${CRED_TYPE_GENERIC};
    cred.TargetName = name;
    cred.Comment = comment;
    cred.CredentialBlobSize = byteArray.Length;
    cred.CredentialBlob = blob;
    cred.Persist = 2;
    cred.UserName = username;
    cred.AttributeCount = 0;
    bool result = CredWriteW(ref cred, 0);
    Marshal.FreeHGlobal(blob);
    return result;
  }

  public static string Read(string name) {
    IntPtr ptr;
    if (CredReadW(name, ${CRED_TYPE_GENERIC}, 0, out ptr)) {
      var cred = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
      if (cred.CredentialBlobSize > 0) {
        byte[] byteArray = new byte[cred.CredentialBlobSize];
        Marshal.Copy(cred.CredentialBlob, byteArray, 0, cred.CredentialBlobSize);
        CredFree(ptr);
        return System.Text.Encoding.Unicode.GetString(byteArray).TrimEnd('\\0');
      }
      CredFree(ptr);
    }
    return null;
  }

  public static bool Delete(string name) {
    return CredDeleteW(name, ${CRED_TYPE_GENERIC}, 0);
  }
}
'@

$ErrorActionPreference = "Stop"

switch ("${action}") {
  "add" {
    try {
      [WinCred]::Write("${safeTarget}", "${safeAccount}", "${safePassword}", "${safeLabel}")
      Write-Host '{"success":true}'
    } catch {
      Write-Host "{\\"success\\":false,\\"error\\":\\"$($_.Exception.Message.Replace('\\','\\\\').Replace('"','\\"'))\\"}"
    }
    break
  }
  "get" {
    try {
      $val = [WinCred]::Read("${safeTarget}")
      if ($val -ne $null) {
        $safe = $val.Replace('\\', '\\\\').Replace('"', '\\"')
        Write-Host "{\\"success\\":true,\\"password\\":\\"$safe\\"}"
      } else {
        Write-Host '{"success":false,"error":"Not found"}'
      }
    } catch {
      Write-Host "{\\"success\\":false,\\"error\\":\\"$($_.Exception.Message.Replace('\\','\\\\').Replace('"','\\"'))\\"}"
    }
    break
  }
  "delete" {
    try {
      [WinCred]::Delete("${safeTarget}")
      Write-Host '{"success":true}'
    } catch {
      Write-Host "{\\"success\\":false,\\"error\\":\\"$($_.Exception.Message.Replace('\\','\\\\').Replace('"','\\"'))\\"}"
    }
    break
  }
}
`;
}

function sanitizeForPowerShell(str) {
  if (!str) return '';
  return str.replace(/[\\"']/g, '').replace(/\n/g, ' ').replace(/\r/g, '');
}

async function runPs(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded
  ], { timeout: 30000, maxBuffer: 1024 * 1024 });

  const trimmed = `${stdout || ''}`.trim();
  const lastLine = trimmed.split('\n').filter(l => l.trim()).pop() || '{"success":false,"error":"No output"}';
  try {
    return JSON.parse(lastLine);
  } catch {
    return { success: false, error: 'Parse error', raw: lastLine };
  }
}

async function addPassword({ target, account, password, label }) {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Windows only' };
  }
  const script = buildPsScript('add', {
    target: target || 'Aartiq',
    account: account || 'default',
    password: password || '',
    label: label || 'Aartiq Credential',
  });
  return runPs(script);
}

async function getPassword({ target, account }) {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Windows only' };
  }
  const script = buildPsScript('get', {
    target: target || 'Aartiq',
    account: account || 'default',
  });
  return runPs(script);
}

async function deletePassword({ target, account }) {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Windows only' };
  }
  const script = buildPsScript('delete', {
    target: target || 'Aartiq',
  });
  return runPs(script);
}

module.exports = { addPassword, getPassword, deletePassword };

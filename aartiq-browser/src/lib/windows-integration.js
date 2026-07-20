/**
 * Windows Integration Module
 * Supports Windows Shortcuts, Voice Control, and Copilot integration
 */

const { app, ipcMain, shell, exec } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec: execAsync } = require('child_process');
const util = require('util');
const execPromise = util.promisify(execAsync);

const AARTIQ_URL_SCHEME = 'aartiq';
let windowsIpcHandlersRegistered = false;

const WindowsIntegration = {
  platform: process.platform,
  isWindows: process.platform === 'win32',
};

async function executePowerShell(script, args = []) {
  return new Promise((resolve, reject) => {
    const psScript = Buffer.from(script, 'utf16le').toString('base64');
    const cmdArgs = ['-NoProfile', '-NonInteractive', '-EncodedCommand', psScript];
    if (args.length > 0) {
      cmdArgs.push('-Args', ...args);
    }
    exec(`powershell ${cmdArgs.map(a => `"${a}"`).join(' ')}`, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function registerWindowsProtocol() {
  if (!WindowsIntegration.isWindows) {
    return { success: false, message: 'Not Windows' };
  }

  try {
    app.setAsDefaultProtocolClient(AARTIQ_URL_SCHEME);
    return { success: true, message: 'Protocol registered' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function handleWindowsShortcutAction(action, params = {}) {
  console.log(`[Windows] Action: ${action}`, params);

  const actionHandlers = {
    'chat': handleChatAction,
    'navigate': handleNavigateAction,
    'search': handleSearchAction,
    'create-pdf': handleCreatePDFAction,
    'run-command': handleShellCommandAction,
    'open-app': handleOpenAppAction,
    'screenshot': handleScreenshotAction,
    'volume': handleVolumeAction,
    'schedule': handleScheduleAction,
    'ask-ai': handleAskAIAction,
    'copilot': handleCopilotAction,
    'voice': handleVoiceAction,
  };

  const handler = actionHandlers[action];
  if (handler) {
    return await handler(params);
  }
  return { error: `Unknown action: ${action}` };
}

async function handleChatAction(params) {
  const { message } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:chat-message', message);
    return { success: true, message: 'Message sent to AI' };
  }
  return { error: 'Aartiq not running' };
}

async function handleNavigateAction(params) {
  const { url } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('browser:navigate', url);
    return { success: true };
  }
  return { error: 'Aartiq not running' };
}

async function handleSearchAction(params) {
  const { query } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:search', query);
    return { success: true };
  }
  return { error: 'Aartiq not running' };
}

async function handleCreatePDFAction(params) {
  const { content, title, template } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:create-pdf', { content, title, template });
    return { success: true };
  }
  return { error: 'Aartiq not running' };
}

async function handleShellCommandAction(params) {
  const { command, confirm } = params;
  if (confirm !== 'true') {
    return { error: 'Confirmation required' };
  }
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('shell:execute', command);
    return { success: true };
  }
  return { error: 'Aartiq not running' };
}

async function handleOpenAppAction(params) {
  const { appName, appPath } = params;
  try {
    if (appPath) {
      await shell.openPath(appPath);
    } else if (appName) {
      await shell.openPath(`C:\\Program Files\\${appName}\\${appName}.exe`);
      await shell.openPath(`C:\\Program Files (x86)\\${appName}\\${appName}.exe`);
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

async function handleScreenshotAction(params) {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('system:screenshot');
    return { success: true };
  }
  return { error: 'Aartiq not running' };
}

async function handleVolumeAction(params) {
  const { level } = params;
  const volumeLevel = Math.max(0, Math.min(100, parseInt(level, 10) || 50));
  try {
    // Use CoreAudio API via PowerShell to set system volume.
    const script = `
      param([int]$Vol)
      Add-Type -TypeDefinition '
        using System;
        using System.Runtime.InteropServices;

        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioEndpointVolume {
          int f(); int g(); int h(); int i();
          int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
          int j();
          int GetMasterVolumeLevelScalar(out float pfLevel);
        }

        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDevice {
          int Activate(ref System.Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        }

        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDeviceEnumerator {
          int EnumAudioEndpoints(int dataFlow, int dwStateMask, [MarshalAs(UnmanagedType.IUnknown)] out object ppDevices);
          int GetDefaultAudioEndpoint(int dataFlow, int dwRole, [MarshalAs(UnmanagedType.IUnknown)] out object ppEndpoint);
        }

        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        public class MMDeviceEnumerator {}

        public static class AudioHelper {
          public static void SetVolume(int percent) {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
            object dev;
            enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
            var device = (IMMDevice)dev;
            object iface;
            var iid = typeof(IAudioEndpointVolume).GUID;
            device.Activate(ref iid, 1, IntPtr.Zero, out iface);
            var volume = (IAudioEndpointVolume)iface;
            volume.SetMasterVolumeLevelScalar(percent / 100.0f, Guid.Empty);
          }
        }
      '
      [AudioHelper]::SetVolume($Vol)
    `;
    await executePowerShell(script, [String(volumeLevel)]);
    return { success: true, volume: volumeLevel };
  } catch (error) {
    return { error: error.message };
  }
}

async function handleScheduleAction(params) {
  const { task, cron, model } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:schedule', { task, cron, model });
    return { success: true };
  }
  return { error: 'Aartiq not running' };
}

async function handleAskAIAction(params) {
  const { prompt, model, speak } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:ask-speaking', { prompt, model, speak: speak === 'true' });
    return { success: true };
  }
  return { error: 'Aartiq not running' };
}

async function handleCopilotAction(params) {
  try {
    await shell.openPath('com.microsoft.copilot:\\');
    return { success: true, message: 'Opened Copilot' };
  } catch {
    try {
      await shell.openExternal('https://copilot.microsoft.com');
      return { success: true, message: 'Opened Copilot web' };
    } catch (error) {
      return { error: error.message };
    }
  }
}

async function handleVoiceAction(params) {
  const { command } = params;
  if (command === 'listen') {
    return await startVoiceRecognition(params);
  } else if (command === 'speak') {
    return await speakText(params.text, params);
  }
  return { error: 'Unknown voice command' };
}

async function startVoiceRecognition(params = {}) {
  const { timeout = 10000, language = 'en-US' } = params;

  return new Promise(async (resolve, reject) => {
    try {
      const script = `
        Add-Type -AssemblyName System.Speech
        $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
        $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
        $recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(2)
        $recognizer.SetInputToDefaultAudioDevice()
        $result = $recognizer.Recognize()
        if ($result) { $result.Text } else { '' }
      `;

      const result = await executePowerShell(script);
      resolve({ success: true, text: result.trim() });
    } catch (error) {
      reject(error);
    }
  });
}

async function speakText(text, params = {}) {
  const { rate = 0, volume = 1, voice = '' } = params;

  // Use a param block so user text is never interpolated into the script source.
  const script = `
    param(
      [string]$TextToSpeak,
      [int]$Rate,
      [int]$Vol,
      [string]$VoiceName
    )
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.Rate = $Rate
    $synth.Volume = $Vol
    if ($VoiceName) {
      $synth.SelectVoice($VoiceName)
    }
    $synth.Speak($TextToSpeak)
  `;

  return await executePowerShell(script, [
    text,
    String(parseInt(rate, 10) || 0),
    String(Math.round((parseFloat(volume) || 1) * 100)),
    voice || '',
  ]);
}

async function getWindowsVoices() {
  try {
    const script = `
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
    `;
    const result = await executePowerShell(script);
    return result.split('\n').map(v => v.trim()).filter(v => v);
  } catch {
    return ['Microsoft David', 'Microsoft Zira', 'Microsoft Hortense'];
  }
}

async function createWindowsShortcut(name, action, params = {}) {
  const shortcutsFolder = path.join(app.getPath('userData'), 'WindowsShortcuts');
  if (!fs.existsSync(shortcutsFolder)) {
    fs.mkdirSync(shortcutsFolder, { recursive: true });
  }

  const url = generateShortcutURL(action, params);
  const shortcutPath = path.join(shortcutsFolder, `${name}.url`);

  const shortcutContent = `[InternetShortcut]
URL=${url}
`;

  fs.writeFileSync(shortcutPath, shortcutContent);
  return { success: true, path: shortcutPath };
}

function generateShortcutURL(action, params = {}) {
  const paramString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `aartiq://${action}${paramString ? '?' + paramString : ''}`;
}

function parseShortcutURL(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'aartiq:') {
      return null;
    }
    const action = parsed.hostname;
    const params = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return { action, params };
  } catch {
    return null;
  }
}

function getMainWindow() {
  const { BrowserWindow } = require('electron');
  const windows = BrowserWindow.getAllWindows();
  return windows.find(w => !w.isDestroyed()) || null;
}

function setupWindowsIPCHandlers() {
  if (windowsIpcHandlersRegistered) {
    return;
  }

  windowsIpcHandlersRegistered = true;

  ipcMain.handle('windows:register-protocol', async () => {
    return await registerWindowsProtocol();
  });

  ipcMain.handle('windows:execute-action', async (event, action, params) => {
    return await handleWindowsShortcutAction(action, params);
  });

  ipcMain.handle('windows:voice:listen', async (event, params) => {
    return await startVoiceRecognition(params);
  });

  ipcMain.handle('windows:voice:speak', async (event, text, params) => {
    return await speakText(text, params);
  });

  ipcMain.handle('windows:voice:get-voices', async () => {
    return await getWindowsVoices();
  });

  ipcMain.handle('windows:copilot:open', async () => {
    return await handleCopilotAction({});
  });

  ipcMain.handle('windows:generate-url', async (event, action, params) => {
    return generateShortcutURL(action, params);
  });

  ipcMain.handle('windows:create-shortcut', async (event, name, action, params) => {
    return await createWindowsShortcut(name, action, params);
  });

  ipcMain.handle('windows:get-shortcuts-list', async () => {
    return [
      { id: 'chat', name: 'Chat with AI', description: 'Send message to Aartiq' },
      { id: 'search', name: 'Smart Search', description: 'Search web with AI' },
      { id: 'create-pdf', name: 'Create PDF', description: 'Generate PDF document' },
      { id: 'voice-chat', name: 'Voice Chat', description: 'Dictate and send to AI' },
      { id: 'ask-and-speak', name: 'Ask + Speak', description: 'Ask AI and hear response' },
      { id: 'run-command', name: 'Run Command', description: 'Execute terminal command' },
      { id: 'schedule', name: 'Schedule Task', description: 'Schedule AI tasks' },
      { id: 'open-app', name: 'Open App', description: 'Launch applications' },
      { id: 'set-volume', name: 'Set Volume', description: 'Control system volume' },
      { id: 'screenshot', name: 'Take Screenshot', description: 'Capture screen' },
      { id: 'navigate', name: 'Navigate', description: 'Open websites' },
      { id: 'copilot', name: 'Open Copilot', description: 'Launch Microsoft Copilot' },
    ];
  });
}

function handleURLSchemeEvent(url) {
  console.log('[Windows] URL scheme event:', url);
  const parsed = parseShortcutURL(url);
  if (parsed) {
    handleWindowsShortcutAction(parsed.action, parsed.params);
  }
}

module.exports = {
  WindowsIntegration,
  registerWindowsProtocol,
  handleWindowsShortcutAction,
  startVoiceRecognition,
  speakText,
  getWindowsVoices,
  createWindowsShortcut,
  generateShortcutURL,
  parseShortcutURL,
  setupWindowsIPCHandlers,
  handleURLSchemeEvent,
  AARTIQ_URL_SCHEME,
};

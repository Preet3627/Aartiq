const { exec } = require('child_process');

async function setVolume(level) {
  if (process.platform === 'win32') {
    const clamped = Math.max(0, Math.min(100, parseInt(level, 10) || 0));
    const script = `
      Add-Type -TypeDefinition @'
      using System;
      using System.Runtime.InteropServices;
      [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IAudioEndpointVolume {
        int f(); int g(); int h(); int i();
        int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
        int j(); int k(); int l(); int m(); int n();
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
        int GetMute(out bool pbMute);
      }
      [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDevice { int Activate(ref Guid id, int clsCtx, IntPtr activationParams, out IAudioEndpointVolume aev); }
      [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
      [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
      public class Audio {
        static Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        public static void SetVolume(double level) {
          var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
          IMMDevice dev; enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
          IAudioEndpointVolume epv;
          dev.Activate(ref IID_IAudioEndpointVolume, 23, IntPtr.Zero, out epv);
          epv.SetMasterVolumeLevelScalar((float)(level / 100.0), Guid.Empty);
        }
      }
    '@
      [Audio]::SetVolume(${clamped})
    `;
    return new Promise((resolve) => {
      exec(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err) => {
        resolve({ success: !err, level: clamped });
      });
    });
  } else if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      exec(`osascript -e "set volume output volume ${level}"`, (err) => {
        resolve({ success: !err, level });
      });
    });
  } else {
    return new Promise((resolve) => {
      exec(`amixer sset Master ${level}%`, (err) => {
        resolve({ success: !err, level });
      });
    });
  }
}

async function setBrightness(level) {
  if (process.platform === 'win32') {
    const clamped = Math.max(0, Math.min(100, parseInt(level, 10) || 50));
    return new Promise((resolve) => {
      exec(`powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${clamped})"`, (err) => {
        resolve({ success: !err, level: clamped });
      });
    });
  } else if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      exec(`brightness ${level / 100}`, (err) => {
        resolve({ success: !err, level });
      });
    });
  } else {
    return new Promise((resolve) => {
      exec(`xrandr --output $(xrandr | grep " connected" | cut -d' ' -f1) --brightness ${level / 100}`, (err) => {
        resolve({ success: !err, level });
      });
    });
  }
}

async function openExternalApp(appNameOrPath) {
  const { spawn } = require('child_process');
  if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      spawn('open', ['-a', appNameOrPath], { detached: true, shell: true });
      resolve({ success: true, app: appNameOrPath });
    });
  } else if (process.platform === 'win32') {
    return new Promise((resolve) => {
      spawn('cmd', ['/c', 'start', '', appNameOrPath], { detached: true, shell: true });
      resolve({ success: true, app: appNameOrPath });
    });
  } else {
    return new Promise((resolve) => {
      spawn('xdg-open', [appNameOrPath], { detached: true, shell: true });
      resolve({ success: true, app: appNameOrPath });
    });
  }
}

async function openSystemSettings(url) {
  const { exec } = require('child_process');
  const urlMap = {
    'security': 'x-apple.systempreferences:com.apple.preference.security?General',
    'accessibility': 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    'automation': 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
    'screen-recording': 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    'files': 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
  };
  const openUrl = urlMap[url] || url;
  return new Promise((resolve) => {
    exec(`open "${openUrl}"`, (err) => {
      resolve({ success: !err, url });
    });
  });
}

module.exports = {
  setVolume,
  setBrightness,
  openExternalApp,
  openSystemSettings
};
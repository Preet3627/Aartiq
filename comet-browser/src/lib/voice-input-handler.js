const { app, ipcMain } = require('electron');
const { spawn, exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

const VoiceInputState = {
  isListening: false,
  isSpeaking: false,
  currentTranscript: '',
  speakQueue: [],
};

async function checkMicrophonePermission() {
  const script = `
    tell application "System Events"
      tell process "SystemUIServer"
        set micAllowed to true
      end tell
    end tell
    return micAllowed
  `;
}

async function enableDictation() {
  return new Promise((resolve, reject) => {
    const script = `
      tell application "System Events"
        keystroke "d" using {command down}
      end tell
    `;
    
    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

async function getClipboardText() {
  return execPromise('pbpaste');
}

async function setClipboardText(text) {
  return execPromise(`echo '${text.replace(/'/g, "'\\''")}' | pbcopy`);
}

async function listenForVoiceInput(config = {}) {
  const {
    timeout = 10000,
    language = 'en-US',
    continuous = false,
  } = config;

  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    let transcribed = '';

    try {
      await enableDictation();
      
      VoiceInputState.isListening = true;

      const checkInterval = setInterval(async () => {
        try {
          const clipboardContent = await getClipboardText();
          
          if (clipboardContent && clipboardContent !== VoiceInputState.currentTranscript) {
            transcribed = clipboardContent;
            VoiceInputState.currentTranscript = transcribed;
            clearInterval(checkInterval);
            VoiceInputState.isListening = false;
            resolve(transcribed);
          }
          
          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            VoiceInputState.isListening = false;
            resolve(transcribed || '');
          }
        } catch (e) {
          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            VoiceInputState.isListening = false;
            resolve(transcribed || '');
          }
        }
      }, 500);
      
    } catch (error) {
      VoiceInputState.isListening = false;
      reject(error);
    }
  });
}

async function speakText(text, config = {}) {
  const {
    rate = 200,
    voice = null,
    pitch = 1.0,
    volume = 1.0,
  } = config;

  return new Promise((resolve, reject) => {
    let voiceArg = '';
    if (voice) {
      voiceArg = ` using voice "${voice}"`;
    }

    const script = `say "${text.replace(/"/g, '\\"')}"${voiceArg} speaking rate ${rate} pitch ${pitch} using volume ${Math.round(volume * 100)}`;

    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        VoiceInputState.isSpeaking = false;
        resolve(true);
      }
    });
  });
}

async function stopSpeaking() {
  VoiceInputState.speakQueue = [];
  VoiceInputState.isSpeaking = false;

  const script = `
    tell application "System Events"
      set frontmost to true
      key code 15 using {command down, shift down}
    end tell
  `;

  return execPromise(`osascript -e '${script}'`);
}

async function speakWithQueue(textQueue, config = {}) {
  const {
    delay = 100,
    continueOnError = true,
  } = config;

  for (const text of textQueue) {
    VoiceInputState.speakQueue.push(text);
  }

  while (VoiceInputState.speakQueue.length > 0) {
    const text = VoiceInputState.speakQueue.shift();
    try {
      await speakText(text, config);
      await new Promise(r => setTimeout(r, delay));
    } catch (error) {
      if (!continueOnError) {
        throw error;
      }
    }
  }

  return true;
}

async function getVoiceList() {
  const script = `
    set voiceList to {}
    tell application "System Events"
      set voiceNames to name of every voice
    end tell
    return voiceNames as text
  `;

  try {
    const result = await execPromise(`osascript -e '${script}'`);
    return result.trim().split(', ').map(v => v.trim()).filter(v => v);
  } catch {
    return ['Alex', 'Samantha', 'Victoria', 'Daniel', 'Fred', 'Karen', 'Moira', 'Rory', 'Gorge', 'Ava'];
  }
}

async function useDefaultVoice() {
  const script = `say "" using "Samantha"`;
  return execPromise(`osascript -e '${script}'`);
}

const macOSSpeechRecognitionCommands = {
  'hey comet': 'chat',
  'comet ai': 'chat',
  'ask comet': 'chat',
  'comet search': 'search',
  'comet find': 'search',
  'comet create': 'create',
  'comet make': 'create',
  'comet schedule': 'schedule',
  'comet remind': 'schedule',
};

function parseVoiceCommand(transcript) {
  const lower = transcript.toLowerCase().trim();

  for (const [trigger, action] of Object.entries(macOSSpeechRecognitionCommands)) {
    if (lower.startsWith(trigger)) {
      const message = lower.substring(trigger.length).trim();
      return { action, message };
    }
  }

  return { action: 'chat', message: lower };
}

async function setupVoiceInputHandler() {
  ipcMain.handle('voice:listen', async (event, config) => {
    return await listenForVoiceInput(config);
  });

  ipcMain.handle('voice:speak', async (event, text, config) => {
    return await speakText(text, config);
  });

  ipcMain.handle('voice:stop', async () => {
    return await stopSpeaking();
  });

  ipcMain.handle('voice:queue', async (event, textQueue, config) => {
    return await speakWithQueue(textQueue, config);
  });

  ipcMain.handle('voice:voices', async () => {
    return await getVoiceList();
  });

  ipcMain.handle('voice:get-status', async () => {
    return {
      isListening: VoiceInputState.isListening,
      isSpeaking: VoiceInputState.isSpeaking,
      currentTranscript: VoiceInputState.currentTranscript,
      queueLength: VoiceInputState.speakQueue.length,
    };
  });

  ipcMain.handle('voice:parse-command', async (event, transcript) => {
    return parseVoiceCommand(transcript);
  });

  ipcMain.handle('voice:clipboard:get', async () => {
    return await getClipboardText();
  });

  ipcMain.handle('voice:clipboard:set', async (event, text) => {
    return await setClipboardText(text);
  });
}

function generateVoiceTriggerScript() {
  return `# Comet AI Voice Trigger - macOS Automation
# This script listens for voice commands using macOS dictation

# Setup: Enable Dictation in System Settings > Keyboard > Dictation

# Step 1: Enable dictation
# Press Cmd+Shift to start listening

# Step 2: Get text from clipboard after dictation
set dictatedText to do shell script "pbpaste"

# Step 3: Send to Comet AI
if dictatedText is not "" then
    tell application "Comet AI"
        activate
        open location "comet-ai://chat?message=" & dictatedText
    end tell
end if
`;
}

function generateContinuousVoiceScript() {
  return `# Comet AI Continuous Voice Listening
# Run this automation to continuously listen for voice commands

# Enable continuous dictation in System Settings > Accessibility > Voice Control

on idle
    -- Check clipboard for new dictation
    set currentClip to do shell script "pbpaste"
    
    -- Process if it's a new command
    if currentClip starts with "comet" then
        -- Remove "comet" prefix
        set commandText to text ((length of "comet") + 1) through end of currentClip
        
        tell application "Comet AI"
            activate
            open location "comet-ai://chat?message=" & commandText
        end tell
        
        -- Clear clipboard
        do shell script "echo '' | pbcopy"
    end if
    
    -- Check every 2 seconds
    return 2
end idle
`;
}

module.exports = {
  listenForVoiceInput,
  speakText,
  stopSpeaking,
  speakWithQueue,
  getVoiceList,
  useDefaultVoice,
  parseVoiceCommand,
  setupVoiceInputHandler,
  generateVoiceTriggerScript,
  generateContinuousVoiceScript,
  getClipboardText,
  setClipboardText,
};
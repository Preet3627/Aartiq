const { app, ipcMain } = require('electron');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const AppleScriptBridge = {
  scriptsLoaded: false,
  lastSpeechResult: null,
  speechSynthesizer: null,
};

const APPLE_SCRIPT_COMMANDS = {
  'ask AI': (params) => `
    tell application "Comet AI"
      activate
      ask AI "${params.message || ''}"
    end tell
  `,

  'navigate': (params) => `
    tell application "Comet AI"
      activate
      navigate to "${params.url || ''}"
    end tell
  `,

  'create pdf': (params) => `
    tell application "Comet AI"
      activate
      create PDF with content "${params.content || ''}" title "${params.title || 'Document'}"
    end tell
  `,

  'run shell command': (params) => `
    tell application "Comet AI"
      activate
      run command "${params.command || ''}"
    end tell
  `,

  'set volume': (params) => `
    set volume output volume ${params.level || 50}
  `,

  'take screenshot': () => `
    tell application "Comet AI"
      activate
      take screenshot
    end tell
  `,

  'open app': (params) => `
    tell application "Comet AI"
      activate
      open application "${params.appName || ''}"
    end tell
  `,

  'schedule task': (params) => `
    tell application "Comet AI"
      activate
      schedule task "${params.task || ''}" at "${params.schedule || 'daily'}"
    end tell
  `,

  'voice chat': () => `
    tell application "Comet AI"
      activate
      start voice chat
    end tell
  `,
};

async function runAppleScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Script exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function executeAppleScriptCommand(command, params = {}) {
  const scriptGenerator = APPLE_SCRIPT_COMMANDS[command];
  
  if (!scriptGenerator) {
    throw new Error(`Unknown command: ${command}`);
  }

  const script = scriptGenerator(params);
  return await runAppleScript(script);
}

async function speakText(text, rate = 200, voice = null) {
  let script = `say "${text.replace(/"/g, '\\"')}"`;
  
  if (voice) {
    script += ` using voice "${voice}"`;
  }
  
  script += ` speaking rate ${rate}`;
  
  return await runAppleScript(script);
}

async function listenForSpeech(timeout = 10000) {
  return new Promise(async (resolve, reject) => {
    const script = `
      set speechText to ""
      activate
      display dialog "Speak now..." giving up after ${Math.round(timeout / 1000)}
      set speechAnswer to text returned of (display dialog "What would you like to ask?" default answer "" buttons {"Cancel", "OK"} default button "OK")
      return speechAnswer
    `;
    
    try {
      const result = await runAppleScript(script);
      AppleScriptBridge.lastSpeechResult = result;
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

async function getAvailableVoices() {
  const script = `set voiceList to {}
tell application "System Events"
  set voiceNames to name of every voice
  return voiceNames
end tell`;

  try {
    const result = await runAppleScript(script);
    return result.split(', ').map(v => v.trim()).filter(v => v);
  } catch {
    return ['Alex', 'Samantha', 'Victoria', 'Daniel', 'Fred', 'Karen'];
  }
}

async function createVoiceCommandShortcut(commandName, params = {}) {
  const shortcutScript = `
    on run
      set userInput to text returned of (display dialog "Enter your request:" default answer "" buttons {"Cancel", "OK"} default button "OK")
      
      tell application "Comet AI"
        activate
        -- Send command to Comet AI via URL scheme
        open location "comet-ai://chat?message=" & userInput
      end tell
      
      display notification "Sent to Comet AI" with title "Comet AI"
    end run
  `;

  const scriptPath = app.getPath('userData');
  const scriptFile = `${scriptPath}/shortcuts/${commandName.replace(/\s+/g, '_')}.scpt`;
  
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(path.dirname(scriptFile))) {
    fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', shortcutScript]);
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, path: scriptFile });
      } else {
        reject(new Error(`Failed to create shortcut`));
      }
    });
  });
}

async function createDictationShortcut() {
  const script = `
    on run
      set voiceInput to ""
      
      -- Use macOS dictation
      tell application "System Events"
        key code 0 using {command down, shift down}
      end tell
      
      delay 2
      
      -- Get the dictated text from clipboard
      tell application "System Events"
        tell application process "Comet AI"
          set voiceInput to the clipboard
        end tell
      end tell
      
      if voiceInput is not "" then
        tell application "Comet AI"
          activate
          open location "comet-ai://chat?message=" & voiceInput
        end tell
        
        display notification "Sent: " & voiceInput with title "Comet AI"
      end if
    end run
  `;

  return script;
}

async function createVoiceautomationWorkflow(name, voiceTrigger, action, params = {}) {
  const workflow = {
    name,
    voiceTrigger,
    action,
    params,
    createdAt: new Date().toISOString(),
  };

  const workflowsPath = app.getPath('userData');
  const workflowsFile = `${workflowsPath}/voice_automations.json`;
  
  const fs = require('fs');
  
  let workflows = [];
  if (fs.existsSync(workflowsFile)) {
    try {
      workflows = JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
    } catch {
      workflows = [];
    }
  }

  workflows.push(workflow);
  fs.writeFileSync(workflowsFile, JSON.stringify(workflows, null, 2));

  return workflow;
}

function setupAppleScriptIPCHandlers() {
  ipcMain.handle('applescript:run', async (event, command, params) => {
    return await executeAppleScriptCommand(command, params);
  });

  ipcMain.handle('applescript:speak', async (event, text, rate, voice) => {
    return await speakText(text, rate, voice);
  });

  ipcMain.handle('applescript:listen', async (event, timeout) => {
    return await listenForSpeech(timeout);
  });

  ipcMain.handle('applescript:get-voices', async () => {
    return await getAvailableVoices();
  });

  ipcMain.handle('applescript:create-shortcut', async (event, commandName, params) => {
    return await createVoiceCommandShortcut(commandName, params);
  });

  ipcMain.handle('applescript:create-workflow', async (event, name, voiceTrigger, action, params) => {
    return await createVoiceautomationWorkflow(name, voiceTrigger, action, params);
  });

  ipcMain.handle('applescript:get-commands', async () => {
    return Object.keys(APPLE_SCRIPT_COMMANDS);
  });
}

function generateDpeechRecognitionScript() {
  const script = `
    -- macOS Speech Recognition for Comet AI
    -- Requires System Settings > Accessibility > Voice Control to be enabled
    
    property listening : false
    property spokenText : ""
    
    on listenForCommand()
      set spokenText to ""
      tell application "System Events"
        -- Activate voice control
        key code 0 using {command down, shift down}
      end tell
    end listenForCommand
    
    on processSpokenText(theText)
      set spokenText to theText
      
      -- Check for Comet AI commands
      if theText starts with "hey comet" then
        set commandText to text ((length of "hey comet") + 1) through end of theText
        tell application "Comet AI"
          activate
          open location "comet-ai://chat?message=" & commandText
        end tell
        return "Command sent to Comet AI"
      else if theText starts with "comet" then
        set commandText to text ((length of "comet") + 1) through end of theText
        tell application "Comet AI"
          activate
          open location "comet-ai://chat?message=" & commandText
        end tell
        return "Command sent to Comet AI"
      end if
      
      return "No Comet command found"
    end processSpokenText
    
    -- Alternative: Use macOS Dictation feature
    on activateDictation()
      tell application "System Events"
        keystroke "d" using {command down}
      end tell
    end activateDictation
  `;
  
  return script;
}

function generateVoiceChatScript() {
  const script = `
    -- Voice Chat workflow for Comet AI
    -- 1. Activate dictation
    -- 2. Get text from clipboard
    -- 3. Send to Comet AI
    -- 4. Speak the response
    
    on run
      -- Step 1: Activate dictation
      tell application "System Events"
        keystroke "d" using {command down}
      end tell
      
      -- Step 2: Wait for user to finish speaking
      delay 3
      
      -- Step 3: Get dictated text from clipboard
      tell application "System Events"
        set dictatedText to the clipboard
      end tell
      
      if length of dictatedText > 0 then
        -- Step 4: Send to Comet AI
        tell application "Comet AI"
          activate
          open location "comet-ai://chat?message=" & dictatedText & "&speak=true"
        end tell
      else
        display dialog "No text detected. Please try again."
      end if
    end run
  `;
  
  return script;
}

function generateScheduleWithReminderScript() {
  const script = `
    -- Schedule task with reminder in Comet AI
    on run
      set taskName to text returned of (display dialog "What task to schedule?" default answer "" buttons {"Cancel", "OK"} default button "OK")
      set scheduleTime to text returned of (display dialog "When to run? (e.g., daily at 8am, every hour)" default answer "daily at 8am" buttons {"Cancel", "OK"} default button "OK")
      
      -- Send to Comet AI
      tell application "Comet AI"
        activate
        open location "comet-ai://schedule?task=" & taskName & "&cron=" & scheduleTime
      end tell
      
      display notification "Scheduled: " & taskName with title "Comet AI"
    end run
  `;
  
  return script;
}

module.exports = {
  executeAppleScriptCommand,
  speakText,
  listenForSpeech,
  getAvailableVoices,
  createVoiceCommandShortcut,
  createDictationShortcut,
  createVoiceautomationWorkflow,
  setupAppleScriptIPCHandlers,
  generateDpeechRecognitionScript,
  generateVoiceChatScript,
  generateScheduleWithReminderScript,
  APPLE_SCRIPT_COMMANDS,
};
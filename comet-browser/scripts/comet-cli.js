#!/usr/bin/env node

/**
 * Comet-AI CLI v0.2.9.4
 * A terminal-based interface to control the Comet browser and query the AI.
 * 
 * Features:
 * - Chat sessions with history
 * - Live streaming output
 * - Model selection
 * - Action tags (--web, --local, etc.)
 * - Interactive mode
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PORT = 3004;
const HOST = '127.0.0.1';

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.comet-ai');
const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');

// Ensure directories exist
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// Default config
const DEFAULT_MODEL = 'ollama';

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
    help: false,
    version: false,
    interactive: false,
    session: null,
    model: DEFAULT_MODEL,
    web: false,
    stream: true,
    list: false,
    clear: false
};

const positional = [];

// Simple flag parser
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--version' || arg === '-v') flags.version = true;
    else if (arg === '--interactive' || arg === '-i') flags.interactive = true;
    else if (arg === '--session' && args[i + 1]) flags.session = args[++i];
    else if (arg === '--model' && args[i + 1]) flags.model = args[++i];
    else if (arg === '--web') flags.web = true;
    else if (arg === '--no-stream') flags.stream = false;
    else if (arg === '--list') flags.list = true;
    else if (arg === '--clear') flags.clear = true;
    else if (arg.startsWith('-')) {
        console.error(`Unknown flag: ${arg}`);
        process.exit(1);
    } else {
        positional.push(arg);
    }
}

const command = positional[0];
const payload = positional.slice(1).join(' ').trim();

// Get native token
function getNativeToken() {
    try {
        const tokenPath = path.join(process.env.HOME || process.env.USERPROFILE, '.comet-ai-token');
        if (fs.existsSync(tokenPath)) {
            return fs.readFileSync(tokenPath, 'utf8').trim();
        }
    } catch (e) {}
    return 'comet-native-dev-token-2026';
}

// Session management
function loadSessions() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        }
    } catch (e) {}
    return { sessions: {}, activeSession: null };
}

function saveSessions(data) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

function createSession(name) {
    const data = loadSessions();
    const id = Date.now().toString(36);
    data.sessions[id] = {
        name: name || `Session ${Object.keys(data.sessions).length + 1}`,
        created: new Date().toISOString(),
        messages: []
    };
    data.activeSession = id;
    saveSessions(data);
    return id;
}

function addMessage(sessionId, role, content) {
    const data = loadSessions();
    if (data.sessions[sessionId]) {
        data.sessions[sessionId].messages.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });
        saveSessions(data);
    }
}

// Print help
function printHelp() {
    console.log(`
🚀 Comet-AI CLI v${getVersion()}

Usage:
  comet ask "<prompt>"              Send a prompt to the AI
  comet search "<query>"        Search the web
  comet chat                  Start interactive chat mode
  comet session [name]           Create or use a session
  comet history             Show chat history
  comet models              List available models
  comet help                Show this help

Options:
  -h, --help                  Show this help menu
  -v, --version               Show version
  -i, --interactive          Start interactive chat mode
  --session <name>            Specify session name
  --model <name>            Select AI model (ollama, openai, anthropic, gemini)
  --web                     Force web search
  --no-stream               Disable streaming output
  --list                    List sessions
  --clear                   Clear history

Examples:
  comet ask "How do I create a PDF?"
  comet ask "Summarize the latest AI news" --model openai
  comet search "SpaceX launch today"
  comet chat
  comet session my-research
  comet history
    `);
}

function getVersion() {
    return '0.2.9.4';
}

// Action handlers
async function handleAsk() {
    if (!payload) {
        console.error('Error: Missing prompt');
        console.log('Usage: comet ask "<prompt>"');
        process.exit(1);
    }

    const token = getNativeToken();
    let sessionId = flags.session;

    // Create session if needed
    if (!sessionId) {
        const data = loadSessions();
        sessionId = data.activeSession || createSession('CLI Session');
    }

    // Add user message to history
    addMessage(sessionId, 'user', payload);

    const postData = JSON.stringify({
        prompt: payload,
        command: 'ask',
        source: 'terminal',
        model: flags.model,
        sessionId: sessionId,
        stream: flags.stream,
        web: flags.web
    });

    console.log(`\n🤖 ${flags.model}> ${payload}\n`);

    const options = {
        hostname: HOST,
        port: PORT,
        path: '/native-mac-ui/cli/ask',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Comet-Native-Token': token,
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    let response = '';

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            if (res.statusCode === 401) {
                console.error('❌ Unauthorized: Invalid CLI token');
                process.exit(1);
            }

            res.on('data', (chunk) => {
                const data = chunk.toString();
                if (flags.stream) {
                    try {
                        const lines = data.split('\n');
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const json = JSON.parse(line);
                                if (json.textDelta) {
                                    process.stdout.write(json.textDelta);
                                    response += json.textDelta;
                                } else if (json.error) {
                                    console.error('\n❌ Error:', json.error);
                                }
                            } catch (e) {
                                process.stdout.write(data);
                                response += data;
                            }
                        }
                    } catch (e) {
                        process.stdout.write(data);
                        response += data;
                    }
                } else {
                    response += data;
                }
            });

            res.on('end', () => {
                process.stdout.write('\n\n');
                addMessage(sessionId, 'assistant', response);
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`\n❌ Error: Could not connect to Comet-AI (${e.message})`);
            console.log('Make sure Comet-AI browser is running.');
            process.exit(1);
        });

        req.write(postData);
        req.end();
    });
}

async function handleSearch() {
    if (!payload) {
        console.error('Error: Missing search query');
        process.exit(1);
    }

    const token = getNativeToken();
    const postData = JSON.stringify({
        query: payload,
        command: 'search',
        source: 'terminal'
    });

    const options = {
        hostname: HOST,
        port: PORT,
        path: '/native-mac-ui/cli/search',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Comet-Native-Token': token,
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.results) {
                        console.log('\n🔍 Search Results:\n');
                        result.results.forEach((r, i) => {
                            console.log(`${i + 1}. ${r.title}`);
                            console.log(`   ${r.url}`);
                            console.log(`   ${r.snippet || ''}\n`);
                        });
                    } else if (result.error) {
                        console.error('❌ Error:', result.error);
                    } else {
                        console.log(data);
                    }
                } catch (e) {
                    console.log(data);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Error: ${e.message}`);
            process.exit(1);
        });

        req.write(postData);
        req.end();
    });
}

async function handleInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n🚀 Comet-AI Interactive Mode');
    console.log('Type "exit" to quit, "help" for commands\n');

    let sessionId = flags.session || createSession('Interactive');

    const prompt = () => {
        rl.question('🤖 > ', async (input) => {
            const trimmed = input.trim();

            if (!trimmed || trimmed === 'exit') {
                console.log('\n👋 Goodbye!');
                rl.close();
                process.exit(0);
            }

            if (trimmed === 'help') {
                console.log(`
Commands:
  exit, quit           Exit interactive mode
  help               Show this help
  clear               Clear screen
  history             Show session history
  models              List available models
  web                 Toggle web search
                `);
                prompt();
                return;
            }

            if (trimmed === 'clear') {
                console.clear();
                prompt();
                return;
            }

            if (trimmed === 'history') {
                const data = loadSessions();
                const session = data.sessions[sessionId];
                if (session && session.messages.length > 0) {
                    console.log('\n📜 Chat History:');
                    session.messages.forEach((m, i) => {
                        console.log(`${i + 1}. [${m.role}] ${m.content.substring(0, 50)}...`);
                    });
                } else {
                    console.log('No history yet.');
                }
                prompt();
                return;
            }

            // Send to AI
            const token = getNativeToken();
            const postData = JSON.stringify({
                prompt: trimmed,
                command: 'ask',
                source: 'terminal',
                sessionId: sessionId,
                stream: true
            });

            const options = {
                hostname: HOST,
                port: PORT,
                path: '/native-mac-ui/cli/ask',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Comet-Native-Token': token,
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            try {
                let response = '';
                const req = http.request(options, (res) => {
                    res.on('data', (chunk) => {
                        const data = chunk.toString();
                        try {
                            const lines = data.split('\n');
                            for (const line of lines) {
                                if (!line.trim()) continue;
                                try {
                                    const json = JSON.parse(line);
                                    if (json.textDelta) {
                                        process.stdout.write(json.textDelta);
                                        response += json.textDelta;
                                    }
                                } catch (e) {
                                    process.stdout.write(data);
                                    response += data;
                                }
                            }
                        } catch (e) {
                            process.stdout.write(data);
                            response += data;
                        }
                    });

                    res.on('end', () => {
                        console.log('\n');
                        addMessage(sessionId, 'user', trimmed);
                        addMessage(sessionId, 'assistant', response);
                        prompt();
                    });
                });

                req.on('error', (e) => {
                    console.error('❌ Error:', e.message);
                    prompt();
                });

                req.write(postData);
                req.end();
            } catch (e) {
                console.error('❌ Error:', e.message);
                prompt();
            }
        });
    };

    prompt();
}

function handleList() {
    const data = loadSessions();
    const sessions = Object.entries(data.sessions);

    if (sessions.length === 0) {
        console.log('No sessions found.');
        return;
    }

    console.log('\n📂 Sessions:\n');
    sessions.forEach(([id, session]) => {
        const marker = id === data.activeSession ? '👉 ' : '  ';
        console.log(`${marker}${session.name} (${session.messages.length} messages)`);
        console.log(`   Created: ${session.created}\n`);
    });
}

function handleClear() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            fs.unlinkSync(HISTORY_FILE);
            console.log('✅ History cleared.');
        } else {
            console.log('No history to clear.');
        }
    } catch (e) {
        console.error('❌ Error clearing history:', e.message);
    }
}

function handleHistory() {
    const data = loadSessions();
    const session = data.activeSession ? data.sessions[data.activeSession] : null;

    if (!session) {
        console.log('No active session.');
        return;
    }

    console.log(`\n📜 ${session.name}\n`);
    session.messages.forEach((m, i) => {
        const role = m.role === 'user' ? '👤' : '🤖';
        console.log(`${role} ${m.content}`);
        if (i < session.messages.length - 1) console.log('');
    });
}

// Main
async function main() {
    if (flags.help) {
        printHelp();
        process.exit(0);
    }

    if (flags.version) {
        console.log(`Comet-AI CLI v${getVersion()}`);
        process.exit(0);
    }

    if (flags.clear) {
        handleClear();
        process.exit(0);
    }

    if (flags.list) {
        handleList();
        process.exit(0);
    }

    if (flags.interactive || !command) {
        handleInteractive();
        return;
    }

    switch (command) {
        case 'ask':
            await handleAsk();
            break;
        case 'search':
            await handleSearch();
            break;
        case 'chat':
            handleInteractive();
            break;
        case 'session':
            const id = createSession(payload || 'New Session');
            console.log(`📂 Created/activated session: ${id}`);
            break;
        case 'history':
            handleHistory();
            break;
        case 'models':
            console.log('\n🤖 Available Models:');
            console.log('  ollama       - Local Ollama models');
            console.log('  openai      - OpenAI GPT models');
            console.log('  anthropic   - Anthropic Claude');
            console.log('  gemini     - Google Gemini');
            console.log('');
            break;
        default:
            if (!flags.help && !flags.version) {
                // Try as direct prompt
                const data = [...positional, ...args.filter(a => !a.startsWith('-'))].join(' ');
                if (data) {
                    //@ts-ignore
                    const oldPayload = payload;
                    //@ts-ignore  
                    // Reconstruct args for ask
                    args.unshift('ask');
                    await handleAsk();
                } else {
                    console.log(`Unknown command: ${command}`);
                    console.log('Run "comet help" for usage.');
                    process.exit(1);
                }
            }
    }
}

main().catch((e) => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
});
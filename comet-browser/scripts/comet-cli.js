#!/usr/bin/env node

/**
 * Comet-AI CLI
 * A terminal-based interface to control the Comet browser and query the AI.
 * Usage: comet ask "How do I create a PDF?"
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3004; // Native Bridge Port
const HOST = '127.0.0.1';

// Load the native token to authenticate with the local bridge
function getNativeToken() {
    try {
        const tokenPath = path.join(process.env.HOME || process.env.USERPROFILE, '.comet-ai-token');
        if (fs.existsSync(tokenPath)) {
            return fs.readFileSync(tokenPath, 'utf8').trim();
        }
    } catch (e) {
        // Fallback or ignore
    }
    return 'comet-native-dev-token-2026'; // Default dev token
}

const args = process.argv.slice(2);
const command = args[0];
const payload = args.slice(1).join(' ');

if (!command || !['ask', 'search', 'screenshot', 'help'].includes(command)) {
    printHelp();
    process.exit(0);
}

if (command === 'help') {
    printHelp();
    process.exit(0);
}

if (!payload && command !== 'screenshot') {
    console.error(`Error: Command '${command}' requires a prompt or query.`);
    console.log(`Example: comet ask "Summarize the news"`);
    process.exit(1);
}

const token = getNativeToken();

function printHelp() {
    console.log(`
🚀 Comet-AI CLI - Terminal Browser Control

Usage:
  comet ask "<prompt>"      - Send a prompt to the AI and get a response in terminal.
  comet search "<query>"    - Search the web and show summarized results.
  comet screenshot          - Capture the current browser page.
  comet help                - Show this help menu.

Examples:
  comet ask "Create a PDF for today's AI news"
  comet search "Latest SpaceX launch"
  comet screenshot
    `);
}

async function runCommand() {
    const endpoint = command === 'ask' ? '/native-mac-ui/cli/ask' : 
                     command === 'search' ? '/native-mac-ui/cli/search' :
                     command === 'screenshot' ? '/native-mac-ui/screenshot' : '/native-mac-ui/cli/ask';

    const postData = JSON.stringify({
        prompt: payload,
        command: command,
        source: 'terminal'
    });

    const options = {
        hostname: HOST,
        port: PORT,
        path: endpoint,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Comet-Native-Token': token,
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        if (res.statusCode === 401) {
            console.error('❌ Unauthorized: Comet-AI browser is running but the CLI token is invalid.');
            process.exit(1);
        }

        res.on('data', (chunk) => {
            const data = chunk.toString();
            try {
                // The main process might send JSON chunks for streaming text
                const lines = data.split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    if (line.startsWith('{')) {
                        const json = JSON.parse(line);
                        if (json.textDelta) {
                            process.stdout.write(json.textDelta);
                        } else if (json.error) {
                            console.error('\n❌ Error:', json.error);
                        } else if (json.path) {
                            console.log(`\n✅ Screenshot saved to: ${json.path}`);
                        }
                    } else {
                        process.stdout.write(line);
                    }
                }
            } catch (e) {
                process.stdout.write(data);
            }
        });

        res.on('end', () => {
            process.stdout.write('\n');
        });
    });

    req.on('error', (e) => {
        console.error(`❌ Error: Could not connect to Comet-AI browser. Is it running? (${e.message})`);
        process.exit(1);
    });

    req.write(postData);
    req.end();
}

runCommand();

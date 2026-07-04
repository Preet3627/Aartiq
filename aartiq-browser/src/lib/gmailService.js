/**
 * Gmail Integration Service (JavaScript wrapper)
 * Connect Gmail for email management, OTP capture, and email AI
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'credentials', 'gmail-credentials.json');
const TOKEN_PATH = path.join(__dirname, '..', '..', 'credentials', 'gmail-token.json');

let gmailInstance = null;
let oauth2Client = null;

async function loadCredentials() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error('Gmail credentials not found. Please set up credentials at: ' + CREDENTIALS_PATH);
    }
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

async function loadToken() {
    if (fs.existsSync(TOKEN_PATH)) {
        return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    }
    return null;
}

async function saveToken(token) {
    const dir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
}

async function authorize() {
    const credentials = await loadCredentials();
    const token = await loadToken();
    
    oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uris[0]
    );

    if (token) {
        oauth2Client.setCredentials(token);
        return { success: true, authorized: true };
    }

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
    });

    return { success: true, authorized: false, authUrl };
}

async function getGmailMessages(query = '', maxResults = 10) {
    if (!oauth2Client) {
        await authorize();
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
    });

    const messages = [];
    if (response.data.messages) {
        for (const msg of response.data.messages) {
            const full = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });
            messages.push(parseMessage(full.data));
        }
    }

    return messages;
}

async function listMessages(query = '', maxResults = 10) {
    return getGmailMessages(query, maxResults);
}

async function getMessage(messageId) {
    if (!oauth2Client) {
        await authorize();
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
    });

    return parseMessage(response.data);
}

async function sendMessage(to, subject, body, threadId = null) {
    if (!oauth2Client) {
        await authorize();
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const message = createMimeMessage(to, subject, body, threadId);
    
    const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
            raw: Buffer.from(message).toString('base64url')
        }
    });

    return response.data;
}

async function addLabelToMessage(messageId, labelName) {
    if (!oauth2Client) {
        await authorize();
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Create label if it doesn't exist
    let labelId;
    const labelRes = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelRes.data.labels?.find(l => l.name === labelName);
    
    if (existingLabel) {
        labelId = existingLabel.id;
    } else {
        const newLabel = await gmail.users.labels.create({
            userId: 'me',
            requestBody: { name: labelName }
        });
        labelId = newLabel.data.id;
    }

    // Add label to message
    await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { addLabelIds: [labelId] }
    });

    return { success: true, labelId };
}

function parseMessage(message) {
    const headers = message.payload?.headers || [];
    
    return {
        id: message.id,
        threadId: message.threadId,
        from: headers.find(h => h.name.toLowerCase() === 'from')?.value || '',
        to: headers.find(h => h.name.toLowerCase() === 'to')?.value || '',
        subject: headers.find(h => h.name.toLowerCase() === 'subject')?.value || '',
        body: getBody(message.payload),
        date: new Date(parseInt(message.internalDate)),
        labels: message.labelIds || [],
        hasAttachments: message.payload?.parts?.some(p => p.filename) || false,
        isRead: !message.labelIds?.includes('UNREAD')
    };
}

function getBody(payload) {
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf8');
            }
        }
    }
    return '';
}

function createMimeMessage(to, subject, body, threadId) {
    const lines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        threadId ? `References: ${threadId}` : '',
        threadId ? `In-Reply-To: ${threadId}` : '',
        '',
        body
    ];
    return lines.filter(l => l).join('\r\n');
}

module.exports = {
    authorize,
    getGmailMessages,
    listMessages,
    getMessage,
    sendMessage,
    addLabelToMessage
};

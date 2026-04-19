const { google } = require('googleapis');

const createGmailHandlers = (ipcMain, store) => {
  let oauth2Client = null;
  let gmail = null;
  
  const initGmail = () => {
    const clientId = store.get('google_client_id');
    const clientSecret = store.get('google_client_secret');
    const redirectUri = store.get('google_redirect_uri');
    if (clientId && clientSecret && redirectUri) {
      oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    }
  };
  
  ipcMain.handle('get-gmail-messages', async () => {
    if (!gmail) return { error: 'Gmail not initialized' };
    try {
      const messages = await gmail.users.messages.list({ userId: 'me', maxResults: 10 });
      return { messages: messages.data.messages || [] };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  ipcMain.handle('gmail-authorize', async () => {
    if (!oauth2Client) return { success: false, error: 'OAuth not configured' };
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
    });
    return { success: true, url: authUrl };
  });
  
  ipcMain.handle('gmail-list-messages', async (event, query, maxResults = 10) => {
    if (!gmail) return { error: 'Gmail not initialized' };
    try {
      const messages = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });
      return { messages: messages.data.messages || [] };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  ipcMain.handle('gmail-get-message', async (event, messageId) => {
    if (!gmail) return { error: 'Gmail not initialized' };
    try {
      const message = await gmail.users.messages.get({ userId: 'me', id: messageId });
      return { message: message.data };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  ipcMain.handle('gmail-send-message', async (event, to, subject, body, threadId) => {
    if (!gmail) return { error: 'Gmail not initialized' };
    try {
      const message = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');
      const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      const sent = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encoded, threadId }
      });
      return { success: true, messageId: sent.data.id };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  ipcMain.handle('gmail-add-label-to-message', async (event, messageId, labelName) => {
    if (!gmail) return { error: 'Gmail not initialized' };
    try {
      const labels = await gmail.users.labels.list({ userId: 'me' });
      const label = labels.data.labels.find(l => l.name === labelName);
      if (!label) return { error: 'Label not found' };
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { addLabelIds: [label.id] }
      });
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  return { initGmail };
};

module.exports = { createGmailHandlers };
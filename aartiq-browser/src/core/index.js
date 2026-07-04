const commandValidator = require('./command-validator');
const shellExecutor = require('./shell-executor');
const pdfGenerator = require('./pdf-generator');
const systemControls = require('./system-controls');
const vaultHandlers = require('./vault-handlers');
const gmailHandlers = require('./gmailHandlers');

module.exports = {
  commandValidator,
  shellExecutor,
  pdfGenerator,
  systemControls,
  vaultHandlers,
  gmailHandlers
};

const fs = require('fs');
const content = fs.readFileSync('main.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('ipcMain.handle')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});

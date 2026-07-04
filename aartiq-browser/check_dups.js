
const fs = require('fs');
const content = fs.readFileSync('main.js', 'utf8');
const lines = content.split('\n');
const handlers = {};
lines.forEach((line, index) => {
    const match = line.match(/ipcMain\.handle\(['"](.+?)['"]/);
    if (match) {
        const key = match[1];
        if (!handlers[key]) handlers[key] = [];
        handlers[key].push(index + 1);
    }
});
for (const [key, lines] of Object.entries(handlers)) {
    if (lines.length > 1) {
        console.log(`Duplicate handler for '${key}': lines ${lines.join(', ')}`);
    }
}

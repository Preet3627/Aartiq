# Quick Reference: Aartiq Browser Setup

## 🚀 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Check for duplicate IPC handlers
npm run check-dups

# Build Next.js app only
npm run build
```

## 📦 Building Executables

### Windows
```bash
npm run electron:build:win
# or
npm run dist:win
```

### macOS
```bash
npm run electron:build:mac
# or
npm run dist:mac
```

### Linux
```bash
npm run electron:build:linux
```

## 🔐 Code Signing (Optional but Recommended)

### Quick Setup
1. Purchase code signing certificate (~$100-$400/year)
2. Export as `.pfx` file
3. Place in `certs/aartiq-browser.pfx`
4. Set password: `$env:CSC_KEY_PASSWORD="your-password"`
5. Build normally - signing happens automatically

**Full Guide**: See `CODE_SIGNING.md`

### GitHub Actions Setup
1. Convert certificate to Base64
2. Add to GitHub Secrets:
   - `WINDOWS_CERTIFICATE` (Base64 string)
   - `WINDOWS_CERTIFICATE_PASSWORD` (password)
3. Push to trigger build

## 🐛 Troubleshooting

### App Crashes on Startup
**Error**: "Attempted to register a second handler"

**Fix**:
1. Close ALL instances of the app
2. Check Task Manager for lingering processes
3. Kill any `Aartiq Browser.exe` processes
4. Restart the app

**Full Guide**: See `CRASH_FIX.md`

### Build Fails
```bash
# Verify build files exist
node verify-build.js

# Check for errors
npm run build
```

### Certificate Issues
- Ensure certificate hasn't expired
- Verify password is correct
- Check certificate is code-signing type (not SSL)

## 📝 Important Files

| File | Purpose |
|------|---------|
| `main.js` | Electron main process |
| `preload.js` | IPC bridge to renderer |
| `package.json` | Build configuration |
| `CODE_SIGNING.md` | Complete signing guide |
| `CRASH_FIX.md` | Troubleshooting crashes |
| `CHANGELOG.md` | Recent changes |

## 🔑 Environment Variables

### Development
- `NODE_ENV=development` (auto-set by npm run dev)

### Code Signing
- `CSC_LINK=certs/aartiq-browser.pfx`
- `CSC_KEY_PASSWORD=your-certificate-password`

### Optional
- `GOOGLE_CLIENT_ID` (legacy, now uses landing page auth)
- `MCP_SERVER_PORT=3001` (AI server port)

## 📊 Build Output

Executables are created in the `release/` directory:

- **Windows**: `Aartiq Browser Setup 0.1.8.exe`
- **macOS**: `Aartiq Browser-0.1.8.dmg`
- **Linux**: `Aartiq Browser-0.1.8.AppImage`

## 🎯 Quick Fixes

### Clear App Cache
```powershell
# Windows
rd /s /q "%APPDATA%\aartiq-browser"

# macOS
rm -rf ~/Library/Application\ Support/aartiq-browser

# Linux
rm -rf ~/.config/aartiq-browser
```

### Reinstall Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### Force Clean Build
```bash
npm run build
rm -rf release
npm run dist:win  # or dist:mac
```

## 🆘 Getting Help

1. Check `CRASH_FIX.md` for common errors
2. Check `CODE_SIGNING.md` for signing issues
3. Run `npm run check-dups` to verify IPC handlers
4. Check GitHub Issues for similar problems

## 📚 Documentation

- `README.md` - Project overview
- `SETUP.md` - Initial setup guide
- `CODE_SIGNING.md` - Code signing setup
- `CRASH_FIX.md` - Troubleshooting crashes
- `CHANGELOG.md` - Recent changes and fixes

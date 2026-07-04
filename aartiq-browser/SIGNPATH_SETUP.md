# SignPath Foundation - Free Code Signing Setup

## Overview

SignPath Foundation provides **FREE code signing certificates** for Open Source projects. This is perfect for Aartiq Browser!

## Eligibility Requirements

### ✅ Aartiq Browser Qualifies Because:

1. **OSS License**: Uses proper open source license ✅
2. **No Malware**: Clean, legitimate browser ✅
3. **No Proprietary Code**: All code is open source ✅
4. **Actively Maintained**: Regular commits and updates ✅
5. **Released**: Already has releases ✅
6. **Documented**: README and documentation exist ✅

### 📋 Requirements to Meet:

1. **Multi-Factor Authentication**: Enable 2FA on GitHub
2. **Code Signing Policy**: Add to README/website
3. **Team Roles**: Define Authors, Reviewers, Approvers
4. **Privacy Policy**: Specify data collection (if any)
5. **Metadata**: Set product name/version in builds

---

## Step 1: Prepare Your Repository

### 1.1 Enable 2FA on GitHub

All team members must enable two-factor authentication:
1. Go to GitHub Settings → Password and authentication
2. Enable Two-factor authentication
3. Use authenticator app (Google Authenticator, Authy, etc.)

### 1.2 Add Code Signing Policy to README

Add this section to your `README.md`:

```markdown
## Code Signing Policy

**Free code signing provided by [SignPath.io](https://signpath.io), certificate by SignPath Foundation**

### Team Roles

- **Authors/Committers**: [GitHub Contributors](https://github.com/YOUR_USERNAME/aartiq-browser/graphs/contributors)
- **Reviewers**: All pull requests reviewed by project maintainers
- **Approvers**: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)

### Privacy Policy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

**Optional Features** (user-controlled):
- Cloud sync: Syncs bookmarks/history to Firebase (disabled by default)
- AI features: Sends queries to selected LLM provider (user configures API keys)
- Analytics: No analytics or telemetry collected

### Build Verification

All signed releases are built from source code in this repository using GitHub Actions. The build process is transparent and verifiable.
```

### 1.3 Add Privacy Policy File

Create `PRIVACY.md`:

```markdown
# Privacy Policy - Aartiq Browser

## Data Collection

Aartiq Browser does **not** collect, store, or transmit any user data by default.

## Optional Features (User-Controlled)

### Cloud Sync (Optional)
- **What**: Bookmarks, history, settings
- **Where**: User's own Firebase project or MySQL database
- **Control**: Completely optional, disabled by default
- **Configuration**: User provides their own credentials

### AI Features (Optional)
- **What**: User queries sent to LLM providers
- **Where**: User-selected provider (Ollama local, OpenAI, Google, etc.)
- **Control**: User configures API keys
- **Data**: Only sent when user explicitly uses AI features

### Web Search (Optional)
- **What**: Search queries
- **Where**: User-selected search engine (Google, DuckDuckGo, Bing)
- **Control**: User selects default search engine

## Third-Party Services

When users choose to use third-party services, those services' privacy policies apply:
- Firebase: https://firebase.google.com/support/privacy
- OpenAI: https://openai.com/privacy
- Google Gemini: https://ai.google.dev/gemini-api/terms

## Local Storage

All user data is stored locally on the user's device in:
- Windows: `%APPDATA%\aartiq-browser`
- macOS: `~/Library/Application Support/aartiq-browser`
- Linux: `~/.config/aartiq-browser`

## Updates

The application does not automatically check for updates or phone home.

## Contact

For privacy concerns: [Your Email or GitHub Issues]

Last Updated: February 2026
```

---

## Step 2: Apply for SignPath Foundation

### 2.1 Application Process

1. **Visit**: https://about.signpath.io/code-signing/open-source-projects
2. **Click**: "Apply" button
3. **Fill out form**:
   - Project name: Aartiq Browser
   - Repository URL: https://github.com/YOUR_USERNAME/aartiq-browser
   - License: [Your OSS License]
   - Description: AI-powered browser with local LLM support
   - Website: [Your project website or GitHub Pages]

### 2.2 Information to Provide

**Project Description**:
```
Aartiq Browser is an AI-powered web browser built with Electron and Next.js. 
It features local LLM integration, advanced tab management, built-in ad blocking, 
and privacy-focused browsing. The browser allows users to interact with AI 
assistants using their own API keys or local Ollama models.
```

**Why you need signing**:
```
To eliminate Windows SmartScreen warnings and provide users with verified, 
trusted downloads. Code signing ensures users can verify the authenticity 
of our releases and protects against tampering.
```

---

## Step 3: Configure SignPath.io

Once approved, you'll get access to SignPath.io:

### 3.1 Create SignPath Configuration

Create `.signpath.yml` in your repository root:

```yaml
# SignPath configuration for Aartiq Browser
version: 1.0

artifacts:
  - name: Aartiq Browser Windows Installer
    description: Windows NSIS installer for Aartiq Browser
    type: nsis-installer
    
    file-metadata-restrictions:
      product-name: Aartiq Browser
      product-version: ${VERSION}
      
    signing-configuration:
      kind: authenticode
      
    build:
      project-file: package.json
      build-command: npm run dist:win
      
  - name: Aartiq Browser Executable
    description: Main Aartiq Browser executable
    type: pe-file
    
    file-metadata-restrictions:
      product-name: Aartiq Browser
      product-version: ${VERSION}
      
    signing-configuration:
      kind: authenticode
```

### 3.2 Update GitHub Actions Workflow

Modify `.github/workflows/build.yml`:

```yaml
name: Build and Sign Aartiq Browser

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build Next.js app
        run: npm run build
      
      - name: Build unsigned executable
        run: npm run dist:win
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: false
      
      - name: Upload to SignPath
        uses: signpath/github-action-submit-signing-request@v1
        with:
          api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
          organization-id: ${{ secrets.SIGNPATH_ORGANIZATION_ID }}
          project-slug: 'aartiq-browser'
          signing-policy-slug: 'release-signing'
          artifact-configuration-slug: 'windows-installer'
          input-artifact-path: 'release/Aartiq Browser Setup *.exe'
          output-artifact-path: 'release/signed/'
          wait-for-completion: true
      
      - name: Upload signed artifacts
        uses: actions/upload-artifact@v3
        with:
          name: aartiq-browser-windows-signed
          path: release/signed/*.exe
```

---

## Step 4: GitHub Secrets Configuration

Add these secrets to your GitHub repository:

1. **SIGNPATH_API_TOKEN**:
   - Get from SignPath.io dashboard
   - Settings → API Tokens → Create new token

2. **SIGNPATH_ORGANIZATION_ID**:
   - Found in SignPath.io dashboard URL
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### How to Add Secrets:

1. Go to GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret

---

## Step 5: Release Process

### 5.1 Create a Release

```bash
# Tag a new version
git tag v0.1.9
git push origin v0.1.9
```

### 5.2 Approve Signing Request

1. GitHub Actions builds the unsigned executable
2. Uploads to SignPath.io
3. **You** (as approver) log into SignPath.io
4. Review the signing request
5. Click "Approve"
6. SignPath signs the executable
7. GitHub Actions downloads signed file
8. Creates GitHub release with signed executable

---

## Benefits of SignPath Foundation

### ✅ Advantages:

1. **Completely Free** - No annual fees
2. **Trusted Certificate** - Issued by DigiCert via SignPath Foundation
3. **No SmartScreen Warnings** - Immediate trust
4. **Automated** - Integrates with GitHub Actions
5. **Transparent** - Build process is verifiable
6. **Community Support** - Designed for OSS projects

### ⚠️ Considerations:

1. **Publisher Name**: Will show "SignPath Foundation" (not your name)
2. **Manual Approval**: Each release needs manual approval
3. **Build Verification**: Must build from source in CI/CD
4. **Policy Compliance**: Must follow SignPath Foundation rules

---

## Comparison: SignPath vs. Purchased Certificate

| Feature | SignPath Foundation | Purchased Certificate |
|---------|-------------------|---------------------|
| **Cost** | Free | $100-400/year |
| **Publisher Name** | SignPath Foundation | Your name/company |
| **Trust Level** | Immediate | Immediate |
| **Automation** | GitHub Actions | GitHub Actions |
| **Approval** | Manual per release | Automatic |
| **Requirements** | OSS policy compliance | Payment only |
| **Best For** | Open source projects | Commercial products |

---

## Quick Start Checklist

- [ ] Enable 2FA on GitHub
- [ ] Add Code Signing Policy to README
- [ ] Create PRIVACY.md
- [ ] Apply at https://about.signpath.io
- [ ] Wait for approval (usually 1-2 weeks)
- [ ] Set up SignPath.io account
- [ ] Create `.signpath.yml`
- [ ] Add GitHub secrets
- [ ] Update GitHub Actions workflow
- [ ] Create release tag
- [ ] Approve signing request in SignPath.io
- [ ] Download signed executable

---

## Support

- **SignPath Docs**: https://about.signpath.io/documentation
- **SignPath Support**: support@signpath.io
- **GitHub Action**: https://github.com/signpath/github-action-submit-signing-request

---

## Timeline

1. **Application**: Submit today
2. **Review**: 1-2 weeks for approval
3. **Setup**: 1-2 hours to configure
4. **First Release**: Same day after setup
5. **Future Releases**: Automatic builds, manual approval

**Total Time to First Signed Release**: ~2-3 weeks

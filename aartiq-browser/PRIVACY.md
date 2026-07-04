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
- **Where**: User-selected provider (Ollama local, OpenAI, Google Gemini, Anthropic, Groq)
- **Control**: User configures their own API keys
- **Data**: Only sent when user explicitly uses AI features
- **Local Option**: Users can run completely offline with Ollama

### Web Search (Optional)
- **What**: Search queries
- **Where**: User-selected search engine (Google, DuckDuckGo, Bing)
- **Control**: User selects default search engine in settings

## Third-Party Services

When users choose to use third-party services, those services' privacy policies apply:
- Firebase: https://firebase.google.com/support/privacy
- OpenAI: https://openai.com/privacy
- Google Gemini: https://ai.google.dev/gemini-api/terms
- Anthropic: https://www.anthropic.com/privacy
- Groq: https://groq.com/privacy-policy/

## Local Storage

All user data is stored locally on the user's device in:
- **Windows**: `%APPDATA%\aartiq-browser`
- **macOS**: `~/Library/Application Support/aartiq-browser`
- **Linux**: `~/.config/aartiq-browser`

Users have full control over this data and can delete it at any time.

## Network Requests

The application makes network requests only when:
1. User navigates to websites (standard browser behavior)
2. User explicitly uses AI features with configured API keys
3. User enables optional cloud sync with their own backend
4. User performs web searches

**No telemetry, analytics, or tracking is performed.**

## Updates

The application does not automatically check for updates or phone home. Users must manually download new versions from GitHub releases.

## Security

- Passwords are stored locally using OS-level encryption
- API keys are stored in local encrypted storage
- No data is sent to Aartiq Browser developers

## Children's Privacy

Aartiq Browser does not knowingly collect any information from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted in this file with an updated date.

## Contact

For privacy concerns or questions:
- GitHub Issues: https://github.com/YOUR_USERNAME/aartiq-browser/issues
- Email: [Your Email]

**Last Updated**: February 16, 2026

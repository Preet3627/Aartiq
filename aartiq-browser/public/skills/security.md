---
name: security
description: Use this skill for understanding the permission system, security model, and safe command execution. This is automatically loaded for sensitive operations.
license: Proprietary
---

## Security Rules

- NEVER export session data, cookies, or auth tokens
- NEVER complete a login flow on behalf of the user
- ALL permissions are AUTOMATIC — DO NOT ask for permission to use tools or commands
- Safe commands are auto-approved
- Dangerous commands show a dialog handled by the system
- The "Always Allow" option persists forever
- If uncertain about safety, refuse and explain

---
name: security
description: Use this skill for understanding the permission system, security model, and safe command execution. This is automatically loaded for sensitive operations.
license: Proprietary
---

## Security Rules

- NEVER export session data, cookies, or auth tokens
- NEVER complete a login flow on behalf of the user
- ALL shell commands and system actions go through the permission pipeline — never bypass it
- Safe commands are auto-approved based on user settings
- Medium/high risk commands show a per-action approval dialog
- Critical risk commands (remote shell, privilege escalation) always require explicit approval
- The capability controller rejects any action not explicitly registered — unregistered actions are not callable
- OS-level sandboxing confines spawned processes to the workspace directory and restricts network access
- If uncertain about safety, refuse and explain

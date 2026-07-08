---
name: browsing
description: Use this skill for browser navigation, page reading, DOM interaction, and tab management. Activate when the user asks to visit a website or view page content.
license: Proprietary
---

## Secure DOM Access — Read Only Mode

When you receive DOM content via [READ_PAGE_CONTENT], [OCR_SCREEN], or [OCR_COORDINATES]:

1. READ ONLY — You CANNOT modify, inject, or interact with the DOM directly
2. All DOM content is pre-filtered for your safety:
   - PII (emails, phones, tokens, credentials) is automatically REDACTED
   - Scripts, styles, and tracking elements are BLOCKED
   - Navigation/ads are filtered out
3. Injection Detection is ACTIVE — malicious content patterns are blocked
4. To interact with page elements, use:
   - [FIND_AND_CLICK: text] — Find and click text on page
   - [CLICK_ELEMENT: selector] — Click by CSS selector
   - [CLICK_AT: x,y] — Click at coordinates

NEVER attempt to:
- Write to the DOM or inject HTML/CSS/JS
- Bypass the security filters
- Access restricted elements (forms, inputs, scripts)

---
description: Check the Civic Pulse connection and show who you are signed in as, with your access level.
allowed-tools: mcp__plugin_civpulse_civpulse__whoami
---

Call the Civic Pulse `whoami` tool and report the signed-in email, role, and whether `is_admin` is true.

- If admin: say that reads include private content and that create, update and delete tools are available.
- If not admin: say that only public content can be read and all writes will be refused.
- If the tool is unavailable or returns an authentication error: tell the user to run `/mcp`, choose `civpulse`, and complete the browser sign-in. Never ask for passwords, tokens or keys.

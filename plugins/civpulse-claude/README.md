# Civic Pulse plugin for Claude Code

Lets Claude Code search and manage Civic Pulse data through the remote MCP
server, with skills and agents that know the data model. No credentials are
bundled: you sign in with your own Civic Pulse account.

The ChatGPT/Codex package lives in [`../civpulse`](../civpulse) and is separate.
This package shares its skills and references (copied by `bun run plugin:claude:sync`).

## Install

From a clone of this repository, inside Claude Code:

```text
/plugin marketplace add /path/to/www.civpulse.org
/plugin install civpulse@civpulse
```

Or from GitHub: `/plugin marketplace add kerryhatcher/www.civpulse.org`.

Then run `/mcp`, choose `civpulse`, and complete the browser sign-in at
civpulse.org. Run `/civpulse:status` to confirm who you are signed in as.

To disconnect, revoke the client under
[Account → Connected apps](https://www.civpulse.org/account/).

## What you get

- **MCP server** `civpulse` → `https://api.civpulse.org/functions/v1/mcp/v2`
  (the compact 66-tool catalog; OAuth with dynamic client registration).
- **Skills:** `civic-data-model` (what the data is, visibility, when edits go
  live), `civic-research`, `civic-editing`, `civic-mapping`, `civic-results`,
  `civic-user-admin`.
- **Agents:**
  - `civic-researcher`: read-only; cannot write.
  - `civic-editor`: creates and updates records; no record-delete tools; returns
    a plan when a write is not clearly authorized.
  - `civic-results-transcriber`: turns result tapes and turnout JSON into saved
    results; dry run unless saving is explicitly authorized.
- **Command:** `/civpulse:status`.

## Access

Every tool call runs as you. Regular users can read public content. Admins can
also read private content and create, update and delete records. The database,
not this plugin, enforces this. Edits are live in Postgres immediately but show
on the public website only after the next rebuild.

## Maintain

The shared skills and `references/` are copies of `plugins/civpulse`. After
changing that package or running `bun run plugin:build`:

```sh
bun run plugin:claude:sync    # copy shared files, then validate
bun run plugin:claude:check   # CI-safe: fails on drift or invalid files
```

Skills `civic-data-model` and everything under `agents/` and `commands/` are
owned by this package. Bump `.claude-plugin/plugin.json` when releasing. To use
the larger 128-tool catalog instead, change the `.mcp.json` URL to `/mcp`.

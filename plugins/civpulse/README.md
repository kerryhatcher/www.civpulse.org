# Civic Pulse plugin

Portable Codex/ChatGPT plugin connecting to https://mcp.civpulse.org/mcp over
streamable HTTP. This folder is the complete source; no credentials are bundled.
The root Agent Plugins 1.0 manifests support portable clients. `.codex-plugin/`
and `.mcp.json` provide the compatibility layout for Codex clients that use it.

## Connect

Install the private plugin using its account listing, then connect Civic Pulse
when prompted. Sign in on `https://new.civpulse.org` and approve the client’s
access. Each user connects their own account through Supabase OAuth with dynamic
client registration and PKCE. The plugin gets that account’s supported access:
research for signed-in users, content writes for administrators. OpenID profile
scopes do not restrict the database permissions of an approved administrator.

To disconnect, revoke the app under
[Account → Connected apps](https://new.civpulse.org/account/). Revocation rejects
existing MCP access tokens and prevents refresh. Never paste tokens or passwords
into chat or into this package.

## Included workflows

- `civic-research`: search civic records, election detail and article reading lists.
- `civic-editing`: maintain content, associations, profile display names and images.
- `civic-mapping`: manage maps, reusable layers, stored GeoJSON and individual features.

[Tool guide](references/tools.md) and [full schemas](references/tool-schemas.json)
are generated from the server implementation. Live MCP schemas remain authoritative.
Tool responses are JSON text. The plugin provides no interactive MCP App UI.

## Build and maintain

From the repository root:

```sh
bun install
bun run plugin:build
bun run mcp:check
bun run mcp:test  # requires the running local Supabase stack
```

The archive is written outside this folder to `dist/plugins/civpulse-1.0.0.zip`.
The builder validates manifests, compatibility metadata, skill YAML and contained
references, regenerates the catalog, excludes symlinks/credentials, and inspects
the ZIP. Keep both manifests and both MCP configurations synchronized on edits.
Bump both plugin versions together before uploading an updated release. The
plugin version is independent of the MCP Worker version.

MCP implementation: `apps/mcp/`. Deploy and auth details: `docs/mcp.md` at the
repository root. Public website metadata is static: a database edit can require
a separate web rebuild/deploy. The plugin does not deploy the site or manage
administrator accounts.

Format reference: [OpenAI plugin documentation](https://developers.openai.com/plugins/build/plugins).

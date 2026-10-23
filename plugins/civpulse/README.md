# Civic Pulse plugin

Portable Codex/ChatGPT plugin connecting to https://mcp.civpulse.org/mcp over
streamable HTTP. This folder is the complete source; no credentials are bundled.
The root Agent Plugins 1.0 manifest and `.codex-plugin/` compatibility manifest
both link the registered ChatGPT connection through `.app.json`. The package
uses that hosted connection rather than declaring a desktop-managed MCP server.
For other MCP clients, the direct remote configuration is preserved in
`plugins/civpulse-mcp.json` at the repository root.

## Connect

Install the private plugin using its account listing, then connect Civic Pulse
when prompted. Sign in on `https://www.civpulse.org` and approve the client’s
access. Each user connects their own account through Supabase OAuth with dynamic
client registration and PKCE. The plugin gets that account’s supported access:
public-content research for regular users; content writes, account search and
explicitly requested user promotion for administrators. OpenID profile
scopes do not restrict the database permissions of an approved administrator.

To disconnect, revoke the app under
[Account → Connected apps](https://www.civpulse.org/account/). Revocation rejects
existing MCP access tokens and prevents refresh. Never paste tokens or passwords
into chat or into this package.

## Included workflows

- `civic-research`: search civic records, election detail and article reading lists.
- `civic-editing`: maintain content, associations, profile display names and images.
- `civic-mapping`: manage maps, reusable layers, stored GeoJSON and individual features.
- `civic-user-admin`: find registered accounts and promote an existing user (admin only).

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

The archive is written outside this folder to `dist/plugins/civpulse-1.1.0.zip`.
The builder validates manifests, compatibility metadata, skill YAML and contained
references, regenerates the catalog, excludes symlinks/credentials, and inspects
the ZIP. Keep both manifests and the registered app mapping synchronized on edits.
Bump both plugin versions together before uploading an updated release. The
plugin version is independent of the MCP Worker version.

The private ChatGPT connection is `asdk_app_6ada21b2638c8191af7c86b9a80a5931`.
Users must connect their own Civic Pulse account. Merely packaging an HTTPS MCP
URL does not register a ChatGPT cloud connection. Do not restore `mcp.json` or
`.mcp.json` inside this account package, which would declare a second server.
The app binding is account-specific and is not a public-directory submission.

MCP implementation: `apps/mcp/`. Deploy and auth details: `docs/mcp.md` at the
repository root. Public website metadata is static: a database edit can require
a separate web rebuild/deploy. The plugin does not deploy the site. Admins can search registered accounts with
`search_users` and explicitly promote another account with `promote_user_to_admin`.
Account provisioning/deletion, demotion and password resets remain outside the plugin.

Format reference: [OpenAI plugin documentation](https://developers.openai.com/plugins/build/plugins).

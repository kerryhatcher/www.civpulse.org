# MCP server

Civic Pulse runs a remote [Model Context Protocol](https://modelcontextprotocol.io)
server so people can let their AI agents search the directory and (for admins)
edit and create records. Agents authenticate with **OpenID Connect / OAuth 2.1**
through Supabase Auth, and every tool call runs as the signed-in user, so Row
Level Security decides what an agent can see or change.

## Endpoint

| | |
| --- | --- |
| MCP endpoint | `https://mcp.civpulse.org/mcp` (streamable HTTP) |
| Protected-resource metadata | `https://mcp.civpulse.org/.well-known/oauth-protected-resource` |
| Authorization server | `https://drzcrodqflzkzzbqsags.supabase.co/auth/v1` (Supabase Auth OAuth 2.1 server) |
| Consent page | `https://new.civpulse.org/oauth/consent/` |

## Auth model

1. The MCP client discovers the authorization server from the protected-resource
   metadata (returned in the `WWW-Authenticate` challenge on an unauthenticated request).
2. The user signs in and approves the client on the consent page.
3. Supabase issues access + refresh tokens; the client sends the access token as
   `Authorization: Bearer …` to the MCP server.
4. The MCP server forwards that token to Supabase, so `auth.uid()` and the RLS
   policies apply exactly as they do in the web app.

**No service-role key is used for agent traffic.** Reads follow visibility
(`public` / `unlisted` / `private`); `create_*` / `update_*` / `delete_*` succeed
only for admins (`public.is_admin()`).

## Tools

**Read** (any authenticated caller): `whoami`, `search_organizations`,
`search_maps`, `search_events`, `search_people`, `search_elections`,
`list_calendars`, `get_map`, `get_event`, `get_person`, `get_election`.

**Write** (admin): `create_organization`, `update_organization`,
`delete_organization`, `create_calendar`, `update_calendar`, `delete_calendar`,
`create_event`, `update_event`, `delete_event`, `create_person`,
`update_person`, `delete_person`, `create_election`, `update_election`,
`delete_election`.

## Enabling it on a Supabase project

The deployable Worker lives in `apps/mcp`. Before agents can complete the OAuth
flow, the Supabase project's OAuth 2.1 server must be enabled:

1. Authentication → **OAuth Server** → enable OAuth 2.1.
2. Set the **Authorization Path** to `/oauth/consent`.
3. Optionally enable **Dynamic Client Registration** so MCP clients can register
   themselves; otherwise pre-register a client per agent.
4. Authentication → **URL Configuration** → set the **Site URL** to the site that
   serves the consent page (for example `https://new.civpulse.org`).

Until step 1 is done, `POST /auth/v1/oauth/authorize` returns
`feature_disabled`, and agents cannot run the OAuth flow.

## Connecting a client

Most MCP clients accept a remote URL and handle OAuth automatically:

```json
{
  "mcpServers": {
    "civicpulse": { "url": "https://mcp.civpulse.org/mcp" }
  }
}
```

Clients that only support local (stdio) servers can use `mcp-remote`:

```json
{
  "mcpServers": {
    "civicpulse": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.civpulse.org/mcp"]
    }
  }
}
```

## Deploying

```bash
bun run --cwd apps/mcp check
CLOUDFLARE_ACCOUNT_ID=<account-id> bun run --cwd apps/mcp deploy
```

The Supabase URL, publishable key, resource URL, and authorization-server URL are set in
`apps/mcp/wrangler.jsonc` under `vars` — all public values, since agents supply
their own user token.


Pushes to `main` that change `apps/mcp/**` or the shared package manifest/lockfile
are checked and deployed automatically by Cloudflare Workers Builds. See
[development.md](./development.md#automatic-cloudflare-deployments) for settings.

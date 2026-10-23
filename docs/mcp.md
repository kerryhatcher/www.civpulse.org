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
| Consent page | `https://www.civpulse.org/oauth/consent/` |

## Auth model

1. The MCP client discovers the authorization server from the protected-resource
   metadata (returned in the `WWW-Authenticate` challenge on an unauthenticated request).
2. The user signs in and approves the client on the consent page.
3. Supabase issues access + refresh tokens; the client sends the access token as
   `Authorization: Bearer …` to the MCP server.
4. The MCP server verifies the token with Supabase Auth, checks the issuer,
   audience, role and expiration, and checks the live user session on every request.
   Missing, invalid, expired and revoked tokens receive a `401` OAuth challenge;
   an unavailable authentication service receives `503` rather than accepting the request.
5. The MCP server forwards that token to Supabase, so `auth.uid()` and the RLS
   policies apply exactly as they do in the web app.

**No service-role key is used for agent traffic.** Reads follow visibility
(`public` / `unlisted` / `private`); `create_*` / `update_*` / `delete_*` succeed
only for admins (`public.is_admin()`).

Users can view their authorized clients under **Account → Connected apps** and
revoke a client's access. This removes the OAuth grant, invalidates its refresh
tokens, and causes existing access tokens to be rejected by the MCP endpoint's
live-session check. Profile scopes do not limit database access: an approved
client gets the same supported read/write permissions as the user's account.

## Tools

The server exposes **95 tools**. See the generated [tool guide](../plugins/civpulse/references/tools.md)
and [JSON schemas](../plugins/civpulse/references/tool-schemas.json) for every operation.

- **Search/read:** all ten civic types, unified search with type/limit/offset,
  election children, article reading lists, affiliations, map layers and stored
  feature properties/geometry.
- **Organization relationships:** `get_organization_relationships` returns related
  bodies and source URLs from either profile's perspective. Admin-only
  `create_organization_relationship`, `update_organization_relationship`, and
  `delete_organization_relationship` manage one reciprocal row with two labels.
- **Admin CRUD:** organizations, people, elections, calendars, events, maps,
  reusable layers, contests, ballot questions, articles, all their editable
  relationships, individual stored features and image storage.
- **Own account:** any signed-in user can read their profile and update their
  display name.
- **Admin accounts:** `search_users` finds registered accounts by email/display
  name and paginates 50 at a time with `offset`. `promote_user_to_admin` promotes
  another existing account; it grants private-content access, content writes and
  further promotions immediately. Both tools call the guarded database RPCs with
  the caller’s OAuth token. Regular users cannot list accounts or promote anyone.
  No service role, account creation/deletion, demotion or password reset is exposed.

Updates preserve omitted fields. Article updates preserve omitted association
sets; [] explicitly clears a set and null clears supported nullable fields.
Stored-layer updates preserve geometry when geojson is omitted; supplying it
replaces the dataset atomically. Non-admin geometry reads require a visible
containing map. Deletion descriptions identify cascading link/feature removal.

Tool annotations identify reads, writes and destructive actions, while the
database remains the enforcement boundary. Images are limited to the existing
public org-logos/person-images buckets and supported image formats, up to 2 MB.
Content edits do not trigger a public website rebuild.

## Codex / ChatGPT plugin

The complete portable plugin source is [plugins/civpulse](../plugins/civpulse/README.md),
including OAuth MCP configuration, compatible Codex manifests, brand icon and
research, editing, mapping and user-administration skills. Build and inspect the archive with:

```sh
bun run plugin:build
```

The output is `dist/plugins/civpulse-1.1.0.zip`. No tokens or secrets are packaged.
The account package links a registered ChatGPT cloud app through `.app.json`;
direct-client MCP configuration is preserved separately in
`plugins/civpulse-mcp.json`. The registered connection handles OAuth in ChatGPT.

## Enabling it on a Supabase project

The hosted Civic Pulse project has OAuth and dynamic registration enabled, with
`https://www.civpulse.org` as its Site URL and `/oauth/consent` as its Authorization
Path. Use the following steps when configuring another project.

The deployable Worker lives in `apps/mcp`. Before agents can complete the OAuth
flow, the Supabase project's OAuth 2.1 server must be enabled:

1. Authentication → **OAuth Server** → enable OAuth 2.1.
2. Set the **Authorization Path** to `/oauth/consent`.
3. Optionally enable **Dynamic Client Registration** so MCP clients can register
   themselves; otherwise pre-register a client per agent.
4. Authentication → **URL Configuration** → set the **Site URL** to the site that
   serves the consent page (for example `https://www.civpulse.org`).

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
      "command": "bunx",
      "args": ["mcp-remote", "https://mcp.civpulse.org/mcp"]
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

## Testing authentication locally

`supabase/config.toml` enables the local OAuth server and dynamic registration.
With the local Supabase stack running, run:

```bash
bun run mcp:test
```

This starts a temporary MCP Worker on port 8789, creates disposable local users,
an OAuth client and visibility fixtures, and checks discovery, registration,
PKCE, approve/deny, identity, visibility, admin/non-admin writes, refresh, and grant
revocation. It also checks missing, malformed, forged, expired, wrong-issuer,
wrong-audience, anon, and service-role token rejection. The suite also exercises full content/link CRUD, all-type search and pagination,
partial field/date/link preservation, stored-feature access and geometry rollback,
article transaction rollback, own profiles and image operations. Account tests
cover admin-only email/name search, pagination, safe output fields, non-admin
denial, self/missing-target rejection, idempotent promotion and immediate
permissions through an existing OAuth token. Test data is removed
afterward. The script rejects hosted Supabase URLs and never prints tokens.

For browser verification, use the consent and Account pages with the local
seeded admin. Ensure `auth.site_url` matches the actual Astro port when following
authorization redirects; Astro may choose another port if 4321 is occupied.

## Account administration release

MCP server version **1.2.0** was deployed from commit
`d91cbf0361fb47fd0366e5068b4f4e9f15325774` through the existing Supabase gate
and Workers Builds. Worker version: `8bedd1ae-b07e-456f-86be-1ee33cb6f486`.
The connected production `whoami` returned the new `role` field successfully.
Local OAuth integration tests exercised both new tools as admin and regular user,
including promotion without refreshing the existing OAuth token. All release CI
checks passed; no production account was promoted as a test.

The private plugin **1.1.0** was published as release
`pluginrel_6adacfd7e684819198e11e69e7d6e8d6` under the existing plugin and app IDs.
Read-back verified 95 tool schemas, four skills, and preserved app connection and
presentation. See [the release metadata](../plugins/civpulse-release.json).

A connected host may retain its earlier catalog. For a direct custom ChatGPT MCP
connection, refresh **Civic Pulse MCP** in the plugin connection details, then
start a new conversation and verify `search_users` and `promote_user_to_admin`
are available. See [OpenAI's metadata refresh guidance](https://developers.openai.com/plugins/deploy/connect-chatgpt).
The user deferred this host refresh; direct invocation of the new tools through
this existing ChatGPT connection has not yet been verified. The existing
connection remains intact.

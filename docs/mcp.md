# MCP server

HTTP(S) fields shared by article, layer, ballot-question and organization-link
tools export a complete, case-insensitive, flag-free URL pattern. Some connector
validators require a full-string match; a protocol-prefix-only pattern can reject
valid article URLs before they reach the server. Server URL parsing, length limits
and admin checks still apply. Run `bun test scripts/tests/mcp-urls.test.ts` to
verify exported schemas and atomic article/organization writes. Refresh a client's
tool catalog after deploying schema changes if it retains the previous pattern.

For account setup and everyday use, see the site's
[AI plugins, MCP, and skills guide](https://www.civpulse.org/docs/ai/).
It covers ChatGPT, Codex, generic MCP clients, plugin availability and skills.

Civic Pulse runs a remote [Model Context Protocol](https://modelcontextprotocol.io)
server so people can let their AI agents search the directory and (for admins)
edit and create records. Agents authenticate with **OpenID Connect / OAuth 2.1**
through Supabase Auth, and every tool call runs as the signed-in user, so Row
Level Security decides what an agent can see or change.

## Endpoint

| | |
| --- | --- |
| MCP endpoint | `https://api.civpulse.org/functions/v1/mcp` (streamable HTTP) |
| Protected-resource metadata | `https://api.civpulse.org/functions/v1/mcp/.well-known/oauth-protected-resource` |
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

Both endpoint spellings (with or without a trailing slash) require a signed-in,
non-anonymous user. OAuth discovery and CORS preflight remain public so clients
can start sign-in. All mutations require admin access; account-directory reads
also remain admin-only.

**No service-role key is used for agent traffic.** Reads follow visibility
(`public` / `unlisted` / `private`); `create_*` / `update_*` / `delete_*` succeed
only for admins (`public.is_admin()`).

Users can view their authorized clients under **Account → Connected apps** and
revoke a client's access. This removes the OAuth grant, invalidates its refresh
tokens, and causes existing access tokens to be rejected by the MCP endpoint's
live-session check. Profile scopes do not limit database access: an approved
client gets the same supported read/write permissions as the user's account.

## Tools

The compatibility endpoint exposes **128 tools**. The opt-in v2 catalog exposes
**66 tools**, consolidating common searches, getters, create/update pairs,
relationship writes and related reads without removing capabilities. See
[Compact catalog v2](#compact-catalog-v2), the generated [tool guide](../plugins/civpulse/references/tools.md)
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
- **Own account:** any signed-in user can read their profile. All MCP mutations,
  including display-name updates, require an admin.
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

### Compact catalog v2

After deploying this source, connect a client to
`https://api.civpulse.org/functions/v1/mcp/v2` to opt into the compact catalog.
The existing `/mcp` endpoint, registered app connection, and plugin binding keep
the compatibility catalog. No existing client is switched automatically.
Reconnect using the client's OAuth flow and refresh tool discovery when changing
endpoints. To roll back, reconnect to the original `/mcp` endpoint. Both versions
require the same verified, live Supabase user session; neither accepts anonymous
or service-role tokens. No database migration or permission change is required.

| Compatibility tools | Compact equivalent |
| --- | --- |
| `search_site` | `search_site` with the same query/type/limit/offset (default `mode: "site"`) |
| `search_organizations`, `search_people`, `search_maps`, `search_elections`, `search_events` | `search_site` with `mode: "directory"` and singular `type`: organization, person, map, election, event |
| `search_calendars`, `search_layers`, `search_articles`, `search_contests`, `search_ballot_questions` | `search_site` with the matching singular type and default site mode |
| `get_organization`, `get_person`, `get_election`, `get_contest`, `get_ballot_question`, `get_article`, `get_map`, `get_layer`, `get_calendar`, `get_event` | `get_civic_record` with the matching singular type and original `id` |

Site mode includes past events and supports offset pagination. Directory mode
preserves the original directory RPC's response fields, ordering, limits and
defaults. Directory mode has no offset: use site mode for pagination. Person
and organization directories default to 20 rows and cap at 50; maps default to
20 and cap at 100; elections/events default to 50 and cap at 100.

Event filters (`organization_id`, `calendar_id`, `include_past`) require directory
mode and `type: "event"`. Its `include_past` default remains false. Invalid mode,
type, filter and pagination combinations return an error before querying;
filters are never silently discarded. For example:

```json
{"name":"search_site","arguments":{"mode":"directory","type":"event","organization_id":"<organization-uuid>","include_past":true,"limit":50}}
```

```json
{"name":"get_civic_record","arguments":{"type":"person","id":"<person-uuid>"}}
```

Common retrieval returns the original type-specific envelope, including status
values, person affiliations, election contests/key dates, event calendar and
organization, and visible map layers/effective styles. A denied or missing map
never triggers a layer read. These dispatchers call the original RPCs with the
caller client; they never read unrestricted tables. Article association sets
remain admin-only. Specialized reads, bulk geometry operations, uploads,
legislation, election results, documents and account administration retain their
existing schemas. All access controls remain unchanged in both catalogs.

#### Create/update and relationship writes

The compact catalog replaces 13 create/update pairs with `save_<resource>`:
organization, calendar, event, person, election, map, layer, contest,
ballot_question, article, layer_feature, office and office_term. The request is a
strict, operation-specific object. Choose `operation: "create"` with all original
creation fields or `operation: "update"` with the original ID/key fields and only
the intended patch. Update never inserts or upserts a missing row. Empty patches
are rejected. Unknown fields and create/update field mismatches are rejected
before any database operation.

```json
{"name":"save_person","arguments":{"request":{"operation":"create","slug":"example-person","full_name":"Example Person"}}}
```

```json
{"name":"save_person","arguments":{"request":{"operation":"update","id":"<person-uuid>","phone":null}}}
```

`save_relationship` consolidates create/update for map_layer, contest_candidate,
person_organization, organization_relationship, article_person and
article_organization. Select `request.relationship` and place the original
fields with the explicit operation under `request.change`. Composite links keep
both endpoint UUIDs as keys and update only their attributes. The existing
organization_relationship variant uses its row UUID on update and still permits
the original endpoint, reciprocal-label and source corrections.

```json
{"name":"save_relationship","arguments":{"request":{"relationship":"map_layer","change":{"operation":"update","map_id":"<map-uuid>","layer_id":"<layer-uuid>","visible_by_default":false}}}}
```

Deletes remain separate: the 13 resource save tools have no delete operation.
Existing resource delete tools retain their original schemas and cascades (no
new office/office-term delete capability is added). `delete_relationship`
consolidates the six relationship deletes without deleting either endpoint:

```json
{"name":"delete_relationship","arguments":{"request":{"relationship":"map_layer","map_id":"<map-uuid>","layer_id":"<layer-uuid>"}}}
```

For organization_relationship deletion, supply its row `id` instead of endpoint
IDs. Deleting that reciprocal row removes the relationship from both profiles.

All compact writes delegate to the original admin-guarded handlers using the
caller client, with the original RLS and transactions. Omitted fields remain
untouched, nullable fields retain their explicit clearing behavior, and feature
IDs remain bigint strings. `save_article` retains atomic metadata and association
replacement: omitted sets are preserved, while an explicit `[]` still clears a
set. Individual link removal uses `delete_relationship`. Stored-layer dataset
replacement remains the separate `save_postgis_layer`; `save_layer` only edits
metadata and never changes source type or stored geometry.

Save tools advertise conservative write/destructive annotations and do not claim
idempotency across create/update. After an uncertain create response, reconcile
the record before retrying. Relationship deletion retains its idempotent hint.
The original endpoint still advertises every original create/update/delete tool.

#### Related-record reads

`read_related_records` replaces 15 related reads in the compact catalog. Supply
`request.relation` from the table below and the original key fields. Each branch
uses the original schema and handler, preserving response arrays/status
envelopes, ordering, labels, sources, effective styles, and access checks.

| Original tool | `request.relation` | Original key fields |
| --- | --- | --- |
| `get_map_layers` | `map_layers` | `map_id` |
| `get_person_articles` | `person_articles` | `person_id` |
| `get_organization_articles` | `organization_articles` | `organization_id` |
| `get_person_candidacies` | `person_candidacies` | `person_id` |
| `list_person_organizations` | `person_organizations` | `person_id` |
| `list_contests` | `election_contests` | `election_id` |
| `list_ballot_questions` | `election_ballot_questions` | `election_id` |
| `list_contest_candidates` | `contest_candidates` | `contest_id` |
| `get_contest_candidate` | `contest_candidate` | `contest_id`, `person_id` |
| `get_organization_relationships` | `organization_relationships` | `organization_id` |
| `list_calendars` | `calendars` | Optional/nullable `organization_id`; omission keeps original permitted calendar listing |
| `get_office_terms` | `office_terms` | `person_id` or `organization_id`; both accepted, at least one required |
| `list_map_layer_links` | `map_layer_links` | `map_id`; admin only |
| `list_article_people` | `article_people` | `article_id`; admin only |
| `list_article_organizations` | `article_organizations` | `article_id`; admin only |

```json
{"name":"read_related_records","arguments":{"request":{"relation":"person_articles","person_id":"<person-uuid>"}}}
```

```json
{"name":"read_related_records","arguments":{"request":{"relation":"contest_candidate","contest_id":"<contest-uuid>","person_id":"<person-uuid>"}}}
```

The singular contest_candidate selector retains its original single-candidate
envelope and missing result. It does not broaden candidate access. The
map_layers selector returns only layers permitted through the containing map;
map_layer_links remains the admin-only editable link view. Likewise public
profile reading lists remain separate selectors from admin-only article link
sets. Person/election/contest visibility gates and hidden-article discovery rules
run in the original handlers/RPCs with the caller token. Read-only annotations
do not grant permission to an admin-only selector.

Unknown selectors, cross-selector fields, invalid UUIDs and unsupported
pagination/filter fields fail validation rather than being silently discarded.
No implicit pagination, extra filters, arbitrary tables/joins, account lookup,
or geometry access are introduced. Specialized person vote/legislative history,
meeting/document reads, stored features/geometry, and the office directory
retain their existing tools and filter/pagination capabilities.

`bun run plugin:build` generates both catalogs and validates their size. The
[compact guide](../plugins/civpulse/references/compact-tools.md) and
[compact schemas](../plugins/civpulse/references/compact-tool-schemas.json) are
packaged alongside compatibility references. Common reads removed 19 definitions;
create/update and relationship consolidation removed 29 more; related reads
remove another 14, for 62 fewer tools than the compatibility endpoint. Refresh
any client that cached an earlier 109- or 80-tool v2 catalog before use. The
original endpoint retains all original related-read names and schemas.

### Meeting documents

The public archive adds `list_public_documents`, `get_public_document`,
`search_document_contents`, `publish_meeting_document`,
`link_public_document_meeting` and `withdraw_public_document`. These require
the archive migration and, for content search/publication/withdrawal, the separate
document API configured through server-only `KB_API_URL`. Publishing requires
explicit public-distribution confirmation and never follows an ordinary upload
automatically. Identical bytes deduplicate; existing publications can link to
multiple meetings. Source code and bundles include these tools, but activation
is a separate deployment. See [public-documents.md](./public-documents.md).

Use `create_event` or `update_event` with `is_meeting: true`. The same tools accept
`meeting_notes` and `meeting_transcript`; omitted fields are preserved and null
clears a nullable field. Existing database constraints prevent converting election
dates into meetings or disabling a meeting while it has child records.

`get_meeting` returns notes, transcript, attendance, votes and attachment metadata
through the existing event/calendar visibility gate. Check it before uploading.
`upload_meeting_attachment` accepts inline base64 files up to 3 MiB. For reliable,
repeatable originals up to 25 MiB use `begin_meeting_attachment_upload`, direct
Storage TUS chunks, `manage_meeting_attachment_upload` and
`finalize_meeting_attachment_upload`. See [meeting imports](meeting-imports.md)
for the full contract, authentication, source identity, checksums, conflict rules,
resumption, expiry and deliberate cleanup. JSON source projections are supported.
The legacy inline operation creates fresh records and retains uncertain uploads
for reconciliation; never blindly retry it. No operation publishes to R2.

`get_meeting_attachment_url` requires both the meeting and attachment UUIDs,
checks their relationship through `get_meeting`, then signs a 60-second download.
Files inherit event/calendar visibility; do not save expiring download URLs as
permanent source links. A signed URL can remain usable until it expires after a
visibility change. Refresh a client's cached tool catalog after deploying new
tools. `bun run mcp:test` exercises real local uploads, byte-for-byte downloads,
non-admin write denial and private-meeting download denial.

## Codex / ChatGPT plugin

The complete portable plugin source is [plugins/civpulse](../plugins/civpulse/README.md),
including OAuth MCP configuration, compatible Codex manifests, brand icon and
research, editing, mapping and user-administration skills. Build and inspect the archive with:

```sh
bun run plugin:build
```

The output is `dist/plugins/civpulse-1.2.0.zip`. No tokens or secrets are packaged.
The account package links a registered ChatGPT cloud app through `.app.json`;
direct-client MCP configuration is preserved separately in
`plugins/civpulse-mcp.json`. The registered connection handles OAuth in ChatGPT.

## Enabling it on a Supabase project

The hosted Civic Pulse project has OAuth and dynamic registration enabled, with
`https://www.civpulse.org` as its Site URL and `/oauth/consent` as its Authorization
Path. Use the following steps when configuring another project.

The deployable function lives in `supabase/functions/mcp`; tool and auth source lives in `apps/mcp`. Before agents can complete the OAuth
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
    "civicpulse": { "url": "https://api.civpulse.org/functions/v1/mcp" }
  }
}
```

Clients that only support local (stdio) servers can use `mcp-remote`:

```json
{
  "mcpServers": {
    "civicpulse": {
      "command": "bunx",
      "args": ["mcp-remote", "https://api.civpulse.org/functions/v1/mcp"]
    }
  }
}
```

## Deploying

Office history is available without a website session: use `list_offices` to
resolve the durable seat and `get_office_terms` with a person or organization
UUID to inspect actual service. Admins use `create_office`, `update_office`,
`create_office_term` and `update_office_term`; writes use the caller's OAuth
identity and existing RLS. Record election and reelection dates separately with
election/contest/candidacy tools. Service dates describe actual tenure, preserve
source URLs and day/year precision, and must not forecast a departure. Refresh
the connector's tool catalog after deploying these tools.

The Lester Miller backfill and source/date reconciliation are recorded in
[`research/lester-miller-office-history-2026-10-26.json`](./research/lester-miller-office-history-2026-10-26.json).
It records two District 4 school board terms and two mayoral terms, with four
winning election candidacies. Office terms load live through the public RPC;
new election slug pages and changed static affiliations require a site rebuild.

```bash
bun run mcp:check
bun run mcp:build
bun run mcp:deploy
```

The function uses Supabase's built-in project URL and anon key. It never reads the
service-role key. Gateway JWT verification is disabled only for this function so
OAuth discovery and the correct 401 challenge remain accessible; the function
verifies the caller's signature, issuer, audience, role, expiry and live session.
The Auth issuer remains on the original project domain after custom-domain activation.

The generated handler is committed for the Supabase GitHub integration, which
deploys declared functions on production pushes after migrations. Run
`bun run mcp:build` whenever `apps/mcp/src` changes. The MCP CI workflow checks
the generated bundle, TypeScript, routing/origin tests and plugin catalog.

The custom domain uses a DNS-only CNAME to
`drzcrodqflzkzzbqsags.supabase.co`, plus the Supabase-issued ACME TXT record.
The approved Custom Domain add-on is $10/month. The original project URL remains
available for existing website sessions and media. The legacy Cloudflare MCP
host is retained only as a 308 redirect; new clients must use the URL above.

## Testing authentication locally

`supabase/config.toml` enables the local OAuth server and dynamic registration.
With the local Supabase stack running, run:

```bash
bun run mcp:test
```

This starts the same MCP handler in a temporary Bun HTTP server on port 8789, creates disposable local users,
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

## Historical account administration release

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

## Supabase migration (October 23, 2026)

`api.civpulse.org` is active on project `drzcrodqflzkzzbqsags`, using the approved
$10/month add-on. MCP function version 3 runs all 99 current tool schemas.
The original Cloudflare `civpulse-mcp` Worker now returns only 308 redirects;
its build trigger was removed. Redirect deployment: `b8d6588f01ea494592fe33d9f5a281e0`.

ChatGPT does not expose a server-URL edit for the existing custom connection.
The replacement **Civic Pulse MCP (Supabase)** uses app
`asdk_app_6adb7102fd988191a89f556db8116075`; the user approved its OAuth consent.
Private Civic Pulse plugin **1.2.0**, release
`pluginrel_6adb71e569f081918008256e85bca90c`, binds to that connection.
Read-back confirmed the new binding, version, README endpoint and four retained skills.
Connected-host `whoami` and `search_organizations` calls succeeded through the
new Supabase connection; the identity returned the expected administrator role.
No production content was edited for testing.

The full local OAuth/CRUD suite, TypeScript check, routing/origin tests, static
Astro check/build and plugin package validation passed. Existing clients using
the old host should update the URL and reconnect; OAuth credentials are scoped
to each connection. The original Supabase project domain remains valid.

### Legislative records

`browse_legislation` reads paginated legislative resources with recursive visibility
checks; `get_person_legislative_record` returns historical member choices filtered
by session/body/category. `describe_legislative_resource`, `save_legislative_record`, and
`delete_legislative_record` cover terms,
sessions, bodies, memberships, bills, versions, amendments, actions, relationships,
sponsorships, positions, votes, choices, article links and calendar links. Writes
require admin access. `import_legislation` atomically upserts a parent-first normalized
bundle using stable source provider/ID pairs (maximum 100 entries). See
[backend.md](./backend.md#legislative-records) for identity and provenance rules.

`get_office_terms` exposes the site's existing visibility-aware office-history RPC
for person/organization IDs. Use its dated office-term UUIDs before attributing
historical legislative choices; no database inspection or name-only join is needed.

`get_georgia_legislative_source` reads the official legis.ga.gov public API. Select
`sessions`, `members`, `votes`, or `vote`; list calls accept pagination (up to 100
rows). Rosters/vote lists require a numeric `session_id` and `chamber`; detail
requires `vote_id` and can filter by numeric `member_id`. Responses retain original
codes and include source URLs/retrieval timestamps. This is read-only harvesting:
reconcile the official member and dated Civic Pulse office term before using the
existing normalized importer. Georgia's `isRollCall` flag denotes attendance and
must not be treated as a legislative vote. Missing choices remain unknown;
reported totals do not establish an outcome or a complete imported roll call.

The hosted function uses `GEORGIA_SOURCE_READER_URL`, defaulting to
`https://civpulse-georgia-source.kerryhatcher.workers.dev/`, to run the shared
adapter through Cloudflare. Direct requests from Supabase to the official Georgia
origin timed out during the public handshake, even though local Bun/Deno and
Cloudflare reads succeeded. The reader accepts only bounded, validated Georgia
resource parameters; it does not accept arbitrary URLs or perform imports.
Civic Pulse access tokens never leave the MCP function for this read. Without a
reader URL, runtime-neutral/local MCP uses the direct adapter. Direct errors name
the handshake or data stage without exposing the handshake key or source token.

If a connected host lacks a documented tool, check the deployed MCP tool list and
refresh the connection's tool discovery. Extend and deploy the supported app/MCP
API when a capability is missing; do not substitute ad-hoc database SQL for a
content operation.

### Election result workflow

`manage_election_results` is one admin-only tool with a discriminated `operation`
argument: `upload`, `view`, `read`, `import`, `read_turnout`, or `import_turnout`. This groups the workflow within the
128-tool catalog limit; the builder rejects larger catalogs. The `civic-results`
skill guides visual OCR, source identity, report deduplication and validation.
See [election results](election-results.md) for the database contract and examples.
Images are private evidence, not image-generation inputs. No OCR service is called
by the server. The agent transcribes the supplied original and saves structured
counts only after validation. The plugin package is version 1.4.0; deployment and
account plugin release are separate from local packaging.

#### Structured turnout connector refresh (issue #103)

On October 26, 2026, the connected custom app still validated the four original
actions even though production MCP function version 83 contained both structured
turnout handlers. The connection settings confirmed the expected app ID
`asdk_app_6adb7102fd988191a89f556db8116075` and compatibility endpoint
`https://api.civpulse.org/functions/v1/mcp`. Updating the plugin package alone
does not refresh that app's tool definitions.

In ChatGPT, open that connection's settings and select **Refresh tools**. Open its
plugin details → app action list and confirm `manage_election_results` now starts
with “Structured Georgia SOS JSON”. In this investigation the refreshed action
list showed the new description, but a call in the already-running Codex turn
still failed connector enum validation. After the user's next reply,
`read_turnout` succeeded through the same connected tool. No redeployment,
endpoint switch, database change, or account reauthorization was needed.
This establishes a stale connection/session contract in this reproduction;
it does not establish why the earlier user-reported rescan did not refresh it.
No held-update finding was observed in the custom connection's settings.

Retry on a new turn after refresh; if the host retains the old schema, start a
new chat with the connection enabled and verify the read before importing.
Restarting the desktop app was not needed or tested. For published MCP plugins,
inspect **MCPs → Issues → Live definition / Held update** after rescan rather
than assuming a scan made every update live. See OpenAI's
[custom connection refresh procedure](https://developers.openai.com/plugins/deploy/connect-chatgpt#refresh-metadata)
and [published MCP scan procedure](https://developers.openai.com/plugins/deploy/submission#update-to-your-mcp-server).

The authorized November 3 import then passed validation with `expected_report_id`
null and saved report `2050012c-714f-4047-bf8a-fdf09241c4cd`. Evidence was 200,879
UTF-8 bytes, SHA-256
`bf868815531d758b8a454c10da4b475abb40ed8499e04d025e06c8e6fac20d71`.
All seven readback pages were pinned to that report and matched every source row,
measure and provenance field: 159 absentee, 159 early, and 318 turnout rows across
159 counties. Exact replay returned `duplicate` with the same report ID. The
report remains unofficial; overlapping tables were not added together.
The production results page also displayed the evidence hash and source rows
for anonymous visitors and the signed-in admin, with no console errors;
anonymous pagination advanced from 100 to 200 of 636 rows.

Run `bun test scripts/tests/election-results-mcp.test.ts` to verify both legacy
and compact MCP discovery expose all six actions, match the packaged schemas,
retain strict branch inputs and defaults, and dispatch authenticated turnout
reads through the existing admin guard. These are protocol tests, not a claim
that a separate production `/mcp/v2` connection was exercised.

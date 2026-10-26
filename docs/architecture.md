# Architecture

Civic Pulse is a Bun workspace monorepo with a static Astro frontend and a
Supabase backend.

```
apps/web/     Astro frontend, built to static files
apps/mcp/     Runtime-neutral MCP source (OIDC via Supabase Auth)
apps/kb/      Separate public document publication/search Worker (initially disabled)
supabase/     Postgres migrations, MCP Edge Function + local Supabase config
scripts/      dev orchestration and local seed helpers
docs/         architecture, backend, and development notes
```

## Hosting and rendering

- `apps/web/public/llms.txt` is the curated AI-facing site overview, served at
  `/llms.txt` as a static text asset. It follows the [llms.txt format](https://llmstxt.org/)
  with public entry points, source/reuse guidance, and the AI connection guide.
  Keep its links and descriptions aligned with public routes when features change;
  it contains no database export or restricted record URLs.
- The frontend deploys as **Cloudflare Workers static assets**
  (`apps/web/wrangler.jsonc`, `assets.directory = ./dist`). It is a **static
  build**: `output` stays the Astro default (`static`) and there is **no
  server adapter**. Do not add `@astrojs/cloudflare`/SSR without deciding that
  the hosting model is changing first.
- Every page is prerendered at build time. Things that change at runtime are
  rendered in the browser with vanilla TypeScript from `apps/web/src/scripts/`
  (`@supabase/supabase-js` + the public anon key).
- Consequences to keep in mind:
  - **Admin edits are live in Postgres but not on the static site until the next
    build/deploy.** Prerendered pages are snapshots.
  - Content that must not appear in a static file (private maps/layers) is
    fetched client-side through a Supabase RPC, never embedded in HTML.
  - Build-time data (public orgs/maps) is fetched with `getBuildSupabase()`;
    browser data uses `getSupabase()`.
  - `public/_redirects` only takes effect when served by Cloudflare. The Astro
    dev server and `astro preview` ignore it. If a link must work in dev, do not
    rely on `_redirects` (see `/maps/view/?id=<uuid>` below).

## Backend

### Profile build requests

People and organization profiles share one in-flight public profile snapshot per
production build. People, organizations and affiliations load in three parallel
streams, each fetching stable, ordered pages of 500 rows sequentially. Profiles
join the snapshot in memory instead of sending requests for each person or
organization. The anon client and explicit public-person filter remain in use;
unlisted/private people never enter the snapshot. A configured backend failure
fails the build instead of publishing profiles with missing affiliations. Dev
requests reload the snapshot so edits remain visible.

### Production transport and capacity

Cloudflare's zone-level `always_use_https` setting is enabled for `civpulse.org`
(October 26, 2026). HTTP URLs redirect to the same HTTPS hostname, path and query
before reaching static assets or Workers. This is managed Cloudflare state, not
an Astro redirect; local development continues to use HTTP. Verify with
`curl -I 'http://www.civpulse.org/people/?q=test'` and follow the redirect to check
the HTTPS response.

The minimum edge TLS version is 1.2; TLS 1.3 remains enabled. R2 custom domains
also require TLS 1.2 (including the previously older overrides on
`data.civpulse.org` and `cdn-dev.civpulse.org`). Cloudflare sends
`Strict-Transport-Security: max-age=2592000` on HTTPS responses, including static
assets and R2. The policy applies to each responding hostname: `includeSubDomains`
and preload remain off because the zone includes external mail-tracking hosts
and wildcard routes. Do not enable either without checking every affected host.
The unproxied Supabase `api.civpulse.org` endpoint manages its own TLS/HSTS.
These settings do not require a paid Cloudflare plan. Check TLS 1.2/1.3 access,
rejection of TLS 1.0/1.1, HTTP redirects and the HSTS header after changes.

The hosted CivicPulse database was resized from Nano to Micro on October 26,
2026: memory increases from 0.5 GB to 1 GB at the same $0.01344/hour rate. Resizing
restarts the project; verify project health and a public Data API query afterward.

### Runtime short-link exception

The web Worker now has a small `apps/web/worker/index.ts` entrypoint for `/l/*`.
`assets.run_worker_first` reserves that prefix; other routes remain static assets
and missing assets fall back through `env.ASSETS.fetch`. Astro remains static,
without a server adapter or on-demand page rendering. This is an explicit
request-time redirect handler alongside the prerendered site.

The handler calls Supabase `resolve_short_link` using only the public key, then
returns an HTTP 302 with `Cache-Control: no-store` and `X-Robots-Tag: noindex,
nofollow`. Destination edits and visit counts are live and do not require a
rebuild. Unknown/paused links return 404, unsupported methods 405, and backend
failures 503. HEAD resolves without counting; GET resolves and increments
atomically before returning the redirect. Incoming query parameters are not
forwarded; put any destination query parameters in the saved destination URL.
The Worker does not fetch destination pages.

Public Supabase bindings live in `apps/web/wrangler.jsonc`; they must match the
frontend's build-time public project settings. Local `.dev.vars` overrides must
point at the same local project used by the frontend. Neither requires a
service-role key. QR codes encode the canonical Astro `site` origin
(`https://www.civpulse.org`), including when viewed locally.

- Supabase Postgres with Row Level Security; Supabase Auth for email/password
  accounts; a `public.profiles` row per user created by a signup trigger.
- `public.admins` is an allowlist (managed by existing admins through the Users
  page, or by the service role for initial setup). RLS uses `public.is_admin()`.
- Admin pages are client-rendered shells; the header/session is checked in the
  browser, but **RLS is the real enforcement**.
- Full-text search uses stored generated `tsvector` columns + GIN indexes and
  `security definer` RPCs (`search_maps`, `search_organizations`,
  `search_events`, `search_people`, `search_elections`). The `/search/` page uses
  `search_site` for all civic content types and their permitted relationships,
  applying visibility before matching or ranking.

See [backend.md](./backend.md) for schema, RLS, visibility, and search details.

## Visibility model

Maps, layers, calendars, and events all have `public | unlisted | private`:

| Value | Meaning |
| --- | --- |
| `public` | Listed, included in sitemap, appears for everyone |
| `unlisted` | Reachable by uuid URL only; hidden from anonymous listings/search; admins can find it |
| `private` | Requires an admin |

- Maps: public pages are `/maps/<slug>/` (prerendered); unlisted/private are
  served by the `/maps/view/` shell with `?id=<uuid>` and gated by the
  `get_map` RPC. Pretty `/maps/u/<uuid>/` and `/maps/p/<uuid>/` paths are
  rewritten to that shell **only when served by Cloudflare**.
- Layers: each layer has its own visibility. `get_map_layers(map_id)` returns
  only the layers the caller may see, so a private layer on a public map is
  silently omitted for anonymous visitors.
- Calendars and events: each calendar belongs to one organization (an
  organization can have many) and each event belongs to one calendar. An event
  is only visible when both it and its calendar are visible. `/calendar/` browses
  and filters events by organization/calendar through `search_events`; unlisted
  and private events use the `/calendar/view/?id=<uuid>` shell gated by
  `get_event`.
- Meetings are calendar events marked `is_meeting`. Admins add notes, transcripts,
  attendance, votes, and attachments at `/admin/meetings/`. The event viewer
  loads these records through `get_meeting`; private meeting files are served
  through short-lived signed URLs from a private Supabase Storage bucket.
- People: records for officials, elected office holders, and candidates, linked
  to organizations with a role. Public pages are `/people/<slug>/` (prerendered)
  and `/people/` browses/search through `search_people`; unlisted/private people
  use the `/people/view/?id=<uuid>` shell gated by `get_person`. Affiliations are
  readable through the Data API only for public people, so hidden people never
  leak their organization links into prerendered HTML.
- Elections: an election on a date, with contests for the offices being elected
  and the people running. Public pages are `/elections/<slug>/` (prerendered)
  and `/elections/` browses/search through `search_elections`; unlisted/private
  elections use the `/elections/view/?id=<uuid>` shell gated by `get_election`.
  Contests, candidates, and key dates are only readable through `get_election`,
  so hidden elections never leak into prerendered HTML. Early-voting days and
  deadlines are calendar events tagged with the election, so they appear on the
  community calendar and link back to the election.
  Store contests for the same election together, including races outside Bibb
  County. The static detail page and UUID viewer default to a Bibb County display
  filter, with an all-recorded-races option. Search, person candidacies, admin
  editing, and `get_election` retain every visibility-permitted contest. A direct
  contest/question anchor reveals an out-of-area race. The frontend geographic
  policy in `election-scope.ts` uses the 2026 Macon-Bibb composite ballot's district
  list; review it when district boundaries change. This is presentation, not RLS.
- Articles: external URLs with titles and many-to-many links to people and
  organizations. Runtime “News & articles” lists on profiles distinguish subjects,
  authors, publishers, and mentions. Hidden associations never enter static HTML;
  writes use the admin-only `save_article` transaction.
- The public listing/sitemap includes public content only; sitemap generation is
  handled by `@astrojs/sitemap` with a filter for admin/auth/viewer routes.

## Auth and admin

- `/admin/publish/` requests a manual production rebuild through the `publish`
  Supabase Edge Function. Every request verifies the user's token with Auth and
  checks `public.is_admin()` using that token. The function calls a secret
  Cloudflare Workers Builds Deploy Hook for `civpulse-web-new` on `main`;
  Cloudflare runs the existing migration checks, build, and deploy commands.
  Build status is read from Cloudflare using a server-only Workers CI Read token.
  Only selected status fields are returned, never build environment variables,
  raw logs, credentials, or the hook URL. No service-role key or new tables are
  needed. See [development.md](./development.md#manual-publishing-setup).

- Auth pages: `/signin/`, `/signup/`, `/account/` (client-side forms).
- Admin: `/admin/organizations/`, `/admin/people/`, `/admin/layers/`,
  `/admin/maps/`, `/admin/offices/`, `/admin/calendars/`, `/admin/elections/`, `/admin/articles/` with an admin tab
  bar. Admins also get an "Edit" shortcut on public org/map/person/election
  pages.
- The header shows "Account" when signed in and "Admin" for allowlisted users.

## MCP server

`apps/mcp` provides the tool/auth source for the Supabase `mcp` Edge Function,
bundled into `supabase/functions/mcp/handler.js`. It exposes a remote Model Context
Protocol server at `https://api.civpulse.org/functions/v1/mcp`. AI agents authenticate to it
with **OpenID Connect / OAuth 2.1** through the Supabase Auth OAuth 2.1 server
(a consent page lives on the static site at `/oauth/consent/`). Each tool call
forwards the user's access token to Supabase, so RLS applies exactly as it does
in the web app — reads follow visibility and writes require an admin. The function
never uses the service-role key. See [mcp.md](./mcp.md).

## Profile media

Public meeting documents use a separate R2 publication archive and runtime search
Worker, described in [public-documents.md](./public-documents.md). The archive is
disabled until explicitly configured. It does not change the static Astro
hosting model or automatically copy private meeting attachments.

`apps/media` is a separate Cloudflare Worker at `media.civpulse.org`, bound to
R2 bucket `civpulse-media` in the Kerry Personal account. The Astro site remains
entirely static. Admin organization/person forms upload to this Worker, then save
the returned absolute URL in `logo_path` / `image_path` under existing RLS.
Legacy relative paths still resolve to Supabase Storage.

Uploads require a Supabase-verified user token and `is_admin()` on every request.
Only PNG, JPEG, and WebP up to 2 MB are accepted; the Worker checks file signatures
and actual body size. SVG uploads are excluded. Browser uploads allow only
`new.civpulse.org` and `www.civpulse.org`. Objects are public, including images
attached to hidden people; do not upload confidential images.

Object names are immutable UUIDs. Replacing/deleting a record does not delete its
old image, because a previous static build may still reference it. Failed saves
can also leave unreferenced uploads. Cleanup is a future maintenance task, after
checking references in both the database and deployed builds.

## Account roles and registration

Anyone can register at `/signup/` with an email, password (at least 8 characters), and optional name. When email confirmation is enabled in Supabase, the confirmation returns to `/account/`; allow that URL in Auth redirect settings. New accounts have the `user` role, with the same civic content access as anonymous visitors. Unlisted UUID links remain accessible to both; discovery of unlisted content and all private content require an admin. Saved preferences are planned, not implemented.

`public.admins` remains the only source of admin authority; user-editable metadata never grants roles. Admins use `/admin/users/` to search registered accounts and promote another user. The `admin_list_users` and `promote_user_to_admin` RPCs check `is_admin()` on every call, use an empty search path, and expose no service key. Promotion is immediate without a token refresh. Account profiles are readable only by their owner or admins.

Verify with `ACCOUNTS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/accounts-db.test.ts`. Fixtures roll back.

## Records request tracking

`/requests/`, `/requests/view/?id=<uuid>` and `/admin/requests/` are static Astro
shells with browser RPC data. This follows the runtime calendar pattern: saved
request content is live without a rebuild, while new frontend code requires a
deploy. Organization profiles link to a filtered request directory; the Account
page links to managed requests. Viewer routes are excluded from the sitemap.
No request identity, private file metadata or ownership history enters HTML at
build time. Creation is admin-only; owners and admins manage existing requests.

## Legislative records

`/legislation/`, its session directory, bill/session/vote UUID viewers, and
`/admin/legislation/` are static Astro shells. Browser RPCs fetch legislative data,
so saved records appear immediately without embedding hidden content in HTML.
UUID viewer routes are excluded from the sitemap. Person profiles load historical
votes and sponsorships alongside office terms. Existing local meeting/attendance
records remain independent. See [backend.md](./backend.md#legislative-records).

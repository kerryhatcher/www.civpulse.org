# Architecture

Civic Pulse is a Bun workspace monorepo with a static Astro frontend and a
Supabase backend.

```
apps/web/     Astro frontend, built to static files
apps/mcp/     Cloudflare Worker: remote MCP server (OIDC via Supabase Auth)
supabase/     Postgres migrations + local Supabase config
scripts/      dev orchestration and local seed helpers
docs/         architecture, backend, and development notes
```

## Hosting and rendering

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

- Supabase Postgres with Row Level Security; Supabase Auth for email/password
  accounts; a `public.profiles` row per user created by a signup trigger.
- `public.admins` is an allowlist (managed with the service role, e.g. by the
  local seed script) and `public.is_admin()` is used by RLS policies.
- Admin pages are client-rendered shells; the header/session is checked in the
  browser, but **RLS is the real enforcement**.
- Full-text search uses stored generated `tsvector` columns + GIN indexes and
  `security definer` RPCs (`search_maps`, `search_organizations`,
  `search_events`, `search_people`, `search_elections`).

See [backend.md](./backend.md) for schema, RLS, visibility, and search details.

## Visibility model

Maps, layers, calendars, and events all have `public | unlisted | private`:

| Value | Meaning |
| --- | --- |
| `public` | Listed, included in sitemap, appears for everyone |
| `unlisted` | Reachable by uuid URL only; hidden from anonymous listings/search; signed-in users can find it |
| `private` | Requires a signed-in user |

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
- Articles: external URLs with titles and many-to-many links to people and
  organizations. Runtime “News & articles” lists on profiles distinguish subjects,
  authors, publishers, and mentions. Hidden associations never enter static HTML;
  writes use the admin-only `save_article` transaction.
- The public listing/sitemap includes public content only; sitemap generation is
  handled by `@astrojs/sitemap` with a filter for admin/auth/viewer routes.

## Auth and admin

- Auth pages: `/signin/`, `/signup/`, `/account/` (client-side forms).
- Admin: `/admin/organizations/`, `/admin/people/`, `/admin/layers/`,
  `/admin/maps/`, `/admin/calendars/`, `/admin/elections/`, `/admin/articles/` with an admin tab
  bar. Admins also get an "Edit" shortcut on public org/map/person/election
  pages.
- The header shows "Account" when signed in and "Admin" for allowlisted users.

## MCP server

`apps/mcp` is a separate Cloudflare Worker that exposes a remote Model Context
Protocol server at `https://mcp.civpulse.org/mcp`. AI agents authenticate to it
with **OpenID Connect / OAuth 2.1** through the Supabase Auth OAuth 2.1 server
(a consent page lives on the static site at `/oauth/consent/`). Each tool call
forwards the user's access token to Supabase, so RLS applies exactly as it does
in the web app — reads follow visibility and writes require an admin. The Worker
never uses the service-role key. See [mcp.md](./mcp.md).

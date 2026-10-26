# Supabase backend

The backend lives in [`supabase/`](../supabase): Postgres migrations, Auth
configuration, and local development settings. The frontend uses
`@supabase/supabase-js` with the public anon key from `apps/web/src/lib/supabase.ts`.

## Local development

Requirements: Docker (or Podman) and the Supabase CLI (installed via Bun/npx).

`bun run dev` starts the frontend and backend together: it runs `supabase start`
if the stack isn't already up, then launches the Astro dev server in the
foreground. The backend is left running when the dev server exits. To have it
stopped automatically, set `CIVICPULSE_STOP_BACKEND=1`.

Backend-only commands:

```bash
bun run db:start     # start local Postgres, Auth, Studio, and the Data API
bun run db:status    # print local URLs and keys
bun run db:seed-user # create/confirm the local test user
bun run db:migrate   # apply pending migrations (keeps local data)
bun run db:reset     # re-apply migrations + seed (wipes local data)
bun run db:stop      # stop the stack
```

## Test user

`bun run db:seed-user` creates or updates a known local account. The seed uses the
local Auth admin API to confirm this development account, so it works immediately:

| Field | Value |
| --- | --- |
| Email | `test@civpulse.org` |
| Password | `civicpulse-test-123` |
| Name | `Test User` |
| Admin | yes (added to `public.admins`) |

Override via `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, and `TEST_USER_NAME`.
Never run this against a hosted project.

Copy the local API URL and anon key from `db:status` into `apps/web/.env`:

```bash
cp apps/web/.env.example apps/web/.env
# PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Studio runs at <http://127.0.0.1:54323>. Public registrations require email confirmation; inspect confirmation mail at
<http://127.0.0.1:54324>. The seeded admin is already confirmed.

The orchestration lives in [`scripts/dev.mjs`](../scripts/dev.mjs). It forces the
Astro server into the foreground (`ASTRO_DEV_BACKGROUND=1`) so its lifetime is
tied to the wrapper's.

## Schema

Organization-to-organization links live in `organization_relationships`. Each row
has two organization foreign keys, a `relationship` label for the first profile,
a `reverse_relationship` label for the second, and an optional HTTP(S) source URL.
One row appears on both profiles. A unique unordered-pair index rejects reverse
duplicates; self-links and dangling organization IDs are rejected. Deleting an
organization cascades only its relationship rows, preserving related organizations.

Relationships are publicly readable, matching organizations. Only `is_admin()`
users may insert, update or delete them. `get_organization_relationships(uuid)`
is a security-invoker RPC returning labels and target names/slugs from the requested
profile's perspective. The organization admin editor and MCP relationship tools
use the same table and policies. Static organization profiles render links at build
time; editing a relationship requires a web rebuild to publish it.

Verify permissions, reciprocal labels, uniqueness, foreign keys and cleanup with
`ORGANIZATION_RELATIONSHIPS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/organization-relationships-db.test.ts`.
Fixtures roll back. The append-only migration seeds 19 source-backed relationships
by existing slugs; empty development databases skip absent endpoints.

Migrations are append-only files in `supabase/migrations/`.

`profiles`:

- `public.profiles` — one row per `auth.users` user (`id`, `display_name`,
  timestamps).
- `on_auth_user_created` — a trigger that inserts a profile when a user signs up.
- `profiles_set_updated_at` — keeps `updated_at` server-controlled.

`organizations`:

- `public.admins` — allowlist of users allowed to manage organizations.
- `public.is_admin()` — `security definer` helper used by RLS policies.
- `public.organizations` — `slug`, `name`, `description`, `email`, `phone`,
  `address_line`, `website_url`, `social_url`, `logo_path`, timestamps.
- `org-logos` storage bucket — public read, 2 MB limit, images only.
- `public.maps` — `slug`, `name`, `description`, `base_map`, `visibility`,
  `organization_id` (optional, unique → 1:1 with an organization), timestamps.
- `public.layers` — first-class reusable map layers: `name`, `description`,
  `source_type` (`geojson` or `postgis`), nullable `source_url`, `visibility`,
  `style` (the default style), timestamps.
- `public.map_layers` — ordered many-to-many join between maps and layers
  (`map_id`, `layer_id`, `position`, `style`); a layer can be on many maps and a
  map can have many layers. `map_layers.style` is an optional per-map override.
- `public.calendars` — `organization_id` (required, so a calendar belongs to one
  organization and an organization can have many), `slug`, `name`,
  `description`, `visibility`, timestamps.
- `public.events` — `calendar_id` (required), `title`, `description`,
  `starts_at` (required), `ends_at`, `all_day`, `location`, `url`,
  `visibility`, `election_id` (optional), `election_date_kind` (set when the
  event is an election key date), timestamps. Both calendars and events carry
  visibility.
- `public.elections` — `slug`, `name`, `election_date` (required), `kind`,
  `description`, `organization_id` (optional administering body), `visibility`,
  timestamps.
- `public.contests` — a race within an election: `election_id` (required),
  `office`, `district`, `seat`, `description`, `partisan`, `position`,
  timestamps.
- `public.contest_candidates` — links a person to a contest with `party` and
  `status` (running, withdrawn, won, lost, runoff, pending), `is_write_in`
  (certified write-in whose name is not printed on the ballot); one entry per
  contest/person pair, both sides cascade.
- `public.people` — CRM-style records for officials, elected office holders,
  candidates, and other civic figures: `slug`, `full_name`, `kind`, `title`,
  `description`, contact fields (`email`, `phone`, `fax`, `website_url`,
  `social_url`, structured mailing address), `image_path`, `visibility`,
  timestamps.
- `public.person_organizations` — links a person to an organization with a
  `role` (member, owner, officer, CEO, employee, …); one role per person/org
  pair, both sides cascade on delete.

Other content tables are intentionally not defined yet. They will be added as
separate migrations once their shape is settled.

## Maps admin

- Admin UI: `/admin/maps/` and `/admin/layers/`.
- A map is an OSM base map plus zero or more reusable layers.
- Layers are managed separately (`/admin/layers/`) and picked with checkboxes on
  the map form. Selected layers are listed first and can be **dragged by the
  handle** to set their stacking order; `map_layers.position` preserves it, so
  later layers render on top.
- Base maps: OpenStreetMap Standard, OpenStreetMap Humanitarian, and
  OpenTopoMap (OSM data). Attribution is rendered by Leaflet.
- The page previews the selected base map and overlays with Leaflet. Remote
  GeoJSON must allow CORS; failed layers are reported without blocking the save.
- A map can optionally be assigned to one organization (1:1). `organization_id`
  is unique, so the database rejects a second map for the same organization.
- Public map pages link to their organization; a public organization page links
  to its map when that map is public.
- Admins viewing a map page (public or `/maps/view/`) see an “Edit map” button
  that deep-links to `/admin/maps/?edit=<id>` with the form prefilled.

### Layer rendering

Each layer has its own visibility. When a map is viewed, only the layers the
caller may see are added:

- `public` and `unlisted` layers render for everyone.
- `private` layers render only for admins.

So a public map with a private layer shows that layer to admins and
silently omits it for everyone else. `public.get_map_layers(map_id)` is a
`security definer` RPC that applies both the layer visibility and the map's own
visibility (an anonymous caller cannot read layers of a private map). The
viewer fetches layers through this RPC, so private layer URLs never reach the
prerendered HTML.

### Stored PostGIS layers

The Layers admin can create a **Stored in PostGIS** layer from a GeoJSON file
or a URL. Imports accept a FeatureCollection, a single Feature, or a bare
geometry: Point, LineString, Polygon, and their Multi variants. Coordinates
must be WGS84 longitude/latitude; invalid, empty, null, and collection geometries
are rejected. Altitudes are dropped. Feature properties and IDs are preserved.
The import limit is 10 MB and 10,000 features. URL imports run in the browser
and require CORS; they are snapshots, not periodic synchronization.

`layer_features` holds `geometry(Geometry, 4326)` with a GiST spatial index,
JSON properties, source feature ID, and source order. Its RLS permits only admins
to read/write directly. `save_postgis_layer` requires an admin and saves metadata
and a replacement dataset atomically, leaving existing data intact on failure.
When editing, leave file and URL blank to keep the dataset; selecting data
replaces all features on save. A layer's type is fixed in the editor after creation.

`get_layer_geojson(layer_id, map_id)` returns a FeatureCollection at runtime.
Non-admin callers must supply a map containing the layer and pass both map and
layer visibility checks through `get_map_layers`. Admins may omit the map ID for
previews and property discovery. Stored data never enters prerendered HTML.
Existing URL layers, per-map styles, and per-record colors continue to work.

Run `supabase/tests/postgis_layers.sql` with `psql` against a migrated local
Supabase database. It tests all six geometry types, failed import rollback,
replacement, metadata-only edits, and anonymous/non-admin access, and rolls back
its fixtures.

### Layer styling

Every layer has a **default style** (`layers.style`) stored as a JSON object of
Leaflet options: `color`, `weight`, `opacity`, `fillColor`, `fillOpacity`,
`dashArray`, and `radius` (circle markers). An empty object falls back to the
app default in `apps/web/src/lib/layers.ts` (`DEFAULT_LAYER_STYLE`).

A layer can also color **each record** differently instead of using one uniform
style. When `categorizeBy` names a feature property, each distinct property
value gets a color from `palette` (a sorted, stable mapping that cycles when
there are more values than colors). This is what gives voting precincts or
commission districts their multi-color look. The admin’s **Color by property**
dropdown is populated by loading the layer’s URL or stored data and inspecting
its GeoJSON feature properties, so it only offers fields that actually exist.

A map can override the style of any layer it includes without affecting other
maps. The override lives in `map_layers.style`; `null` inherits the layer
default. `get_map_layers` returns `coalesce(map_layers.style, layers.style)` as
the effective style, so the public viewer renders the map-specific styling
without needing access to the raw join table.

- Admin UI: the layer form (`/admin/layers/`) edits the default style; the map
  form (`/admin/maps/`) has a per-layer “Override the layer default” editor that
  is stored on that map only. Both use
  `apps/web/src/lib/layer-style-editor.ts` for the controls and live preview.
- The map admin preview and the public viewer both resolve styles through
  `resolveLayerStyle(layer.style, override)`.

### Visibility

| Visibility | Page | Listed | Sitemap | Search | Access |
| --- | --- | --- | --- | --- | --- |
| `public` | `/maps/<slug>/` (prerendered) | yes | yes | anon + signed-in | anyone |
| `unlisted` | `/maps/view/?id=<uuid>` | no | no | admins only | anyone with the uuid |
| `private` | `/maps/view/?id=<uuid>` | no | no | admins only | admins |

- `/maps/view/` is the shared shell; it reads the uuid from `?id=` (or from a
  `/maps/u/<uuid>/` / `/maps/p/<uuid>/` path) and calls the
  `public.get_map(uuid)` RPC. App links use the query form so they work under
  the Astro dev server and `astro preview`; those pretty paths are also
  rewritten to the shell by `public/_redirects` when served by Cloudflare.
- RLS: public rows are readable by anyone, private rows by any authenticated
  user, unlisted rows are not readable through the Data API at all (only through
  the RPC). Admins can read every row.
- `/maps/` shows the build-time public list to anonymous visitors. Signed-in
  users get the full set they can access (public + unlisted + private) with
  visibility badges and correct links; the list swaps to ranked full-text search
  results as you type and restores on clear.
- `@astrojs/sitemap` writes `sitemap-index.xml`; `public/robots.txt` references
  it. Admin, account, auth, viewer, and 404 routes are excluded.

### Site-wide search

The main navigation links to `/search/`, a static shell that fetches results live
through `public.search_site(p_query, p_type, p_limit, p_offset)`. It covers people,
organizations, elections, races, ballot questions, articles, maps, layers,
calendars, and events (including past events). Type filters, pagination, and
queries are shareable URL parameters. Results link to profiles, election
sections, calendars, maps, or the original article URL.

Stored generated `site_search_document` columns have GIN indexes. Search combines
English full-text ranking with literal substring matching for partial names,
contact details, and URLs. Related names and metadata are searchable: candidates
and parties on races, ballot wording on elections, affiliations on people and
organizations, and authors/subjects/publishers on articles. These joins filter
access before matching or ranking. Existing people, organization, map, and
election directory searches reuse the same search implementation. Empty election
browsing preserves upcoming-nearest-first, then past-newest-first order.

Anonymous and regular-user discovery includes public records only; admin discovery includes
unlisted and private records. Events also
inherit calendar and election gates. Election details omit hidden candidate
profiles for anonymous callers. RPCs apply these checks with an empty search path;
no private result data is embedded in prerendered HTML. Authentication changes
clear and refetch results. Accounts, auth profiles, and admin allowlists are
excluded from civic content search.

PostGIS feature properties are searchable through their layer when it belongs to
an accessible map; admins can also search orphan layer properties. Remote GeoJSON
contents are not crawled: only stored layer metadata and source URLs are searched.
Queries are limited to 500 characters; each RPC page is capped at 100 results.

Run `supabase/tests/site_search.sql` against local Supabase for rollback-only
anonymous, ordinary-member, and admin access regression checks.

### Map search

Follows the Supabase full-text search guide:

- `maps.search_document` is a stored `tsvector` generated from `name` (weight A)
  and `description` (weight B), with a GIN index.
- `public.search_maps(p_query text, p_limit int)` builds a query with
  `websearch_to_tsquery` (so `"quoted phrases"`, `or`, and `-negation` work) and
  ranks with `ts_rank`.
- Anonymous callers only match `public` maps; admin callers also match
  `unlisted` and `private` maps. Unlisted maps stay unreachable through the Data
  API because the function is `security definer` and applies the filter itself.
- The `/maps/` search box debounces input, calls the RPC, and links each result
  to the right URL (slug for public, uuid for unlisted/private).

## Calendars and events

- Admin UI: `/admin/calendars/` (requires an admin account). One page manages
  both **calendars** and **events**.
- A calendar belongs to exactly one organization, and an organization can have
  many calendars (unlike maps, which are 1:1 with an organization). Deleting an
  organization or a calendar cascades to its calendars/events.
- An event belongs to one calendar and has a start (required), an optional end,
  an all-day flag, a location, an external link, and its own visibility.
- Public browse: `/calendar/` lists upcoming events and filters by organization
  and/or calendar, with a full-text search box and an “include past events”
  toggle. Results are fetched with the RPCs below, so hidden rows are never
  embedded in prerendered HTML and the list stays current.
- The shared viewer is `/calendar/view/`, which reads a uuid from `?id=` (or a
  `/calendar/e/<uuid>/` path rewritten by `public/_redirects` on Cloudflare) and
  calls `public.get_event(uuid)`. Admins see an “Edit event” button that
  deep-links to `/admin/calendars/?editEvent=<id>`.

### Meeting records

An event marked `is_meeting` can hold `meeting_notes` and `meeting_transcript`.
`meeting_attendance` links existing people to the meeting as present, absent, or
excused. `meeting_votes` stores each motion and its outcome;
`meeting_vote_choices` records each present person's yes, no, abstain, or
recused choice. Changing an attendee to absent or excused clears their choices.
All four meeting child tables have admin-only Data API access under RLS.
`get_meeting(uuid)` applies the event and calendar visibility rules before
returning the public record, and omits hidden people for non-admin callers.

Meeting files live in the private `meeting-attachments` Storage bucket. Admins
can upload PDF, Office, OpenDocument, text, and CSV files up to 25 MB. The
`meeting_attachments` table holds file metadata and paths; a Storage SELECT
policy checks the parent meeting's visibility before allowing a signed download
URL. Object paths are immutable UUID names beneath the meeting ID. Removing an
attachment deletes its object and metadata. Deleting a meeting cascades metadata,
but may leave its Storage objects for later cleanup.

### Calendar/event visibility

The explicit public document archive adds a separate catalog, deduplicated files
and many-to-many meeting links. All catalog tables have RLS and revoked direct
Data API access; publication RPCs check `is_admin()`. Public projections omit
pending/withdrawn documents and hidden meeting relationships. Catalog and link
changes participate in civic audit history. Publication does not inherit future
meeting visibility changes. See [public-documents.md](./public-documents.md).

Calendars and events each have `public | unlisted | private`, the same rules as
maps and layers. An event is only visible when **both** it and its owning
calendar are visible, so a public event on a private calendar stays private.

| Visibility | Listed | Search | Access |
| --- | --- | --- | --- |
| `public` | yes | anon + signed-in | anyone |
| `unlisted` | no (uuid URL only) | admins only | anyone with the uuid |
| `private` | no | admins only | admins |

- `public.events` has **no** anonymous/authenticated select policy: because the
  rule depends on the owning calendar, all reads go through `security definer`
  RPCs. Regular accounts can read public calendars directly. Admins can
  read both tables, including hidden rows, directly for the admin UI.
- `public.list_calendars(p_organization_id uuid)` returns the calendars the
  caller may see, with their organization, for the filter menus.
- `public.search_events(p_query, p_organization_id, p_calendar_id, p_include_past, p_limit)`
  joins events → calendars → organizations, applies both visibility rules and
  the org/calendar filters, and ranks matches with `websearch_to_tsquery` +
  `ts_rank`. Past events are excluded unless `p_include_past` is true.
- `public.get_event(uuid)` returns `{status: ok|private|missing, event,
  calendar, organization}` for the viewer, applying the same gate.
- `events.search_document` is a stored `tsvector` (title weight A, description
  weight B, location weight C) with a GIN index.

## People

- Admin UI: `/admin/people/` (requires an admin account). One page manages both
  **people** and their **organization affiliations**.
- Public directory: `/people/`; each public person gets `/people/<slug>/`. The
  organization page lists its public affiliated people with their roles.
- A person is an official/elected/candidate record with an optional title, bio,
  contact details (email, phone, fax, website, social, structured mailing
  address), and an optional profile image uploaded to the `person-images`
  bucket.
- Affiliations link a person to an organization with a free-text role. A person
  has at most one role per organization; the admin form upserts on the pair.

### People visibility

People use the same `public | unlisted | private` rules as maps, layers, and
events.

| Visibility | Page | Listed | Sitemap | Search | Access |
| --- | --- | --- | --- | --- | --- |
| `public` | `/people/<slug>/` (prerendered) | yes | yes | anon + signed-in | anyone |
| `unlisted` | `/people/view/?id=<uuid>` | no | no | admins only | anyone with the uuid |
| `private` | `/people/view/?id=<uuid>` | no | no | admins only | admins |

- RLS: public people are readable by anyone, private people by
  admins, unlisted people are not readable through the Data API at
  all (only through the RPC). Admins can read every row.
- `person_organizations` has no blanket public read: a select policy exposes
  affiliations only when the linked person is public (and, for authenticated
  callers, private), so unlisted/private organization links never reach the Data
  API. All reads for hidden people go through `get_person`.
- `/people/view/` reads the uuid from `?id=` (or `/people/u/<uuid>/` /
  `/people/p/<uuid>/` paths rewritten by `public/_redirects` on Cloudflare) and
  calls `public.get_person(uuid)`. Admins see an “Edit person” button that
  deep-links to `/admin/people/?edit=<id>`.

### People search

- `people.search_document` is a stored `tsvector` generated from `full_name`
  (weight A), `title` (weight B), and `description` (weight C), with a GIN
  index.
- `public.search_people(p_query text, p_limit int)` uses `websearch_to_tsquery`
  + `ts_rank`. Anonymous callers only match `public` people; admin callers
  also match `unlisted` and `private` people. Unlisted people stay unreachable
  through the Data API because the function is `security definer` and applies
  the filter itself.
- The `/people/` page shows the build-time public list to anonymous visitors,
  swaps to `search_people` results as you type, and (when signed in as an admin) lists the
  full set of people the caller can access with visibility badges.

## Elections

Candidate profile images are optional (`people.image_path` may be null). Admins
can upload a replacement or use **Remove image**, then save the person. Removing
an image clears the profile reference; it does not delete the public object,
because an earlier static build may still use it. Profiles without an image show
initials. Public profile pages need a rebuild after image changes.
Photos also appear in the people directory and its search results, organization
people lists, public/shared election candidate lists, site-wide person search
results, and admin people/candidate lists. Site-wide search loads each optional
photo through `get_person`, preserving the person's visibility gate; text results
remain available while photos load.

The November 2026 candidate photo research is recorded in
`docs/research/2026-11-03-candidate-photos.json`, including government/campaign
source pages, exact asset URLs, stored copies, and unresolved candidates. The
photo data migration fills missing references only and preserves existing images.

- Admin UI: `/admin/elections/` (requires an admin account). One page manages
  **elections**, their **contests**, and the **candidates** running in each.
- Public directory: `/elections/` (searches through `search_elections`); each
  public election gets a prerendered `/elections/<slug>/` page listing its key
  dates and the contests on the ballot.
- An election is organized by the date of the actual election and has a `kind`
  (special, general/primary, and their runoffs). It may be administered by one
  organization.
- A contest is a race for an office (`office`, `district`, `seat`) and holds
  candidates. Candidates reuse the `people` records: the person holds the
  profile, `contest_candidates` holds the race-specific party and status.

### Election key dates

- Early-voting days and deadlines (registration, mail-ballot request/return,
  election day itself) are **calendar events** tagged with `election_id` and an
  `election_date_kind`. They are created and edited from
  `/admin/calendars/` (the event form has an "Election key date" selector), so
  every date is also on the community calendar and the event viewer links back
  to its election.
- An event linked to an election is only visible when the event, its calendar,
  **and** its election are all visible — the same dependency rule as
  event-on-calendar. `search_events` and `get_event` apply the election gate.

### Elections visibility

Elections use the same `public | unlisted | private` rules as maps, layers,
calendars, events, and people. Contests and candidates inherit the election's
visibility, so they have no separate visibility column.

| Visibility | Page | Listed | Sitemap | Search | Access |
| --- | --- | --- | --- | --- | --- |
| `public` | `/elections/<slug>/` (prerendered) | yes | yes | anon + signed-in | anyone |
| `unlisted` | `/elections/view/?id=<uuid>` | no | no | admins only | anyone with the uuid |
| `private` | `/elections/view/?id=<uuid>` | no | no | admins only | admins |

- RLS: public elections are readable by anyone, private elections by
  admins, unlisted elections are not readable through the Data API
  at all (only through the RPC). Admins can read every row.
- `contests` and `contest_candidates` have **no** public select policy: a
  contest is only visible when its election is, so all reads go through
  `get_election`. Hidden elections therefore never leak their contests or
  candidates into the Data API or prerendered HTML.
- `/elections/view/` reads the uuid from `?id=` (or `/elections/u/<uuid>/` /
  `/elections/p/<uuid>/` paths rewritten by `public/_redirects` on Cloudflare)
  and calls `public.get_election(uuid)`. Admins see an “Edit election” button
  that deep-links to `/admin/elections/?edit=<id>`.

### Elections search

- `elections.search_document` is a stored `tsvector` generated from `name`
  (weight A) and `description` (weight B), with a GIN index.
- `public.search_elections(p_query text, p_limit int)` uses
  `websearch_to_tsquery` + `ts_rank` for nonempty queries; empty browsing orders upcoming elections first.
  Anonymous callers only match `public` elections; admin callers also match
  `unlisted` and `private` elections.
- `public.get_election(uuid)` returns `{status: ok|private|missing, election,
  organization, contests, dates}` for the election page and viewer, applying the
  election gate and, for key dates, the event/calendar gates.

## Organizations admin

- Admin UI: `/admin/organizations/` (requires an admin account).
- Public directory: `/orgs/`; each organization gets `/orgs/<slug>/`.
- Admins can create, edit, and delete organizations and upload a logo.
- On a public organization page, admins see an “Edit organization” button that
  deep-links to `/admin/organizations/?edit=<id>` with the form prefilled.
- The `/orgs/` directory has a full-text search box (same approach as maps):
  `organizations.search_document` is a stored `tsvector` (name weight A,
  description weight B) with a GIN index, and
  `public.search_organizations(p_query text, p_limit int)` uses
  `websearch_to_tsquery` + `ts_rank`. Organizations are all public, so the
  function runs as the caller (RLS applies) rather than `security definer`.
- RLS allows public reads and restricts writes to `public.admins`; storage
  policies use the same check, so the anon key cannot write.

The site is built for Cloudflare Workers static assets, so public organization
pages are generated at **build time** from the database. After editing, run
`bun run build` (or redeploy) to publish the change. Admin edits are immediate in
the database but invisible on the static site until the next build.

## Auth in the frontend

- `/signin/` and `/signup/` are static Astro pages with client-side forms.
- `/account/` shows the signed-in user's name, email, and id, and offers sign-out.
- The header swaps “Sign in” for “Account” once a session exists, and shows an
  “Admin” link next to it when the user is in `public.admins`.
- All calls go through `getSupabase()` in `apps/web/src/lib/supabase.ts` with the
  public anon key; session storage is handled by `@supabase/supabase-js`.

## Security model

- Row Level Security is enabled on every application table.
- Account profiles are readable by their owner or admins; users may insert or update
  their own profile.
- Organizations are publicly readable; only members of `public.admins` may write
  them or their logos.
- The anon key is public and safe to ship; it only grants what RLS allows.
- The service-role key is never used in `apps/web` and must never be committed.
- Trigger functions are `security definer` where needed and have `execute`
  revoked from `anon`/`authenticated`.

## Conventions

- **Migrations are append-only.** Add a new timestamped file under
  `supabase/migrations/`; never edit one that has already been applied. Apply to
  a running local DB with `bun run db:migrate` (keeps data) or `bun run
  db:reset` (clean slate).
- **RLS on every table.** Enable it and write explicit policies. Public reads are
  allowed only for `public` rows; `unlisted` rows are not selectable through the
  Data API at all and are reached through an RPC instead.
- **Admin writes** use `to authenticated with check (public.is_admin())`.
- **Hidden rows** (unlisted maps/layers/elections, and rows whose visibility
  depends on a parent) are exposed through `security definer` functions that
  apply the visibility rule themselves (`get_map`, `get_map_layers`,
  `get_person`, `get_election`, `get_event`). Set `search_path = ''` and fully
  qualify names in these functions.
- **Full-text search** uses a stored generated `tsvector` column (name weight A,
  description weight B) with a GIN index and an RPC that runs
  `websearch_to_tsquery` + `ts_rank`. Match this pattern for new searchable
  resources.
- **Frontend clients:** browser code uses `getSupabase()`; build-time data uses
  `getBuildSupabase()`. Only `PUBLIC_*` env values reach the browser; the
  service-role key is for local tooling and CI, never `apps/web`.

## Adding an admin-managed resource

A repeatable shape, used for organizations, maps, and layers:

1. Migration: table + `created_at`/`updated_at` + `public.set_updated_at()`
   trigger + RLS policies (`public` read, private read for authenticated if it
   has visibility, `is_admin()` writes). Add an FTS `search_document` column if
   it should be searchable.
2. Admin page under `apps/web/src/pages/admin/<resource>.astro` with the
   gate/denied/panel pattern and a script in `apps/web/src/scripts/`; add it to
   `AdminTabs.astro`.
3. Public surface: prerendered pages via `getBuildSupabase()` for `public`
   content, and/or an RPC for anything that must not be embedded in HTML.
4. Link new public pages from the directory/footer and confirm the
   `@astrojs/sitemap` filter still excludes admin/auth/viewer routes.
5. Verify as anonymous and as the seeded admin (see
   [development.md](./development.md)).

## Deploying to a hosted project

1. Create a Supabase project.
2. Link this repo: `supabase link --project-ref <ref>`.
3. Merge migrations to GitHub `main`. Production normally applies them through
   the Supabase GitHub integration. For a manual production push, use the guarded
   `bun run db:push --dry-run`, then `bun run db:push` from a clean, current
   `main` checkout; this command is pinned to the Civic Pulse production project.
   See [production migration guards](./development.md#guarding-production-migration-pushes).
4. In the Supabase dashboard, set the Auth site URL to `https://www.civpulse.org`
   and add the production redirect URLs.
5. Add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to the Cloudflare
   Worker build environment.


### Candidate ballot labels

`contest_candidates.is_write_in` is stored per candidacy, independent of party
and status. Admins set it using the candidate form's **Certified write-in**
checkbox. `get_election` returns the flag; both prerendered pages and the shared
viewer display a **Certified write-in** badge immediately below the candidate's
name. A missing party does not imply a write-in (nonpartisan candidates can have
no party too).

### Person candidacy history

Person profiles load `get_person_candidacies(person_id)` in the browser on both
public pages and the shared viewer. No candidacy or hidden-election data is
embedded in public HTML. The RPC checks the person's visibility, then includes
public elections for anonymous visitors and also unlisted/private elections for
admins, matching election search discovery rules.

Current candidacies have an election date today or later in America/New_York
and a status of running, runoff, or pending. Past candidacies include earlier
elections and candidacies marked withdrawn, won, or lost. Current entries sort
by nearest election first; past entries sort newest first. Each entry links to
the correct public election page or UUID viewer and includes office/district,
election date, party, status, and the certified write-in badge when applicable.
Profiles with no visible candidacies omit the section.

### Ballot questions

`ballot_questions` stores referendums, amendments, and other questions separately
from office contests. Each belongs to an election and has a title/ballot number,
required full wording, optional explanation and jurisdiction, 2–20 response
choices (default Yes/No), optional HTTP(S) official source URL, and sort position.
Admins create, edit, delete, and filter questions in `/admin/elections/`.
Questions display after office races under “What's on the ballot,” sorted by
position and title. Question-only elections are supported. Choices are informational,
not a voting form. No person/candidate records are created for questions.

Direct table access is admin-only, enforced with RLS. Public and shared election
views receive questions through `get_election`, inheriting the election's
public/unlisted/private rules. Deleting an election cascades its questions.
Public pages update after a rebuild; UUID viewers fetch current data.

### Articles and profile reading lists

`articles` stores an external article's required title and HTTP(S) URL, visibility,
optional `published_on` and `fetched_on` dates, and timestamps. `published_on`
records the publisher's publication date, or null when unknown. `fetched_on`
records when the article or link was last verified to exist, independently of its
publication or creation date. Unknown dates remain null; infinite dates and
future fetched dates are rejected. URLs are
unique so one article can be linked to many profiles.
`article_people` and `article_organizations` are independent many-to-many joins;
a link has a free-text relationship label (default “Mentioned”), such as Subject,
Author, or Publisher. A person can be both author and subject by entering that
label. No person or organization links are required to save an article.

Admins manage articles and both association sets in `/admin/articles/`. They can
search the list by title, URL, or linked record name, filter each selection list,
and edit/delete entries. `save_article` is an admin-only security-invoker RPC
that saves metadata and replaces both association sets in one transaction.
Invalid foreign keys, duplicate links, or duplicate URLs roll back the entire
save. The seven-argument overload accepts `p_fetched_on` (null clears it); the
original six-argument API preserves existing dates. The eight-argument overload
also accepts `p_published_on` (null clears it); older callers preserve publication
dates. Deleting an article cascades its links; deleting a person/organization
removes that association while preserving the article and its other links.

RLS protects all three tables. Only admins can modify articles or read/write
association tables directly. Anonymous clients can directly read public article
metadata; admin clients can also read private metadata; unlisted metadata
is available to admins or the profile RPCs. `get_person_articles` first checks
the person's visibility; `get_organization_articles` checks that the public
organization exists. Both return public articles anonymously, plus private and
unlisted articles when signed in as an admin, matching the existing profile discovery rules.
They return only that profile's own relationship, never other linked identities.

“News & articles” lists load at runtime on public person pages, the person UUID
viewer, and organization pages, newest publication date first, undated articles
last, with ties ordered by title then ID. Each title opens the external
article, with its source hostname, publication and fetched-on dates (or “unknown”),
and relationship label. Empty lists are hidden; errors offer a reload message.
No article associations or hidden metadata are
embedded in static HTML. Article edits and associations update these runtime
lists immediately; new public person/organization pages still require a rebuild.

### Authenticated MCP content operations

The MCP Edge Function forwards the verified user token; it never uses service-role
credentials. The append-only mcp_content_tools migration adds authenticated-only
RPCs without changing RLS. `mcp_get_record` follows the caller's role-based discovery
rules and returns article association sets only to admins. `mcp_layer_features`
uses the existing containing-map geometry gate for non-admins, searches stored
properties with pagination and returns bigint IDs as strings. Both read RPCs
are security definers with an empty search_path and an explicit auth.uid gate.

The admin-only, security-invoker RPCs `mcp_save_article`,
`mcp_save_postgis_layer` and `mcp_save_layer_feature` lock existing rows and
preserve omitted fields. They reuse canonical article/import transactions or
the existing geometry constraints. Partial feature edits enforce the same
10 MB / 10,000-feature layer limits as imports. Invalid associations or geometry
roll back the entire operation. Direct resource/link writes still use RLS.
See [mcp.md](./mcp.md) for tool coverage and OAuth verification.

### Recreated map explorer and presentation

The map directory also hosts the interactive preset explorer. Maps carry
`view_options`, layers carry `presentation`, and each map-layer link carries
`visible_by_default`. `get_map_layers` returns these settings through the same
visibility gate and now merges partial map styles over layer defaults using
JSON object concatenation. The new admin-only `save_map` saves metadata and
ordered links atomically. Existing map/layer RLS policies remain in force.

The shared public/admin renderer supports exact category styles, independent
fill/outline colors, GTFS property colors, original marker assets, safe popups,
and a paginated place directory. See [maps.md](./maps.md) for the schemas,
reproducible import commands, snapshot provenance and geometry repair notes.

### Calendar month explorer and subscription feed

`/calendar/` offers month/day selection and an agenda of that month's events,
previous/next month and Today controls, organization and category filters, text
search, multiple calendar checkboxes with Show all/Hide all, and colors by calendar
or organization. Times and day boundaries use America/New_York, including DST.
The URL preserves the month, view, query, organization, category, colors, and
selected calendars. Existing `?calendar=<uuid>` links still select that calendar.
Event details expand in place and link to the organizer when a URL is available.

`browse_calendar_events(p_start, p_end, p_offset, p_public_only)` returns up to
500 events per page, ordered by start and UUID. It includes events overlapping
the requested range, with the same event/calendar/election visibility gates as
search. The browser loads every page before filtering and displaying results;
errors never leave a partial month looking complete. The category is optional,
editable in the event admin form, and initially backfilled from calendar names.
Copies of the same occurrence in multiple visible calendars are displayed once,
with all matching calendar labels. Distinct times and locations remain separate.

`/events.ics` is a **stable subscription URL**, prerendered on every build using
the anonymous build client and `p_public_only: true`. It includes all public
calendars, independent of browser filters or session, never private/unlisted
content. Event UUIDs form stable UIDs, and updated_at supplies revision timestamps.
The file uses RFC 5545 UTC timestamps, all-day dates with exclusive ends, escaped
text, CRLF, and UTF-8-safe line folding. Backend errors fail the build instead of
publishing a partial feed. Cloudflare headers set text/calendar and five-minute
cache revalidation. There is no server adapter or runtime feed service.

Users choose Subscribe (webcal) or paste the HTTPS URL into their calendar app's
“Add by URL” option. Download imports a one-time copy. Feed changes publish on the
next successful frontend deployment; phones refresh at their own cadence, so
updates are not instant. Keep this path stable when switching new.civpulse.org to
www.civpulse.org. Existing subscribers on either hostname need that hostname to
continue serving the feed (or redirecting it) after cutover.

Verification: `bun test scripts/tests/calendar.test.ts`. The opt-in database test
uses a transaction that rolls back its fixtures and checks >500 events,
anonymous/signed-in visibility, hidden calendars/elections, and public-only mode:
`CALENDAR_TEST_DATABASE_URL=<local postgres URL> bun test scripts/tests/calendar-db.test.ts`.


### Offices and service history

`offices` identifies a durable office or seat within an organization, with a
required name and optional district/jurisdiction, seat label and description.
The organization/name/district/seat combination is unique. Offices are public;
organization deletion is restricted while offices reference it.

`office_terms` links a person to an office for one period of actual service.
Each record has a required `elected | appointed` selection method and first day,
optional inclusive last day, and optional HTTP(S) source URL. Null last day means
ongoing. Dates must be finite and the last day cannot precede the first day.
Repeated/nonconsecutive terms are separate records; the same person/office/start
cannot be duplicated. An office with service records cannot be deleted; deleting
a person removes their service links. Election results never automatically
create service records, and existing candidacies and affiliations are unchanged.

Admins manage both resources in `/admin/offices/`. `offices` is publicly readable;
`office_terms` has admin-only direct access. All writes require `is_admin()`.
`get_office_terms(p_person_id, p_organization_id)` returns service records through
an empty-search-path security-definer function. At least one filter is required.
Person UUID access permits public/unlisted people anonymously, private people
only when signed in as an admin. Organization discovery permits only public people
anonymously and includes hidden people when signed in as an admin, like person search.

Public person pages, the person UUID viewer and organization pages load service
at runtime; no service associations are embedded in prerendered HTML. The RPC
classifies current, former and upcoming using today's America/New_York date.
The start and last day are inclusive. Empty groups/sections are hidden and load
errors offer a reload message. Offices link back to their organization; an
organization's officeholders link to each person's visibility-appropriate URL.

The migration includes Jon Ossoff's elected Georgia Class 2 U.S. Senate service
starting January 20, 2021, with the Senate's Georgia senator history as its source,
only if his existing `jon-ossoff` profile is present. It reuses an existing Senate
organization when found, otherwise creates one. It records ongoing service
without inferring a future departure date or changing his candidate profile.

Verification: `OFFICES_TEST_DATABASE_URL=<local postgres URL> bun test
scripts/tests/offices-db.test.ts`. Fixtures roll back; the test checks date
boundaries, anonymous/signed-in visibility, direct-table protection, non-admin
write denial, admin service CRUD, invalid dates/URLs and deletion restrictions.

Historical sources may establish only a year. `starts_on_precision` and
`ends_on_precision` preserve `day | year`; year-only starts are stored at January
1 and year-only ends at December 31 solely as sorting bounds. Public/admin
formatters show the year, never those placeholder days. An end year denotes
already-concluded service, not a projected expiration; it is former even during
that calendar year. Admin date inputs accept `YYYY-MM-DD` or `YYYY` and reject
invalid calendar dates. Existing exact dates retain day precision by default.

The reviewed candidate import is recorded in
`docs/research/2026-candidate-office-history.json`, including supporting official
sources, explicitly identified term-boundary inferences and unresolved research.
`bun scripts/generate-office-history-migration.ts` reproduces its data migration.
It resolves existing people by slug, reuses seat organizations by slug or exact
normalized name, and inserts offices/service records without overwriting existing
content. Missing people in empty development databases are skipped. Pending
research and candidates without verified service are never converted into office
records. An omitted history is not evidence that a candidate has never served.

## Account roles and registration

Anyone can register at `/signup/` with an email, password (at least 8 characters), and optional name. Email confirmation is required by the local Auth configuration; configure the same requirement in hosted Auth. Confirmation returns to `/account/`; allow that URL in Auth redirect settings. New accounts have the `user` role, with the same civic content access as anonymous visitors. Unlisted UUID links remain accessible to both; discovery of unlisted content and all private content require an admin. Saved preferences are planned, not implemented.

`public.admins` remains the only source of admin authority; user-editable metadata never grants roles. Admins use `/admin/users/` to search registered accounts and promote another user. The `admin_list_users` and `promote_user_to_admin` RPCs check `is_admin()` on every call, use an empty search path, and expose no service key. Promotion is immediate without a token refresh. Account profiles are readable only by their owner or admins.

Verify with `ACCOUNTS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/accounts-db.test.ts`. Fixtures roll back.

## Signup bot and spam protection

The static signup and password sign-in forms render a managed Cloudflare Turnstile
challenge and send its token as Supabase Auth's `captchaToken` option. Supabase
Auth performs server-side verification with Cloudflare before creating an account
or issuing a password session. Enabling CAPTCHA in Supabase protects direct Auth
API requests too; a browser-only widget is insufficient. Both forms are protected
because Supabase's CAPTCHA setting also covers password sign-in. No server
adapter, proxy Worker, or service-role key is added to the frontend.

The forms fail closed while verification loads, fails, times out, or expires.
Visitors can retry without reloading or losing their entries. Every Auth request
resets the challenge, so retries require a fresh token. Concurrent form submissions
are locked. A hidden signup honeypot discards simple automated submissions, but
is only a secondary signal: bots can skip it, so it never substitutes for backend
CAPTCHA, email verification, or rate limits.

Local `supabase/config.toml` enables Turnstile using Cloudflare's **public test
secret**, requires email confirmation, allows 10 signup-related requests per five
minutes per IP, and imposes a 60-second per-address email resend interval. Auth
also retains its email sending quota. Rate-limit buckets may permit short bursts;
these are backend limits, not a browser timer. Restart the local stack to apply
Auth config changes without resetting data. New local users confirm through
Mailpit at <http://127.0.0.1:54324>. `bun run db:seed-user` uses the local-only
admin API to create/confirm the bootstrap admin and still works with CAPTCHA on.

Loopback Supabase URLs default to Cloudflare's public always-pass sitekey for
local development. Hosted builds require `PUBLIC_TURNSTILE_SITEKEY` and reject
Cloudflare test sitekeys. A missing production key fails the build instead of
publishing an unusable or unprotected registration form. Test keys intentionally
do not provide real bot resistance and cannot prove single-use/replay protection.

### Hosted activation (required before deploying the protected forms)

Setup completed on October 22, 2026:

- Created **Civic Pulse account registration** in the existing **Kerry Personal**
  Cloudflare account (`6d837580a4d0641139ecada9e74076b8`). Its public sitekey is
  `0x4AAAAAAFhogiT62WO1vh4J`, mode is managed, and clearance is `no_clearance`.
  Allowed hostnames are exactly `www.civpulse.org` and `new.civpulse.org`.
- Saved `PUBLIC_TURNSTILE_SITEKEY` in the existing `civpulse-web-new` production
  build trigger (`3bb52786-1d86-457b-bec2-33195bf3196f`). Existing build variables
  were preserved. The frontend was subsequently deployed through Workers Builds.
- Stored the secret as `TURNSTILE_PRODUCTION_SECRET` and the public key as
  `TURNSTILE_PRODUCTION_SITEKEY` in the existing ignored `apps/web/.env`, with
  permissions `0600`. These non-public bootstrap variables are not used by the
  frontend or local Auth. Do not copy the secret into Cloudflare build variables.
- Verified Cloudflare rejects missing, invalid, and public testing tokens using
  the production secret. Real-token signup/signin checks passed after deployment. See the replay
  verification limitation below.
- Signed in to the hosted CivicPulse dashboard through the approved GitHub flow.
  Confirmed email verification is enabled; anonymous sign-ins and manual identity
  linking are disabled. Password changes require recent authentication and the
  current password. Leaked-password protection is currently disabled.
- Set the hosted signup/sign-in rate limit to **10 requests per five minutes
  per IP**, with a **60-second** minimum email resend interval.
- Created the dedicated **CivicPulse** live Postmark server (`21158750`) after
  explicit approval. Verified `civpulse.org` (Postmark domain `8208477`) using
  the Postmark DKIM TXT record at `20261023023337pm._domainkey.civpulse.org`
  and DNS-only Return-Path CNAME `pm-bounces.civpulse.org → pm.mtasv.net`.
  Both records report **Verified** in Postmark. Existing SPF records were preserved.
- Enabled custom SMTP in hosted Supabase with **Civic Pulse
  <accounts@civpulse.org>**, `smtp.postmarkapp.com:587`, and the dedicated
  CivicPulse server credentials. Credentials are stored only in Supabase's
  encrypted SMTP configuration, not in the repository or frontend. Email
  confirmation remains enabled. Supabase sets the initial sending quota to
  30 emails/hour. Delivery was verified with the approved blackhole test below. The existing Postmark
  account plan has a shared 100-email monthly allowance; no plan upgrade was made.
- Set the hosted Site URL to `https://www.civpulse.org`, with exact redirects
  `https://www.civpulse.org/account/` and `https://new.civpulse.org/account/`.
- Deployed release commit `d592872a142c3fef96ae5128367afe19f5050110` through
  the existing Supabase GitHub migration check and Workers Builds. Both web and
  MCP builds succeeded. The web Worker version is
  `a1a204ad-6658-4598-a2bf-8e9fb3554bdb`. Follow-up commit `5e5b285` documents
  the official public local test key for Semgrep; all its CI checks passed.
- Enabled hosted CAPTCHA with Turnstile and the verified production widget
  secret after the frontend deployed. Missing and invalid tokens were rejected
  by both signup and password-token endpoints with `captcha_failed`.
- Verified an approved live signup as **Registration QA** using Postmark's
  `test@blackhole.postmarkapp.com`. Postmark delivered exactly one confirmation
  email from **Civic Pulse <accounts@civpulse.org>** (message
  `c1502d3f-de2a-4b75-ac21-dc34020fe62d`). Before confirmation, password login
  returned `Email not confirmed`. The delivered confirmation returned to the
  exact `/account/` redirect and showed role **User**. Password login then
  succeeded with a fresh Turnstile token. Regular-user access to `/admin/users/`
  was denied; anonymous access redirected to signin. No application console
  errors appeared. The QA session was signed out; the approved test account
  remains a regular user in production. No live admin promotion was performed.
- Real-token signup/signin and backend rejection checks passed. A live replay probe was also run: a repeated token returned successful
  Siteverify responses and the duplicate signup request returned HTTP 200 rather
  than `captcha_failed`. Replay rejection is therefore **not verified**. No new
  account was requested: the approved replay targeted the existing confirmed QA
  account. A follow-up database check confirmed exactly one QA account, confirmed
  and still non-admin. Do not describe hosted replay protection as tested
  successfully. Local transactional access
  tests cover admin-only account listing/promotion and anonymous/user visibility
  parity; the full local MCP regression suite also passed.

`supabase/config.toml` configures the **local stack**; it does not enable hosted
CAPTCHA or email protections. Coordinate these settings with the frontend release:

1. Create a managed Turnstile widget in the existing Kerry Personal Cloudflare
   account, restricted to `www.civpulse.org` and `new.civpulse.org`. Keep local
   testing on the separate public test keys; do not allow localhost on the
   production widget. The frontend uses actions `signup` and `signin`.
2. Add its public sitekey as `PUBLIC_TURNSTILE_SITEKEY` in the web Worker's
   **Build** environment. The secret must never have a `PUBLIC_` prefix or appear
   in the frontend, repository, CI logs, chat, or a browser Siteverify request.
3. In the CivicPulse Supabase project's **Authentication → Bot and Abuse
   Protection**, select Turnstile, store the widget secret there, and enable CAPTCHA.
   Supabase Auth owns Siteverify; there is no custom application handler or secret
   binding in the static Worker. Domain restrictions are configured on the widget;
   action values are not application authorization claims.
4. Require **Confirm email** under the email provider settings. Set the site URL
   to `https://www.civpulse.org` and allow `https://www.civpulse.org/account/`
   and `https://new.civpulse.org/account/` redirects if both serve the forms.
5. Configure signup-related rate limits to **10 requests / 5 minutes / IP** and
   the email resend interval to **60 seconds**. Set the project-wide sending quota
   to match legitimate traffic and monitor abuse; the built-in mail provider's
   two-emails-per-hour limit is not suitable for a public launch. Use the project's
   existing verified SMTP delivery configuration before opening registration.
6. Deploy and verify a fresh real token succeeds, missing/invalid/expired/replayed
   tokens fail at the Auth API, an unconfirmed account cannot sign in, and admin
   login still works. Enabling hosted CAPTCHA before deploying the matching forms
   will temporarily block old sign-in/signup clients. CAPTCHA and rate limits
   complement email confirmation; none guarantees that every account is human.

Do not silently disable CAPTCHA to resolve a deployment problem. Restore the
matching frontend/key configuration instead. Hosted settings and the production widget are configured as recorded above.
The live replay probe above did not demonstrate rejection; that provider/backend
behavior remains an unresolved verification limitation. The repository includes no production Turnstile secret.

References: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), and
[Cloudflare test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Georgia Secretary of State organization records

Organizations have nullable `sos_control_number`, `sos_business_type`, `sos_status`,
`sos_formation_date` (date), `sos_last_annual_registration`, `sos_principal_office`,
`sos_registered_agent`, `sos_county`, `sos_naics_code`, `sos_officers` and
`sos_record_url` fields. Control numbers remain text to preserve leading zeros;
annual registration remains text to preserve year-only source values. Officers
are optional text, separate from Civic Pulse person affiliations. SOS URLs must
use HTTPS on `ecorp.sos.ga.gov`. Existing public-read/admin-write organization
RLS applies unchanged. Admin forms and MCP create/update tools accept the fields;
public profiles show available details and omit the section when empty.

These are historical research values, not a live registry feed. The October 23,
2026 backfill matches existing slugs only and fills null fields without creating
organizations or overwriting populated values. Sources and the deferred NewTown
legal-entity mismatch are recorded in
`docs/research/organization-sos-backfill-2026-10-23.json`. The migration versions
match the hosted Supabase migration history. Because older repository migrations
already use future timestamps, apply these locally with
`SUPABASE_TELEMETRY_DISABLED=1 bun run supabase migration up --include-all`.

Verify with `SOS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
bun test scripts/tests/organization-sos-db.test.ts` (fixtures roll back).

## Records requests (ORR / FOIA)

`records_requests` holds publishable details, two optional organization links
(target and source; at least one required), three-way visibility, stage, outcome,
manual dates and a full-text search vector. `records_request_owners` and
`records_request_transfers` hold private account ownership and append-only
transfer history. Auth-user foreign keys restrict deletion while referenced.

The update, link, fee and file tables are children of the request. Fee amounts
use `numeric(12,2)` USD and separate estimated/billed/paid categories; they are
not combined into one total. Timeline entries are dated independently of the
current stage. Stage and outcome changes automatically append a status entry.

All tables enable RLS and revoke Data API access. Explicit security-definer RPCs
with empty search paths expose projections and enforce access. Creation checks
`is_admin()`; subsequent mutations allow the assigned owner or an admin. Every
mutation locks the parent before checking access, serializing it with transfers.
Clients cannot update owners or rewrite history directly. `get_records_request`
omits ownership/history unless authorized and returns the same unavailable state
for nonexistent and unauthorized private IDs. `search_records_requests` lists
public rows or, explicitly, rows managed by the caller, with stage/organization
filters, FTS and bounded pagination. Unlisted access is via UUID viewer only.

The private `records-request-files` bucket accepts common document/image MIME
types up to 25 MB. Immutable UUID object paths are scoped to a managed request.
Metadata defaults to private; shared files inherit request visibility. Storage
SELECT allows managers to manage objects, while visitors can only sign a known,
permitted path (`storage.allow_only_operation('object.sign')`), not enumerate
unlisted files. Signed downloads last 60 seconds and can remain usable for that
period after visibility/ownership changes. Removing metadata revokes new access
before object cleanup; failed cleanup leaves an inaccessible orphan for admin
maintenance. Never put confidential files in the public profile-media bucket.

Verify with `RECORDS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/records-requests-db.test.ts`.
The transaction rolls back its fixtures, covering anonymous, non-owner, owner,
admin, transfers, fee validation, private metadata and file enumeration.

## Civic object audit history

The `20261119000000_object_history` migration installs row triggers on the 23
civic tables registered in `audit.objects`: organizations, people, elections,
contests, candidates, ballot questions, offices/terms, affiliations and organization
relationships, articles/associations, maps/layers/features/memberships,
calendars/events, and meeting attendance/votes/choices/attachments. Account/Auth
and admin membership records are deliberately excluded. Add new civic tables and
all visibility-bearing references to this registry in an append-only migration.
The registry's parent graph must remain acyclic; relationship key columns must
match the table's primary key.

`audit.revisions` stores immutable before/after JSON, operation, monotonic revision
ID, transaction ID, wall-clock time, `auth.uid()` and a snapshot of the editor's
display name. It has no foreign keys to content or users, so deletions preserve
evidence. Derived search documents and automatic `updated_at` changes are omitted;
no-op saves create no revision. Tracking is transactional and includes cascades;
rolled-back edits leave no revision. SQL/service-role imports without an end-user
JWT are truthfully attributed to System / import. There is no historical backfill.

Both audit tables have RLS and the `audit` schema is inaccessible to API roles.
Neither regular users nor admins have direct mutation/read access. The sole read
API is `get_object_history(p_table, p_object_id, p_before, p_limit)`; it checks
`is_admin()` in a security-definer function with an empty search path. Admins can
browse all changes or filter by table/object. Other callers must supply an object.
Composite object keys are canonical JSON objects containing their primary-key
columns; ordinary objects use UUIDs, geographic features use bigint strings.
A GIN subjects index associates relationship changes with every owning/referenced
object; the feed uses descending revision-ID cursor pagination (default 25,
maximum 100), avoiding offset drift from new edits.

Public access requires both snapshots to have been public at edit time and every
referenced object to remain public now. A hidden-to-public transition is omitted
because its before snapshot contains hidden data. A deleted object uses its latest
public deletion as a tombstone; deletion of a hidden object never releases older
public snapshots. Cascading deletes with missing parents may be conservatively
admin-only. Historical references are checked as well as current ones, preventing
an old relationship from exposing a now-hidden person or election. Public payloads
omit editor UUIDs and private meeting storage paths. Display names are public
attribution; account emails are never used as fallback names. Full before/after
payloads, including storage paths, remain available to admins. Only trusted
registry table names enter dynamic SQL. Helpers have no public EXECUTE privileges.

Run `HISTORY_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
bun test scripts/tests/history-db.test.ts` for transactional access regression
checks. Normal database owners can change schema/data as usual; this is an
application-level append-only audit log, not an external tamper-proof ledger.

## Short links

`short_links` stores an immutable generated eight-character hexadecimal code,
label, HTTP(S) target, active flag, and creation/edit timestamps. `short_link_stats`
stores only a redirect total and last visit timestamp. Both tables enable RLS and
allow direct SELECT only to admins. Anonymous visitors cannot enumerate link
metadata or statistics; ordinary signed-in users see no rows. Authenticated
clients have no direct writes, including admins, so clients cannot replace codes
or forge a statistics total through table updates.

`save_short_link(p_id, p_title, p_target_url, p_active)` checks `is_admin()` on
every call. Creating a record generates a random code and retries collisions;
updating changes only the label, destination, active state and edit timestamp.
There is no user-facing delete/reuse operation. HTTP(S) URL checks reject
credentials, spaces/control characters and direct Civic Pulse short-link loops.
The browser normalizes targets and the Worker validates them before redirecting.

`resolve_short_link(p_code, p_count default true)` is the only public access
path. It returns one active target or null, never labels, IDs, or statistics.
Its empty-search-path security-definer function takes a share lock on the link
and atomically upserts its count and last visit. Concurrent requests do not lose
increments; pausing/editing cannot interleave with that resolution transaction.
Only GET requests count in the Worker; HEAD uses `p_count: false`.
These are resolution counts, not unique visitors or destination page loads.
Bots/repeats count, and the public RPC can also be called directly; totals are
basic usage indicators, not fraud-resistant analytics. No visitor PII is stored.

Verification: `SHORT_LINKS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
bun test scripts/tests/short-links.test.ts scripts/tests/short-links-db.test.ts`.
Permission fixtures roll back; the concurrent-count fixture is deleted afterward.

## Person voting records

`get_person_votes(p_person_id, p_offset = 0, p_limit = 21)` is a runtime,
security-definer read RPC with an empty search path and explicit execute grants
for anon/authenticated. It returns recorded choices with motion details and
meeting metadata, newest meetings first, then meeting ID, motion position and
vote ID. Limits are clamped to 1–50; negative offsets become zero. Profiles request
21 rows and display 20, retaining one lookahead row to offer the next page.

Public and unlisted people can be read by ID; private people require an admin.
For non-admins, the event, calendar and linked election must all be public and
the event must still be a meeting. Unlisted meetings stay out of profile discovery.
Admins can see all three visibility levels. No vote rows are prerendered.
An index on choices `(person_id, meeting_id, vote_id)` supports the person lookup.

Meeting vote articles have stable `vote-<UUID>` anchors. Participant links use
the visibility-aware UUID person viewer. Name linking only considers visible
attendance and roll-call participants, uses text nodes rather than HTML, and
leaves ambiguous shortened names unlinked.

### Meeting video URLs

`events.meeting_video_start_seconds` is an optional nonnegative integer offset
(0–2,147,483,647). It is meeting-only metadata with the same visibility and admin
writes as the URL. Null preserves the URL/default start; an explicit zero overrides
a URL timestamp. The admin editor accepts seconds, MM:SS or HH:MM:SS and saves
seconds. MCP event writes expose the nullable integer and preserve it when omitted.
YouTube iframe `start` parameters and Vimeo `#t=<seconds>s` fragments, plus the
external watch links, use the explicit offset without modifying the stored URL.
Unsupported providers retain their original link and display the selected time
for manual seeking. No start times are inferred from scheduled event times.

`events.meeting_video_url` is nullable HTTPS text (maximum 2,048 characters),
allowed only when `is_meeting` is true. It inherits existing event/calendar
visibility and admin write policies. `get_event`/`get_meeting` return it at
runtime; no private URL is embedded in static HTML. The meeting editor and MCP
event writes can set or clear it. The migration copies explicitly labeled
YouTube/Vimeo "Meeting recording:" URLs from existing descriptions, preserving
the descriptions and allowing multiple meetings to share one URL.

The browser parses URLs and reconstructs iframe URLs only for exact YouTube and
Vimeo hosts with valid video IDs. Other valid HTTPS URLs get an external link.
It never accepts iframe HTML. Players have descriptive titles, fullscreen,
responsive 16:9 sizing, lazy loading, and no autoplay parameter. YouTube uses its
[privacy-enhanced embed host](https://support.google.com/youtube/answer/171780)
and supported start times; Vimeo preserves unlisted-video
[privacy hashes](https://developer.vimeo.com/player/sdk/basics). A visible original
link remains available when providers restrict embedding.

### Meeting text in site search

`search_site` includes meeting notes, transcripts, and each motion's subject,
description and outcome in an event's related search text. Both English full-text
matching/ranking and literal substring matching (including identifiers such as
`FSS-2`) use that text. It is derived from live meeting records; edits and deleted
motions require no reindex or rebuild. Only events still marked as meetings
contribute meeting text. Existing event, calendar and linked-election visibility
gates apply before matching: anonymous and ordinary signed-in users discover only
public content; admins can also discover unlisted/private records. Search returns
the meeting once with its existing event link, regardless of how many motions
match. It does not publish or copy meeting files to the public archive.

## People directory pagination

`browse_people(p_query, p_kind, p_sort, p_limit, p_offset)` returns a JSON object
with `people` (directory card fields only) and an exact `total` after visibility,
keyword and type filtering. This security-definer RPC sets an empty search path;
anonymous and ordinary authenticated accounts see public rows, while
`is_admin()` permits hidden rows. Counts use the same visibility rule. Existing
`search_people` callers remain unchanged. Directory search matches full-name
substrings or the person's name/title/description full-text vector.

Sorting accepts `first_asc`, `first_desc`, `last_asc`, and `last_desc`. Full names
are stored as one field: first-name order uses the full name; last-name order
uses its final word after removing common generational suffixes. Full name and
UUID break ties deterministically before offset/limit. Limits clamp to 1–100
(default 24), offsets to zero or higher; query length is bounded at 500.
The browser resets pagination when criteria change and ignores stale responses.
Apply the migration before deploying the frontend. No hidden rows enter static HTML.

Run `PEOPLE_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
bun test scripts/tests/people-directory-db.test.ts` for pagination, sorting,
filtering, and visibility checks. Fixtures roll back.

## Legislative records

Legislative history is independent of calendar meeting attendance. `legislative_terms`
represents a Congress or state legislative cycle; `legislative_sessions` represents
regular/special/extraordinary sessions within it. `legislative_bodies` types existing
organizations as legislatures, chambers, committees or subcommittees and identifies
their legislature. Dated `legislative_body_memberships` references existing office
terms. The term is not an individual's period of office.

`bills` covers bills and resolutions, with unique `(term_id, numbering_context,
identifier)`. Use a shared numbering context for carryover between annual sessions;
use a separate context when a special session restarts numbering. The introducing
session remains unchanged when later sessions record actions. Versions, amendments,
actions, companion/reintroduction relationships, sponsorship intervals, documented
positions and article associations are independent child records. Withdraw a sponsor
by setting `ends_on`; a position is sourced independently of formal sponsorship.

`legislative_votes` stores the exact question, body/session, date, method, category,
reported result/totals and coverage (`complete`, `partial`, `no_individual_record`).
`legislative_vote_bills` connects a vote to one or several bills and optional versions,
amendments/actions. Individual choices reference the office term held at the time;
a person cannot receive two choices in the same vote. Missing records are unknown,
not absences. Voice votes cannot have individual choices. Unknown membership or
year-only service boundaries require an explicit review note. The normalized choice
and original source wording are both retained. Do not infer endorsements from
procedural votes, or calculate participation rates from an incomplete denominator.

All new tables have RLS, admin-only direct access, source provider/ID uniqueness,
source URLs, retrieval timestamps and civic audit triggers. Foreign keys restrict
deletion of referenced history. Identity/context/start dates cannot be reassigned;
reconcile dependent records explicitly to correct them. Service end dates can be
recorded without deleting prior votes, but cannot precede recorded participation.
`browse_legislation` returns bounded, paginated rows and exact totals after recursive
visibility checks on all referenced objects. Its resource list is fixed; private
helpers are inaccessible to API roles. Known unlisted objects can be fetched by UUID;
explicit bill/person context permits their child records, not unrelated discovery.
Ordinary authenticated accounts have the same public visibility as anonymous users.
`get_person_legislative_record` filters by session, body and vote category and returns
historical office labels, choices and visible bill associations.

Profile vote cards use `get_person_legislative_bill_groups` with the same service,
vote and choice visibility gates. It groups by visible bill UUID before paging,
counts the person's matching choices, and returns the latest matching vote per
bill. A vote affecting multiple bills contributes once to each bill; a vote with
no visible bill association remains an individual entry. Ordering uses date,
exact time when recorded, then vote UUID to break ties deterministically.
Filters apply before counting and selecting the latest vote. The original
per-vote RPC remains unchanged. Release the append-only
`20261123080000_person_legislative_bill_groups` migration through main before
deploying the frontend. Verify with `LEGISLATION_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/legislative-bill-groups-db.test.ts`;
the test rolls back its migration and fixtures.

`import_legislation` is an admin-only, atomic normalized import (at most 100 rows or
2 MB). Supply `{table, data}` entries in parent-first order. Every `data` needs
`source_system` and `source_id`; repeated keys patch the existing record. Explicit
UUIDs may connect new records in the same bundle; mismatched UUID/provider mappings
are rejected. Omitted fields retain defaults on insert and existing values on update.
Imports use the caller's JWT/RLS and never a browser service key. Provider-specific
harvesting and identity reconciliation are deliberately separate from this normalized
endpoint; name-only person matching is not supported. No live federal/state bulk
feed is enabled by these migrations.

The migrations follow the repository's existing future-dated migration sequence;
the original CLI-created timestamps were moved after their audit/schema dependencies
before application. Subsequent local refinements are separate append-only migrations.
Verify with `LEGISLATION_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/legislation-db.test.ts`.

Legislative display metadata is resolved by the private `legislative_private.details`
helper after the existing recursive visibility gate. It provides readable action
and bill labels, person viewer links for historical office service, and organization
slug links for chambers. It does not add a new public lookup endpoint or change
visibility rules. The append-only `legislative_display_details` migration keeps
execution revoked from public, anonymous and authenticated callers.

Legislative browsing searches related display labels (including members, bills, and articles) after materializing visibility-approved rows, preserving hidden-record protections.

The October 26, 2026 Josh McLaurin backfill uses official Georgia member ID 4942
and existing dated House District 51 / Senate District 14 office terms. Its
normalized import and audit report live under `docs/research/josh-mclaurin-legislative-*`.
It covers eight published regular/special session datasets, with 3,342 member
choices and partial roll-call coverage. Published official totals are retained;
`not_reported` outcomes avoid inferring a disposition from Yea/Nay counts. Bill
identifiers remain in question labels; bill introduction dates and bill rows are
not fabricated. Two 2021 House source records with contradictory duplicate member
choices are excluded pending source correction, along with attendance records.
The source adapter adds an `attendance` indicator for attendance captions even
when Georgia's `isRollCall` flag is false, and flags multiple choices for an explicit
member ID as `member_identity_conflict`.

Large person histories use a private `visible_vote_ids` helper to resolve shared
session, body and optional event visibility once. The profile endpoint resolves
dated service once, counts only permitted choices, pages those choices, and
hydrates bill labels only for the returned page. The vote directory shares the
same helper. Private/unlisted parent gates and explicit UUID contexts are
preserved; no private helper is executable by API roles.

The hosted compatibility migration runs only when the existing legislative
endpoint is already installed. Fresh resets skip it; the applied bill-group
(`20261123080000`) and bill-browsing (`20261123090000`) migrations supply the
visibility helper and optimized profile/directory reads. The redundant,
production-unapplied `legislative_history_read_performance` file was removed
after a version collision; the applied files and migration history are retained.
The database regression uses these current definitions with 3,500 choices and a
three-second statement timeout, then rolls back.

## Query performance and foreign-key coverage

The append-only `20261123070000_query_performance_indexes` migration adds covering
indexes for the seven advisor-reported foreign keys on map layers, meeting
attendance, meeting vote choices and records-request transfers. Existing indexes
remain intact. It uses five-second lock and sixty-second statement timeouts so
an unexpected blocker fails the migration instead of holding up live edits.

`search_site` materializes text after selecting the requested entity type, then
builds the combined search vector once before matching and ranking. Empty queries
skip relationship-text and vector construction. Search results, rank/order,
meeting-text matching and visibility gates remain unchanged; there is no stale
search cache to invalidate. `get_layer_geojson_page` checks the requested map/layer
membership directly instead of fetching/sorting the entire map's layer list.
Public/unlisted/private semantics, paging, totals and geometry precision remain
unchanged. Both RPCs retain security-definer/empty-search-path configuration and
existing execute grants.

Run `PERFORMANCE_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
bun test scripts/tests/query-performance-db.test.ts` against local Supabase. It
compares before/after results for anonymous, ordinary authenticated and admin
callers, including hidden meetings and a map/layer visibility matrix, then rolls
back its migration and fixtures. The CLI-created migration timestamp was moved
after the existing future-dated dependency sequence before application.

Release through the normal PR/main Supabase integration; never apply this SQL to
production from a feature branch. Check advisors and compare representative RPC
timings after release. Index storage fits within the existing disk allowance;
there is no instance resize or new paid service.

### Legislation directory capacity and prefiling

`legislation_bill_browse_performance` resolves the visible legislative terms,
sessions, chambers, bills and votes once per query. Bill and vote-to-bill listing
and profile grouping reuse those sets instead of recursively walking the same
parents for every row. Bill keyword search joins readable context labels directly;
record details are generated for the result page. Public/unlisted/private rules,
direct UUID/context behavior, totals, ordering and pagination are preserved.
Private helpers remain uncallable by API roles and all public reads keep their
empty-search-path security-definer configuration.

Bills and resolutions may have sourced filing dates before the session opens.
`legislative_prefiling` allows that date while retaining the session's upper bound,
finite-date validation, immutable historical context and term/body agreement.
Votes and actions still must occur within their session. Do not shift an official
filing date or the session's start date to make an import pass validation.

Verify both append-only migrations with
`LEGISLATION_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/legislative-browse-performance-db.test.ts`.
The test compares previous and optimized visibility results, exercises anonymous,
ordinary signed-in and admin callers with 4,000 bills/links under a five-second
statement timeout, and rolls back its migrations and fixtures. Merge to main
before applying through the guarded production migration workflow.

The bill directory uses `browse_bills` for jurisdiction (federal/state/unclassified),
state name, term, keyword and sort criteria before pagination, with exact filtered
totals and deterministic date/title ordering. It retains recursive bill visibility;
ordinary signed-in users have the same discovery access as anonymous visitors.
Jurisdiction and optional state name belong to legislative terms. Existing terms
are unclassified unless a recognized Congress/Georgia General Assembly slug matches;
new imports and admin edits should supply this metadata explicitly. State terms
require a state name; federal/unclassified terms must leave it empty. This does
not enable a bulk data feed. Apply `legislation_directory` on main before deploying
the frontend. Verify with `LEGISLATION_TEST_DATABASE_URL` and
`bun test scripts/tests/legislation-directory-db.test.ts` (fixtures roll back).

The follow-up Georgia bill backfill imported 3,813 bills/resolutions and 4,890
associations for 3,292 of Josh McLaurin's recorded votes. Fifty votes have no
measure reference in the official source and remain unlinked. Anonymous API
verification checked every imported field and confirmed all 3,342 original member
choices were unchanged. See
[the import audit](research/josh-mclaurin-bills-backfill-2026-10-26.json).

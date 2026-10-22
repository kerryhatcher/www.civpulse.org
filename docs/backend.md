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

`bun run db:seed-user` creates a known local account (idempotent — it signs in if
the user already exists). Local email confirmations are disabled, so the account
works immediately:

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

Studio runs at <http://127.0.0.1:54323>. Local email confirmations are disabled,
so test users can sign in immediately.

The orchestration lives in [`scripts/dev.mjs`](../scripts/dev.mjs). It forces the
Astro server into the foreground (`ASTRO_DEV_BACKGROUND=1`) so its lifetime is
tied to the wrapper's.

## Schema

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
- `private` layers render only for signed-in users.

So a public map with a private layer shows that layer to signed-in users and
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
| `unlisted` | `/maps/view/?id=<uuid>` | no | no | signed-in only | anyone with the uuid |
| `private` | `/maps/view/?id=<uuid>` | no | no | signed-in only | signed-in users |

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

Anonymous discovery includes public records only; signed-in discovery includes
unlisted and private records under the existing visibility rules. Events also
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
- Anonymous callers only match `public` maps; signed-in callers also match
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

### Calendar/event visibility

Calendars and events each have `public | unlisted | private`, the same rules as
maps and layers. An event is only visible when **both** it and its owning
calendar are visible, so a public event on a private calendar stays private.

| Visibility | Listed | Search | Access |
| --- | --- | --- | --- |
| `public` | yes | anon + signed-in | anyone |
| `unlisted` | no (uuid URL only) | signed-in only | anyone with the uuid |
| `private` | no | signed-in only | signed-in users |

- `public.events` has **no** anonymous/authenticated select policy: because the
  rule depends on the owning calendar, all reads go through `security definer`
  RPCs. `public.calendars` allows public reads (and private reads when signed
  in), but unlisted calendars are still excluded from the Data API. Admins can
  read both tables directly for the admin UI.
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
| `unlisted` | `/people/view/?id=<uuid>` | no | no | signed-in only | anyone with the uuid |
| `private` | `/people/view/?id=<uuid>` | no | no | signed-in only | signed-in users |

- RLS: public people are readable by anyone, private people by any
  authenticated user, unlisted people are not readable through the Data API at
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
  + `ts_rank`. Anonymous callers only match `public` people; signed-in callers
  also match `unlisted` and `private` people. Unlisted people stay unreachable
  through the Data API because the function is `security definer` and applies
  the filter itself.
- The `/people/` page shows the build-time public list to anonymous visitors,
  swaps to `search_people` results as you type, and (when signed in) lists the
  full set of people the caller can access with visibility badges.

## Elections

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
| `unlisted` | `/elections/view/?id=<uuid>` | no | no | signed-in only | anyone with the uuid |
| `private` | `/elections/view/?id=<uuid>` | no | no | signed-in only | signed-in users |

- RLS: public elections are readable by anyone, private elections by any
  authenticated user, unlisted elections are not readable through the Data API
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
  Anonymous callers only match `public` elections; signed-in callers also match
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
- Anyone may read a public profile; only the signed-in user may insert or update
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
3. Push migrations: `bun run db:push`.
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
signed-in visitors, matching election search discovery rules.

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
metadata; authenticated clients can also read private metadata; unlisted metadata
is available to admins or the profile RPCs. `get_person_articles` first checks
the person's visibility; `get_organization_articles` checks that the public
organization exists. Both return public articles anonymously, plus private and
unlisted articles when signed in, matching the existing profile discovery rules.
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

The MCP Worker forwards the verified user token; it never uses service-role
credentials. The append-only mcp_content_tools migration adds authenticated-only
RPCs without changing RLS. `mcp_get_record` follows existing signed-in discovery
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

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
- `public.layers` — first-class reusable GeoJSON layers: `name`, `description`,
  `source_url`, `visibility`, `style` (the default style), timestamps.
- `public.map_layers` — ordered many-to-many join between maps and layers
  (`map_id`, `layer_id`, `position`, `style`); a layer can be on many maps and a
  map can have many layers. `map_layers.style` is an optional per-map override.

Events and other content tables are intentionally not defined yet. They will be
added as separate migrations once their shape is settled.

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
dropdown is populated by fetching the layer’s `source_url` and inspecting its
GeoJSON feature properties, so it only offers fields that actually exist.

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

### Search

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
- **Hidden rows** (unlisted maps/layers, private maps for anonymous callers) are
  exposed through `security definer` functions that apply the visibility rule
  themselves (`get_map`, `get_map_layers`). Set `search_path = ''` and fully
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

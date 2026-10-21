# www.civpulse.org

Civic Pulse website and web app.

## Structure

This is a Bun workspace monorepo:

```
apps/
  web/            Astro frontend (served as Cloudflare Workers static assets)
supabase/         Postgres migrations and local Supabase configuration
scripts/          Dev orchestration (scripts/dev.mjs) and local seed helpers
docs/             Architecture, backend, and development notes
package.json      Workspace root and task shortcuts
```

`apps/web` consumes Supabase through `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` (see `apps/web/src/lib/supabase.ts`).

## Requirements

- [Bun](https://bun.sh) 1.2+
- Docker or Podman (for the local Supabase stack)
- A Cloudflare account with Workers enabled (for deploys)

## Getting started

```bash
bun install
bun run dev        # starts local Supabase, then the Astro dev server
```

`bun run dev` starts the local Supabase stack if it isn't already running, then
runs the Astro dev server in the foreground. On exit, Supabase keeps running so
you can iterate quickly; stop it with `bun run db:stop`, or have `dev` stop it
too via `CIVICPULSE_STOP_BACKEND=1 bun run dev`.

The local admin account is `test@civpulse.org` / `civicpulse-test-123`
(created by `bun run db:seed-user`; see [docs/development.md](docs/development.md)).

Other root scripts:

```bash
bun run dev:web     # Astro dev server only
bun run dev:backend # local Supabase only
bun run check       # astro check (types + config)
bun run build       # static output in apps/web/dist
bun run preview     # preview the production build
bun run deploy      # build, then wrangler deploy to Cloudflare

bun run db:start    # start local Supabase (Postgres, Auth, Studio)
bun run db:status   # print local URLs and keys
bun run db:seed-user # create/confirm the local test user
bun run db:migrate  # apply pending migrations (keeps local data)
bun run db:reset    # re-apply all migrations (wipes local data)
bun run db:stop     # stop local Supabase
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — hosting/rendering model and the
  visibility model.
- [docs/backend.md](docs/backend.md) — schema, RLS, search, and conventions.
- [docs/development.md](docs/development.md) — local loop, verification, and
  environment gotchas.

## Environment

Copy `apps/web/.env.example` to `apps/web/.env` and fill in the local Supabase
URL and anon key from `bun run db:status`. Only `PUBLIC_*` variables are exposed
to the browser; service-role keys must never be stored there.

## Backend

Supabase migrations live in `supabase/migrations/`: `profiles` (auth), plus
`admins`, `organizations`, the `org-logos` storage bucket, `maps`, and reusable
`layers` (`map_layers` joins them many-to-many). Admins manage the public
directory at `/admin/organizations/`, layers at `/admin/layers/`, and maps
(OSM base map + layers) at `/admin/maps/`; published org pages live at `/orgs/`
and `/orgs/<slug>/`. Maps and layers have `public`, `unlisted`, and `private`
visibility; public map pages live at `/maps/<slug>/` (listed + sitemap) while
unlisted/private maps use the shared viewer at `/maps/view/?id=<uuid>`. The
`/maps/` and `/orgs/` directories include full-text search. Because the site
deploys as Cloudflare Workers static assets, public pages are generated at build
time — rerun `bun run build` to publish admin changes. See
[docs/architecture.md](docs/architecture.md) and [docs/backend.md](docs/backend.md)
for details.

## Deployment

`apps/web/wrangler.jsonc` configures a Worker named `civpulse-web` that serves
the static `apps/web/dist` output. `bun run deploy` builds the site and uploads
it with Wrangler.

## AI tooling

Agent instructions live in [AGENTS.md](AGENTS.md) and
[apps/web/AGENTS.md](apps/web/AGENTS.md). [Pi](https://pi.dev) loads its
project packages/instructions from [.pi/settings.json](.pi/settings.json).

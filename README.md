# www.civpulse.org

Civic Pulse website and web app.

## Structure

This is a Bun workspace monorepo:

```
apps/
  mcp/            Authenticated MCP Worker
  web/            Astro frontend (served as Cloudflare Workers static assets)
supabase/         Postgres migrations and local Supabase configuration
scripts/          Dev orchestration (scripts/dev.mjs) and local seed helpers
docs/             Architecture, backend, and development notes
plugins/civpulse/ Portable Codex/ChatGPT plugin, skills and MCP configuration
pi-astro/         Pi package: Astro Docs MCP extension + Astro skills
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
- [docs/mcp.md](docs/mcp.md) — the remote MCP server and OIDC auth for AI agents.
- [docs/development.md](docs/development.md) — local loop, verification, and
  environment gotchas.

## Environment

Copy `apps/web/.env.example` to `apps/web/.env` and fill in the local Supabase
URL and anon key from `bun run db:status`. Only `PUBLIC_*` variables are exposed
to the browser; service-role keys must never be stored there.

## Backend

Supabase migrations live in `supabase/migrations/`: `profiles` (auth), plus
`admins`, `organizations`, the `org-logos` storage bucket, `maps`, reusable
`layers` (`map_layers` joins them many-to-many), `calendars` + `events`
(each calendar belongs to one organization, and an organization can have many),
`people` + `person_organizations` (civic figures linked to organizations with a
role, plus the `person-images` bucket), and `elections` + `contests` +
`contest_candidates` (an election on a date, the offices being elected, and the
people running). Election key dates — early voting windows, registration and
mail-ballot deadlines, election day — are calendar events tagged with the
election.
Admins manage the public directory at `/admin/organizations/`, people at
`/admin/people/`, layers at `/admin/layers/`, maps (OSM base map + layers) at
`/admin/maps/`, calendars and events at `/admin/calendars/`, and elections and
contests at `/admin/elections/`; published org pages live at `/orgs/` and
`/orgs/<slug>/`, person profiles at `/people/` and `/people/<slug>/`, and
elections at `/elections/` and `/elections/<slug>/`. Maps, layers, calendars,
events, people, and elections have `public`, `unlisted`, and `private`
visibility; public map pages live at `/maps/<slug>/` (listed + sitemap) while
unlisted/private maps use the shared viewer at `/maps/view/?id=<uuid>`. Events
are browsed and filtered by organization and/or calendar at `/calendar/`, with a
shared event viewer at `/calendar/view/?id=<uuid>`; people and elections use the
shared viewers at `/people/view/?id=<uuid>` and `/elections/view/?id=<uuid>`.
The `/maps/`, `/orgs/`, `/calendar/`, `/people/`, and `/elections/` directories
include full-text search with the same anonymous/signed-in visibility rules.
Because the site deploys as Cloudflare
Workers static assets, public pages are generated at build time — rerun
`bun run build` to publish admin changes. See
[docs/architecture.md](docs/architecture.md) and [docs/backend.md](docs/backend.md)
for details.

## Deployment

`apps/web/wrangler.jsonc` configures a Worker named `civpulse-web-new` that serves
the static `apps/web/dist` output. `bun run deploy` builds the site and uploads
it with Wrangler.

Cloudflare Workers Builds deploys the static website on pushes to `main`.
The Supabase GitHub integration deploys the MCP Edge Function at
`https://api.civpulse.org/functions/v1/mcp`. Build settings, watch paths, and
public environment values are documented in [docs/development.md](docs/development.md).

## AI tooling

Agent instructions live in [AGENTS.md](AGENTS.md) and
[apps/web/AGENTS.md](apps/web/AGENTS.md). [Pi](https://pi.dev) loads its project
packages/instructions from [.pi/settings.json](.pi/settings.json), which pulls in
[`pi-astro/`](pi-astro) — a Pi package that registers the official
[Astro Docs MCP server](https://docs.astro.build/en/guides/build-with-ai/)
(`search_astro_docs`) and provides the `astro` / `astro-project-rules` skills.
See [pi-astro/README.md](pi-astro/README.md).

## Civic Pulse plugin

[Plugin source and connection instructions](plugins/civpulse/README.md) include
research, editing and mapping skills. Run `bun run plugin:build` to generate and
validate the portable archive. See [MCP documentation](docs/mcp.md) for OAuth,
permissions, deployment and the full integration test.

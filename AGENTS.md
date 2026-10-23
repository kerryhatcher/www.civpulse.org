# Project Instructions

Repo-wide guidance for AI agents (Pi, Codex, Claude, etc.). Humans should read
the [README](./README.md) too.

## Tooling

- Use **bun** for everything: `bun install`, `bun add` / `bun add --dev`,
  `bun run <script>`, `bunx astro <command>`. Do not use npm/npx/node scripts.

## Read before changing things

- [docs/architecture.md](./docs/architecture.md) — hosting and rendering model.
- [docs/development.md](./docs/development.md) — local loop, verification, and
  environment gotchas.
- [docs/backend.md](./docs/backend.md) — schema, RLS, visibility, search, and
  migration conventions.

## Architecture constraints (do not break)

- The frontend is a **static Astro build** deployed as **Cloudflare Workers
  static assets**. There is no server adapter and every page is prerendered at
  build. Do not introduce SSR/on-demand rendering without deciding the hosting
  model is changing first.
- Runtime data is fetched in the browser with the Supabase anon key. Data that
  must not be public (private maps/layers) is fetched through an RPC, never
  embedded in prerendered HTML.
- Admin edits are live in Postgres but only appear on the public site after a
  rebuild/deploy. This is expected.
- `public/_redirects` is applied by Cloudflare only, not by `astro dev` or
  `astro preview`. Do not rely on it for links that must resolve locally.
- Add Astro integrations with `bunx astro add <name> --yes`; do not hand-edit
  `astro.config.mjs` to add an official integration.

## Backend rules

- Migrations are **append-only**; never edit an applied migration. Use
  `supabase migration up` to apply to a running local DB (keeps data) or
  `bun run db:reset` for a clean slate.
- Row Level Security on every table. Admin writes check `public.is_admin()`.
- Hidden rows (unlisted, private-for-anonymous) go through `security definer`
  RPCs that apply the visibility rule themselves and set `search_path = ''`.
- Only `PUBLIC_*` values belong in `apps/web`; the service-role key is for local
  tooling/CI and must never be committed or shipped to the browser.

## Workflow

- `bun run dev` from the repo root starts local Supabase (if needed) and runs the
  Astro dev server. Local admin login: `test@civpulse.org` /
  `civicpulse-test-123` (`bun run db:seed-user`).
- Every site change must include a relevant Markdown documentation update in the
  same change. Update `apps/web/src/pages/docs/users.md` for visitor workflows,
  `apps/web/src/pages/docs/admins.md` for admin workflows, and the appropriate
  file under `docs/` for architecture, backend, or development changes. Keep
  instructions and links aligned with the implemented site.
- Before calling work done: run `bun run check` and `bun run build`, and exercise
  the affected flow in a browser — anonymous **and** signed-in where access rules
  are involved. No browser console errors.
- Prefer extending existing patterns over new abstractions; keep changes small.

## Local environment

`apps/web/.env` (gitignored) needs `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` from `bun run db:status`. See `apps/web/.env.example`.

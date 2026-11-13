# apps/web — Astro frontend

Read the repo root [AGENTS.md](../../AGENTS.md) first, plus
[docs/architecture.md](../../docs/architecture.md) and
[docs/development.md](../../docs/development.md).

## Dev server

Start everything from the repo root with `bun run dev` (Supabase + Astro). The
wrapper forces the Astro server into the foreground with
`ASTRO_DEV_BACKGROUND=1` so exiting the wrapper also stops the server. If you run
Astro directly, note that Astro v7 may background itself when it detects an
agent; manage it with `bunx astro dev stop|status|logs`. Read the real port from
the output or `.astro/dev.json` (4321/4322 may be taken).

## Rendering

This app builds to **static** Cloudflare Workers assets. Keep it that way: no
server adapter. Per-page data comes from either:

- `getBuildSupabase()` in frontmatter / `getStaticPaths` for content that is safe
  to prerender (`src/lib/supabase-build.ts`), or
- `getSupabase()` in `src/scripts/*` for runtime/browser data and auth
  (`src/lib/supabase.ts`).

Private or unlisted content must not be written into HTML; load it client-side
through an RPC.

## Scripts and UI

- Client logic lives in `src/scripts/*` as vanilla TypeScript modules imported
  from page `<script>` tags. Follow the existing guard/alias pattern so TypeScript
  keeps non-null narrowing inside nested functions.
- Admin pages use the gate/denied/panel pattern and the admin tab bar
  (`src/components/AdminTabs.astro`).
- Styling is plain CSS in `src/styles/global.css` using the Open Exhibition
  ultramarine, lime, paper, and ink tokens. Reuse existing classes (`.org-card`, `.org-row`, `.org-form`,
  `.page-intro`, `.prose`, `.button-link`, …) rather than inventing new ones.
- Prefer `bunx astro add <integration> --yes` over editing `astro.config.mjs`.

## Docs

- Astro docs: https://docs.astro.build
- [Routing and dynamic routes](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Styling](https://docs.astro.build/en/guides/styling/)

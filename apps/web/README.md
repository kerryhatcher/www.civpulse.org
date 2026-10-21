# @civpulse/web

The CivPulse frontend: an Astro static site deployed to Cloudflare Workers
static assets.

```bash
bun run dev       # dev server
bun run check     # astro check
bun run build     # static output in dist/
bun run deploy    # build + wrangler deploy
```

Environment variables (see `.env.example`) are read from `.env` at build time.
Only `PUBLIC_*` values reach the browser.

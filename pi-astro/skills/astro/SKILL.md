---
name: astro
description: Skill for building with the Astro web framework. Helps create Astro components and pages, configure SSR adapters, set up content collections, deploy static sites, and manage project structure and CLI commands. Use when the user needs to work with Astro, mentions .astro files, asks about static site generation (SSG), islands architecture, content collections, or deploying an Astro project.
license: MIT
metadata:
  authors: "Astro Team"
  version: "0.0.1"
  adapted: "Bun-first commands (bun / bunx instead of npm / npx / node)"
---

# Astro Usage Guide

**Always consult [docs.astro.build](https://docs.astro.build) for code examples and the latest API.**
If the Astro Docs MCP server is available, use `search_astro_docs` to check current documentation before relying on memorized APIs.

Astro is the web framework for content-driven websites.

> **This repository uses [Bun](https://bun.sh).** Prefer `bun` / `bunx` over `npm` / `npx` / `node`. Do not invoke `node` directly to run Astro; run the local CLI with `bunx astro`. Run project scripts with `bun run <script>`.

---

## Quick Reference

### File Location
The CLI looks for `astro.config.js`, `astro.config.mjs`, `astro.config.cjs`, and `astro.config.ts` in `./`. Use `--config` for a custom path.

### CLI Commands

Run the locally installed Astro CLI with `bunx astro` (`bun x astro` is equivalent). If the command exists as a `package.json` script, `bun run <script>` also works.

- `bunx astro dev` - Start the development server.
- `bunx astro build` - Build your project and write it to disk.
- `bunx astro check` - Check your project for errors.
- `bunx astro add` - Add an integration.
- `bunx astro sync` - Generate TypeScript types for all Astro modules.
- `bunx astro preview` - Preview the production build locally.

**Re-run `bunx astro sync` (or restart the dev server) after adding/changing plugins.**

### Project Structure

Reference [project structure docs](https://docs.astro.build/en/basics/project-structure).

- `src/*` - Project source code (components, pages, styles, images, etc.)
- `src/pages` - **Required.** Defines all pages and routes.
- `src/components` - Components (convention, not required).
- `src/layouts` - Layout components (convention, not required).
- `src/styles` - CSS/Sass files (convention, not required).
- `public/*` - Non-code, unprocessed assets (fonts, icons, etc.); copied as-is to build output.
- `package.json` - Project manifest.
- `astro.config.{js,mjs,cjs,ts}` - Astro configuration file. (recommended)
- `tsconfig.json` - TypeScript configuration file. (recommended)

---

## Core Config Options

| Option | Notes |
|--------|-------|
| `site` | Your final, deployed URL. Used to generate sitemaps and canonical URLs. |

### Example `astro.config.ts`

```ts
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
});
```

---

## Common Workflows

### Creating a new project

```bash
bun create astro@latest
```

Pick a template when prompted. Prefer starting from a template over building from scratch.

### Creating a Basic Page

Add a file to `src/pages/` — the filename becomes the route:

```astro
---
// src/pages/index.astro
const title = 'Hello, Astro!';
---
<html>
  <head><title>{title}</title></head>
  <body>
    <h1>{title}</h1>
  </body>
</html>
```

### Creating a Component

```astro
---
// src/components/Card.astro
const { title, body } = Astro.props;
---
<div class="card">
  <h2>{title}</h2>
  <p>{body}</p>
</div>
```

### Adding an integration

Use `astro add` for official integrations. It updates `astro.config.*` and installs the dependency with Bun.

```bash
bunx astro add tailwind --yes
bunx astro add react --yes
bunx astro add mdx --yes
```

For packages that are not official integrations, install them with Bun instead of editing `package.json` by hand:

```bash
bun add <package>
bun add -d <dev-package>
```

### Deploying with an Adapter

1. Add the adapter: `bunx astro add vercel --yes` (or `node`, `cloudflare`, `netlify`)
2. Run `bunx astro check` to catch type and configuration errors before building.
3. Run `bunx astro build` to produce the deployment artifact.
4. Verify the build output directory (e.g. `dist/`) exists and is non-empty before proceeding.
5. Deploy the output per the adapter's documentation.

---

## Adapters

Deploy to your favorite server, serverless, or edge host with build adapters. Use an adapter to enable on-demand rendering in your Astro project.

**Add [Node.js](https://docs.astro.build/en/guides/integrations-guide/node) adapter using astro add:**
```bash
bunx astro add node --yes
```

**Add [Cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare) adapter using astro add:**
```bash
bunx astro add cloudflare --yes
```

**Add [Netlify](https://docs.astro.build/en/guides/integrations-guide/netlify) adapter using astro add:**
```bash
bunx astro add netlify --yes
```

**Add [Vercel](https://docs.astro.build/en/guides/integrations-guide/vercel) adapter using astro add:**
```bash
bunx astro add vercel --yes
```

[Other community adapters](https://astro.build/integrations/2/?search=&categories%5B%5D=adapters)

---

## Development server for agents

Astro v7+ detects AI coding agents and starts `astro dev` (and, since v7.2.0, `astro preview`) as a detached background process, so the command does not block your terminal. It writes a lock file (`.astro/dev.json` or `.astro/preview.json`) with the URL, port, and PID, and starts at most one server per project.

Opt out with:

```bash
ASTRO_DEV_BACKGROUND=0 bunx astro dev
ASTRO_PREVIEW_BACKGROUND=0 bunx astro preview
```

The dev server exposes a readiness endpoint that returns `{"ok": true}` as JSON:

```bash
curl -fsS http://localhost:4321/_astro/status
```

This endpoint exists only in the dev server, not in production builds.

---

## Resources

- [Docs](https://docs.astro.build)
- [Config Reference](https://docs.astro.build/en/reference/configuration-reference/)
- [llms.txt](https://docs.astro.build/llms.txt)
- [GitHub](https://github.com/withastro/astro)
- [Astro Docs MCP](https://docs.astro.build/en/guides/build-with-ai/)

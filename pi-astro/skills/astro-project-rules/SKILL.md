---
name: astro-project-rules
description: Project rules and operating workflow for AI agents building Astro sites. Use when editing an Astro project, running the Astro CLI, adding integrations, starting the dev server, or deploying. Complements the astro skill with Bun-first conventions, API verification, and safe build/dev practices.
license: MIT
metadata:
  authors: "Astro Team; adapted for Bun and agents"
  version: "0.1.0"
---

# Astro project rules for agents

Follow these rules in addition to the `astro` skill when working in an Astro project.

## Always use the current docs

- Consult [docs.astro.build](https://docs.astro.build) for examples and the latest API.
- If the Astro Docs MCP server is connected, call `search_astro_docs` before using APIs that have changed recently: **sessions**, **actions**, **content collections**, **adapters**, and anything formerly experimental.
- Do not rely on memorized APIs for these; verify first.

## Bun-first commands

- Run the local Astro CLI with `bunx astro <command>` (not `npx astro`, not `node`).
- Install dependencies with `bun add <pkg>` / `bun add -d <pkg>` and `bun install`.
- Run `package.json` scripts with `bun run <script>`.
- Do not edit `package.json` by hand to add integrations; use `bunx astro add <integration> --yes`.

## Build and validate

1. Add integrations with `astro add` — do not hand-edit `astro.config.*` for official integrations.
2. Run `bunx astro check` to catch type/config errors before building.
3. Run `bunx astro build`.
4. Confirm the output directory (usually `dist/`) exists and is non-empty before deploying.

## Dev server

- Prefer `bunx astro dev`. On Astro v7+ with an agent detected, it runs detached in the background and writes `.astro/dev.json`; do not fight the backgrounding.
- Check readiness with `curl -fsS http://localhost:4321/_astro/status` (returns `{"ok": true}`). The port may differ; read it from `.astro/dev.json`.
- Stop or restart a background server deliberately; don't start duplicates.

## Prefer templates

Start from an existing Astro template (`bun create astro@latest`) rather than scaffolding a project manually from scratch.

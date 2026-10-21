# pi-astro

A [Pi](https://pi.dev) package that bundles the official **Astro Docs MCP server**
with Bun-first **Astro skills**.

## What it includes

| Resource | Path | Purpose |
|---|---|---|
| Extension | `extensions/astro-docs.ts` | Registers the remote Astro Docs MCP server (`https://mcp.docs.astro.build/mcp`) for every Pi session. Exposes `search_astro_docs` with `direct` exposure so the model can query current Astro docs at any time. |
| Skill | `skills/astro/SKILL.md` | Astro framework usage guide (components, pages, config, adapters, CLI, project structure), adapted to use Bun. |
| Skill | `skills/astro-project-rules/SKILL.md` | Agent operating rules for Astro projects: Bun-first commands, `astro add`, `astro check` before build, API verification, dev-server behavior. |

The Astro MCP server documentation lives at
<https://docs.astro.build/en/guides/build-with-ai/>. The Astro skill is adapted from
the [astrolicious/agent-skills](https://github.com/astrolicious/agent-skills) `astro` skill
(MIT, Astro Team), rewritten to use `bun` / `bunx` instead of `npm` / `npx` / `node`.

## Use it in this repository

This repo loads the package through project settings, so once the project is trusted,
Pi automatically picks up the MCP server and skills. See `.pi/settings.json`:

```json
{
  "packages": ["../pi-astro"]
}
```

Run `/reload` in a Pi session after changing the package, and use `/mcp` to inspect the
`astro-docs` server.

## Install it elsewhere

```bash
# Local checkout
pi install ./pi-astro

# Or a git source once pushed
pi install git:github.com/<owner>/<repo>@<ref>
```

## Requirements

- Pi `1.3.0` or newer (for `pi.registerMcpServer`).
- Internet access to reach the remote Astro Docs MCP server.
- [Bun](https://bun.sh) for the commands in the skills.

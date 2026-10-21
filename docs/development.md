# Development and verification

See the [README](../README.md) for setup and the root scripts. This page covers
the local loop, how to verify changes, and the environment gotchas we hit.

## Local loop

```bash
bun install
bun run dev          # local Supabase (if needed) + Astro dev in the foreground
```

`scripts/dev.mjs` starts Supabase when it is not running, prints the local test
user, then runs Astro with `ASTRO_DEV_BACKGROUND=1` so the server stays in the
foreground. Supabase is left running when the dev server exits
(`CIVICPULSE_STOP_BACKEND=1 bun run dev` stops it too).

Local test user (admin), created/confirmed by `bun run db:seed-user`:

| Field | Value |
| --- | --- |
| Email | `test@civpulse.org` |
| Password | `civicpulse-test-123` |

Local endpoints from `bun run db:status`: API `http://127.0.0.1:54321`, DB
`127.0.0.1:54322`, Studio <http://127.0.0.1:54323>.

## Verifying a change

1. `bun run check` — `astro check` must report 0 errors.
2. `bun run build` — the static build must succeed and write `apps/web/dist`.
3. Exercise the flow in the browser and watch the console for errors.
4. For data access rules, check both anonymous and signed-in behaviour (browser
   and/or the REST/RPC endpoints with the anon key vs a user token).
5. For Cloudflare-only behaviour (`_redirects`, `_headers`, asset routing),
   build and run `bunx wrangler dev` from `apps/web` instead of `astro preview`.

### Ad-hoc browser checks

Playwright is not a dependency of this repo. For quick verification, run a
throwaway Node script from the Astro app (or a checkout that has Playwright)
against the dev server, using the system Chrome channel — the bundled Chromium
download may be absent:

```bash
bunx playwright screenshot --channel=chrome --viewport-size=1280,900 \
  --full-page http://localhost:4323/ /tmp/page.png
```

For scripted flows, `chromium.launch({ channel: 'chrome' })` works the same way.
Add `playwright` as a devDependency only if you are committing tests.

## Secret scanning

TruffleHog guards the repo against committed credentials.

- **Pre-commit hook** (`.githooks/pre-commit`) scans staged files. `bun install`
  installs it through the `prepare` script; run `bun run hooks:install` if the
  hooks path is ever unset. Bypass a false positive with
  `SKIP_SECRET_SCAN=1 git commit …` (or `git commit --no-verify`).
- **Manual scans:** `bun run secret:scan` (staged files) and
  `bun run secret:scan:all` (full git history).
- **CI** (`.github/workflows/secret-scan.yml`) scans pushes to `main` and pull
  requests, and does a full-history sweep weekly and on demand.

TruffleHog is a separate binary — install it from
<https://github.com/trufflesecurity/trufflehog#floppy_disk-installation>. If it
is missing, the hook warns and skips so commits are not blocked.

## Dependency and config scanning

`bun run security:trivy` scans dependencies (`bun.lock`), IaC/config, and secrets
with [Trivy](https://trivy.dev). The Supabase anon-key JWT false positives are
scoped out in `.trivyignore.yaml`; a JWT anywhere else is still reported. CI runs
the same scan (`.github/workflows/trivy.yml`) on pushes, pull requests, and
weekly. All GitHub Actions in this repo are pinned by commit SHA; `bun run
check:pins` enforces this and runs in CI (`.github/workflows/action-pins.yml`).

[Semgrep](https://semgrep.dev) runs in CI (`.github/workflows/semgrep.yml`) using
the digest-pinned `semgrep/semgrep` image with the `p/default`, `p/secrets`, and
`p/owasp-top-ten` rulesets — no token required. On this machine semgrep-core
crashes on `io_uring_queue_init` (the sandbox blocks io_uring), so run local
scans with `--jobs 1`; CI uses the defaults.

## Gotchas

- **Ports 4321/4322 may be taken** by other projects on a shared machine; Astro
  picks the next free port (often 4323). Read the actual URL from the dev output
  or `apps/web/.astro/dev.json`.
- **Astro dev caches the prerendered route set.** After creating a new public
  map/org (a new `/maps/<slug>/` or `/orgs/<slug>/` page), restart the dev
  server (`bunx astro dev stop` in `apps/web`, then `bun run dev`) to see it.
  `bun run build` always generates the current set.
- **`_redirects` is Cloudflare-only.** It is not applied by `astro dev` or
  `astro preview`; verify it with `wrangler dev`.
- **`db:reset` wipes data.** To apply a new migration to a running local DB
  without losing content, use `bun run db:migrate`. Use `db:reset` when a clean
  slate is fine.
- **Migrations are append-only.** Never edit a migration that has been applied;
  add a new one.
- **Podman/Docker socket.** `docker` on this machine is a Podman shim and the
  Supabase CLI talks to the Podman API socket. If `supabase start` fails with
  `statfs .../podman/podman.sock: no such file or directory`, run
  `systemctl --user enable --now podman.socket`.
- **`supabase start` can race.** `Starting database from backup...` followed by
  `failed to copy secret file into container` or a prune error is usually
  transient: wait a few seconds and retry. `supabase stop` may report
  `unknown flag: --all` from `podman volume prune`; if the containers are down
  the stop still succeeded.
- **Don't hand-edit integrations.** Add Astro integrations with
  `bunx astro add <name> --yes` (see `.pi/settings.json` and the project rules).

## Publishing

The site is static, so admin changes are only visible publicly after
`bun run build` (or a deploy). This is expected, not a bug — see
[architecture.md](./architecture.md).


### Automatic Cloudflare deployments

Cloudflare Workers Builds connects `kerryhatcher/www.civpulse.org` on `main` to
both existing Workers in the Kerry Personal account. Preview deployments are
disabled. The build root is `/` so Bun installs the workspace lockfile; both
builds use Node 24 and the existing Cloudflare-managed `Astro-starter` build token.
No deployment credentials are stored in the repository or GitHub variables.

| Worker | Domain | Build command | Deploy command | Watch paths |
| --- | --- | --- | --- | --- |
| `civpulse-web-new` | `new.civpulse.org` | `bun run check && bun run build` | `bun run --cwd apps/web wrangler deploy` | `apps/web/**`, `package.json`, `bun.lock`, `supabase/migrations/**` |
| `civpulse-mcp` | `mcp.civpulse.org` | `bun run mcp:check` | `bun run mcp:deploy` | `apps/mcp/**`, `package.json`, `bun.lock` |

The web build has `PUBLIC_SUPABASE_URL` set to the hosted project URL and
`PUBLIC_SUPABASE_ANON_KEY` set to its current `sb_publishable_…` key. Despite the
historical variable name, this accepts Supabase publishable keys as well as
legacy anon keys. MCP uses that same publishable key in its Wrangler `vars`.
These are public values; authorization still uses the caller's user token and
RLS. Using the publishable format avoids JWT secret-scanner false positives
without suppressing scanner rules.

Manage these settings in each Worker's **Settings → Build** in Cloudflare.
Build status appears on the GitHub commit checks and in Cloudflare build logs.
Supabase's GitHub integration deploys migrations separately; a migration and
frontend build can run concurrently, so keep schema changes backward compatible.
Redeploy the web Worker after editing prerendered public content in the admin.

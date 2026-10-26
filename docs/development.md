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

## Codex worktrees (including chats started from iOS)

Select **Civpulse shared local backend** in the chat's Environment picker.
The versioned configuration is `.codex/environments/environment.toml`.
Its setup runs `bun run worktree:setup`: installs the locked dependencies and
reads the original checkout's running Supabase with `supabase status -o env`.
Only the local API URL and anon key are written to the worktree's gitignored
`apps/web/.env.local`. Existing `.env` files are preserved; `.env.local` takes
precedence for these two settings. Rerunning setup refreshes those settings.

Start the backend once with `bun run db:start` in the original checkout, then
use the environment's **Start web** action (`bun run dev:worktree`) in each
worktree. This starts only Astro and leaves the shared backend running.
If the backend is stopped, setup explains where to start it and can be rerun.
Astro selects an available port; use the URL printed by that worktree.

All worktrees share database rows, Auth users, and schema. Run backend lifecycle,
seeding, and migration commands deliberately from the original checkout;
`db:reset` affects every worktree. Setup never starts, resets, migrates, or seeds
the shared database. The setup script requires Bun, Git, and a running local
Docker/Podman backend on the connected computer, not on the phone.

Commit the environment and setup script to the branch used to create new
worktrees so Codex can discover them there.

## Verifying a change

For the public document archive Worker, local tests and activation sequence, see
[public-documents.md](./public-documents.md). Publication and content search ship
disabled; builds do not upload or backfill any meeting files.

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

### Homepage election callout

The homepage embeds only public elections with a public `early_voting` key-date
event visible through `get_election` (its calendar must also be public). The
earliest early-voting start is interpreted in `America/New_York`; a missing
date, or one after Election Day, omits that election's callout. Publish the
election, calendar, and early-voting event, then rebuild and deploy the frontend
to include or update the callout's metadata.

Once published, browser code shows the callout from seven calendar days before
early voting through Election Day, inclusive, using `America/New_York` for all
visitors. UTC calendar arithmetic keeps the seven-day offset stable across DST.
The page starts with callouts hidden, then checks the date on load, every minute,
and on tab visibility changes. Crossing a timing boundary needs no rebuild;
changing the election or early-voting data does. Multiple qualifying elections
appear in Election Day/name order.

Verify the day before the window (hidden), its first day (visible), early-voting
start, Election Day (visible with today's status), and the following day
(hidden), including a visitor outside the Eastern time zone. Check missing and
non-public dates, multiple elections, narrow screens, keyboard focus, and the
election-details link. Confirm anonymous and signed-in visitors receive the same
public callouts and no hidden metadata appears in the built HTML.

## Testing short links locally

Run `bun run build`, then `bun run --cwd apps/web cf:dev` to exercise `/l/*`
through the Cloudflare runtime. Astro dev/preview do not run the redirect handler.
Create ignored `apps/web/.dev.vars` with only `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` copied from the local frontend `.env.local` (or `.env`).
Use a loopback Supabase project; do not use the service-role key. Wrangler's
checked-in public defaults target production, so local overrides are required
before testing visits. Avoid loading unrelated bootstrap secrets by setting
`CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false` for Wrangler.

Use `/admin/links/` on Wrangler's printed port to create/edit links, refresh
counts, pause/reactivate, and download PNG/SVG QR files. QR codes intentionally
use the production canonical site URL; replace the origin with Wrangler's local
origin when testing the redirect locally. Confirm ordinary signed-in users
cannot access the form and anonymous users go to signin. Downloading a QR must
not increment statistics. Check `curl -I` leaves counts unchanged and GET adds
one, including repeated and concurrent requests. Confirm existing shared codes
resolve to the new destination after an edit without rebuilding.

`bun run check` includes Worker TypeScript checks. Regenerate binding types with
`CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false bunx wrangler types --include-runtime
false --strict-vars false` from `apps/web` after changing bindings. Run
`bun test scripts/tests/short-links.test.ts`; use `SHORT_LINKS_TEST_DATABASE_URL`
for the opt-in database permissions/concurrency tests documented in backend.md.
The Short links GitHub workflow runs the redirect tests and Worker type checks on
pull requests and pushes to main. Database concurrency and permission checks run
against the local test database before release.

The October 25 short-link release also pins patched transitive dependencies:
`body-parser` 2.4.0 and Undici 7.30.1 for consumers on major version 7. Undici 8
consumers keep their existing major version. These root `overrides` resolve the
Trivy release blockers without suppressing advisories. The version-scoped rule
uses Bun lockfile version 3; Bun 1.4.3 is verified for installation and CI.

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
the static website Worker in the Kerry Personal account. Preview deployments are
disabled. The build root is `/` so Bun installs the workspace lockfile;
the build uses Node 24 and the existing Cloudflare-managed `Astro-starter` build token.
No deployment credentials are stored in the repository or GitHub variables.

| Worker | Domain | Build command | Deploy command | Watch paths |
| --- | --- | --- | --- | --- |
| `civpulse-web-new` | `www.civpulse.org`, `new.civpulse.org` | `bun run check:migrations && bun run check && bun run build` | `bun run check:migrations && bun run --cwd apps/web wrangler deploy` | `apps/web/**`, `package.json`, `bun.lock`, `supabase/migrations/**`, `scripts/check-migrations.mjs` |


The web build has `PUBLIC_SUPABASE_URL` set to the hosted project URL and
`PUBLIC_SUPABASE_ANON_KEY` set to its current `sb_publishable_…` key. Despite the
historical variable name, this accepts Supabase publishable keys as well as
legacy anon keys. The MCP Edge Function uses the public anon key injected by Supabase.
These are public values; authorization still uses the caller's user token and
RLS. Using the publishable format avoids JWT secret-scanner false positives
without suppressing scanner rules.

Manage these settings in the web Worker's **Settings → Build** in Cloudflare.
Build status appears on the GitHub commit checks and in Cloudflare build logs.
Supabase's GitHub integration deploys migrations and declared Edge Functions. The web
pipeline runs `bun run check:migrations` before building and deploying. The guard
waits up to ten minutes for the official Supabase GitHub app's `Supabase Preview`
check to succeed for the checkout's full commit SHA. A migration-history mismatch,
failed/skipped/cancelled check, unrecoverable API error, or timeout blocks deployment. A missing
check never counts as success. Keep the Supabase production integration enabled
for every push to `main`; after resolving a failure, rerun the Cloudflare build.
Keep schema changes backward compatible with the currently deployed frontend.

The guard uses GitHub's public checks API, without database credentials. An optional
read-only `GITHUB_TOKEN` raises API rate limits (set it as a
build secret, never a `PUBLIC_*` value). Cloudflare build runners can share an
egress IP and exhaust GitHub's anonymous quota. The guard retries confirmed
HTTP 403/429 rate limits up to four times within its ten-minute budget, respecting
`Retry-After` and `x-ratelimit-reset`; secondary limits without a reset use
exponential backoff starting at one minute. It never treats a rate-limit response
as migration success. Permission-denied 403s still fail immediately. Rate limits
beyond the budget report the next retry time and block deployment; configure a
repository-scoped fine-grained token with the minimum required read access as the
Cloudflare build secret `GITHUB_TOKEN` when persistent rate limiting occurs.
Do not copy a broad personal CLI token into build settings or disable the gate.
Local `bun run deploy` and
`bun run mcp:deploy` use the same guard; unpushed commits cannot pass it.
`bun test scripts/tests/check-migrations.test.ts` covers mismatch rejection,
trusted-app/commit matching, reruns, waiting, API failures, timeout behavior, and
rate-limit recovery/budgets; the Migration deployment gate workflow runs these
tests on pushes and PRs.

Production's Cloudflare build secret `GITHUB_TOKEN` uses the fine-grained token
**civpulse-cloudflare-migration-checks**, restricted to `kerryhatcher/www.civpulse.org`,
with read-only Metadata permission and no user or write permissions. Because this
repository is public, its check-run endpoint accepts this narrower token; access
was verified against the guard's exact API request. It expires **October 23, 2027**.
Rotate it in GitHub's fine-grained token settings and replace the encrypted
Cloudflare **Settings → Builds → Variables and secrets** value before expiration.
If the repository becomes private, re-evaluate the required Checks read access.

Keep production's applied migration files on `main`. Applying a feature-branch
migration to production before its file reaches `main` blocks subsequent Supabase
checks with “Remote migration versions not found in local migrations directory.”
If this happens, restore the exact applied file from its source branch after
comparing it with `supabase_migrations.schema_migrations`; do not delete history
entries or rerun applied SQL to make the check pass.
Redeploy the web Worker after editing prerendered public content in the admin.

### Manual publishing setup

The [Publish admin page](/admin/publish/) calls the `publish` Supabase Edge
Function. It verifies the user with Auth, checks `public.is_admin()` on each
request, and either requests a production build or returns its status. It reuses
active production builds, including builds started by Git pushes or other admins.
No automatic database triggers are installed.

Configure the following **Supabase Edge Function secrets**, never `PUBLIC_*`
variables, source files, or browser configuration:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Kerry Personal account ID (`6d837580a4d0641139ecada9e74076b8`) |
| `CLOUDFLARE_WORKER_TAG` | Immutable tag for `civpulse-web-new` (`2bf0468f854440eebeb10454be815eaa`), not the Worker name |
| `CLOUDFLARE_BUILDS_READ_TOKEN` | **User-owned** Cloudflare API token with **Workers Builds Configuration → Read** (API permission: Workers CI Read), restricted to this account; used only for status |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | A Workers Builds Deploy Hook URL for **`civpulse-web-new`, branch `main`** |
| `PUBLISH_ALLOWED_ORIGINS` | Optional comma-separated exact origins; defaults to `https://www.civpulse.org,https://new.civpulse.org` |

Create the hook under **Workers & Pages → civpulse-web-new → Settings → Builds →
Deploy Hooks**. The hook URL is a credential. Store it and the read token in a
gitignored env file, then upload with
`SUPABASE_TELEMETRY_DISABLED=1 bunx supabase secrets set --project-ref drzcrodqflzkzzbqsags --env-file /absolute/path/to/publish.env`.
Do not print or log that file. Supabase injects its own `SUPABASE_URL` and public
`SUPABASE_ANON_KEY`; the function does not need a service-role key.

Create the status token under **My Profile → API Tokens → Create Token → Custom
token**. Choose **Account → Workers Builds Configuration → Read**, include only
**Kerry Personal**, and give it a descriptive name such as **Civic Pulse publish
build status**. Account-owned tokens are not supported by the Builds API and
return `Invalid token` even when Cloudflare's token-verification endpoint accepts
them. Verify status access before saving the token; no edit permission is needed.

The `functions.publish` entry in `supabase/config.toml` declares the function for
the existing Supabase GitHub deployment integration. For a deliberate standalone
deployment, run `bun run check:migrations` first, then
`SUPABASE_TELEMETRY_DISABLED=1 bunx supabase functions deploy publish --project-ref drzcrodqflzkzzbqsags`.
The handler also validates the session itself; keep `verify_jwt = true` in hosted
configuration. Deploy the frontend through the existing guarded pipeline.

Keep both existing Cloudflare commands unchanged:
`bun run check:migrations && bun run check && bun run build` and
`bun run check:migrations && bun run --cwd apps/web wrangler deploy`.
Hook-triggered builds still check the exact Git checkout's Supabase migration
status. Rebuilding the same commit needs no new commit or new migration check
when its existing check is successful. The publish function never overrides
build commands or accepts branch/Worker choices from callers.

The admin page polls every 10 seconds during a build and pins the returned build
ID in session storage until it finishes. On a fresh visit it loads the latest
`main` build. Status reads reject build IDs belonging to another Worker/branch.
Only a stopped build with outcome `success` is shown as published; failures,
cancellations, skipped builds, and unknown outcomes never imply publication.
A failed status read disables publishing until a successful refresh. Ambiguous
publish requests are not retried automatically. Cloudflare deduplicates hook
requests while queued/initializing; there is no database lock across concurrent
admins. Save edits before publishing and publish again after an active build if
you edited content during it. This feature does not track unpublished revisions.

For local development, use a separate hook/Worker if testing real deployments;
never point routine local tests at the production hook. Use a gitignored env
file with `PUBLISH_ALLOWED_ORIGINS=http://localhost:4321` (substitute the actual
Astro origin) and run
`SUPABASE_TELEMETRY_DISABLED=1 bunx supabase functions serve publish --env-file /absolute/path/to/publish.env`.
`bun run publish:check` type-checks the handler. `bun run publish:test` exercises auth, scope isolation, sanitized statuses,
request failures, and deduplication with mock upstream calls and never deploys.

### Profile media development and deployment

- `bun run media:check` and `bun run media:test` check the upload Worker.
- `bun run media:deploy` deploys `apps/media/wrangler.jsonc`, including its R2
  binding and `media.civpulse.org` custom domain. Deploy it separately from the
  static frontend; `bun run deploy` continues to deploy only the frontend.
- No database migration or private R2 credentials are needed. Worker vars contain
  the hosted Supabase URL, public publishable key, and allowed site origins.
- For local testing, run `bunx wrangler dev` from `apps/media` with local overrides
  for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ALLOWED_ORIGINS` (the exact Astro
  origin, e.g. `http://localhost:4323`). Use a gitignored `.dev.vars` for overrides.
  Start Astro with `PUBLIC_MEDIA_URL=http://localhost:8787 bun run dev`.
  Wrangler uses a local R2 simulation by default; do not enable remote bindings.
- Admin saves update the directory immediately in admin. Public prerendered
  profiles show the new image after the next frontend rebuild/deployment.

### Production domain cutover

`www.civpulse.org/*` routes to `civpulse-web-new`, the same static Worker serving
`new.civpulse.org`. Both routes are declared in `apps/web/wrangler.jsonc`.
The existing proxied www CNAME and legacy `civicpulse-web` Pages deployment are
retained as a rollback origin; the Worker route takes precedence. To roll back,
remove the www Worker route and revert its Wrangler declaration before the next
build. The apex and HTTP redirects continue sending visitors to HTTPS www.
The public ICS feed remains `/events.ics` on both hostnames.

## Supabase MCP deployment

MCP executes at `https://api.civpulse.org/functions/v1/mcp`. Source is in
`apps/mcp/src`; run `bun run mcp:build` to regenerate the committed
`supabase/functions/mcp/handler.js`. The Supabase GitHub integration deploys
functions declared in `supabase/config.toml` on production pushes, after migrations.
No new deployment credential is required. `bun run mcp:deploy` is the manual
CLI path and requires Supabase CLI authentication. The former Cloudflare MCP
build trigger was removed; its Worker serves only compatibility redirects.

Run `bun run mcp:check`, `bun run scripts/build-mcp.mjs --check`,
`bun test scripts/tests/mcp-handler.test.ts`, and `bun run mcp:test` (local DB)
before release. The routing checks cover gateway path stripping, OAuth discovery
and allowed origins. The full suite covers user/admin RLS, refresh and revocation.
Browser CORS responses use literal values from the approved origin allowlist;
they never echo an unchecked request header. Unknown origins receive 403.

## Maintaining the public AI setup guide

`apps/web/src/pages/docs/ai.md` is the visitor-facing guide for AI plugins, MCP,
OAuth, skills and troubleshooting. `DocsLayout.astro` links it from every docs
page; the visitor and admin guides link to it instead of duplicating setup steps.
The guide points to `CivicPulse/civpulse-openai`, `CivicPulse/civpulse-pi` and
`CivicPulse/skills`. Verify repository READMEs before changing release/install
instructions. Pi now documents Git-package installation, OAuth through `/mcp`,
workflow commands and its default write guard. The shared repository documents
seven standalone public-source skills, installed with `bunx skills add`.
Distinguish those seven skills from the four live-service workflows bundled
with the OpenAI and Pi plugins; MCP authorization is a separate setup step.
Do not present private registered app bindings as public directory availability.

### Records request verification

Apply the records-request migration locally without resetting the shared DB.
Run the rollback database test documented in backend.md, then verify creation as
an admin, owner editing/transfer, public and unlisted anonymous viewing, private
rejection, fee totals and private/shared file downloads. Check narrow and desktop
layouts and browser console output. Synthetic fixtures must be labeled as such
and removed after testing. Bucket enumeration must not reveal unlisted files.

### History verification

Apply the pending audit migrations to the local database with `bun run supabase
migration up --include-all` (use the existing shared-backend checkout deliberately;
do not reset it). Run the rollback-only suite with
`HISTORY_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun
test scripts/tests/history-db.test.ts`.

In the browser, open a person or organization and choose **View history**. Check
an expanded Before/After revision, **Load older changes**, and a relationship
change. Anonymous and ordinary signed-in users must have the same public results.
An admin opening **Audit log** can browse all types, including hidden/deleted
records and editor account IDs. Verify a visibility change hides old revisions
from public access, and that private history never enters the static build.
History is fetched live through an RPC; profile text still follows the normal
static-build lifecycle. No historical revisions exist before tracking is enabled.

## Testing member voting records

Run `bun test scripts/tests/member-mentions.test.ts` for participant-name matching.
The Meeting profiles CI workflow uses `bun run --bun check` to run Astro with
Bun rather than the runner's preinstalled Node version.
With local Supabase running, run
`MEETINGS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/person-votes-db.test.ts`
to check profile voting permissions, paging, live edits and meeting visibility.
The database test creates fixtures and applies the voting-history migration if
needed inside a transaction that always rolls back, preserving shared local data.

# Georgia SOS collection operations

The static Astro site stays static. Supabase Cron authenticates the small
`poll-election-results` Edge Function every five minutes; it performs HEAD checks
and queues durable Postgres jobs. The Bun container in `apps/results-collector`
claims those jobs, downloads and validates the export, archives source bytes in
the existing **civpulse-files** R2 bucket, stages bounded batches, uploads and
verifies immutable public projections, commits the database revision, then
publishes its stable discovery pointer. No collector HTTP endpoint is exposed.

Implementation and local measurements do **not** establish a deployed collector,
working production credentials, production CORS/cache acceptance, or enabled
polling. Keep both feed configuration and the container disabled until the
release/readback procedure below is complete.

## Source and identity

The November 3, 2026 source is
`https://results.sos.ga.gov/cdn/results/Georgia/export-11032026GeneralAndSpecialElection.json`.
Its public election page is
<https://results.sos.ga.gov/results/public/Georgia/elections/11032026GeneralAndSpecialElection>.
Confirm the existing Civic Pulse election UUID and date through the admin record;
save that exact URL using the existing Elections editor. No identity is inferred
from a label or from the source URL alone. `configure_sos_results_feed` requires
an existing public election with a saved exact SOS URL; it does not change that
URL. Unlisted/private elections never enter the public archive pipeline.

Null `reportingStatuses` is valid source evidence and remains null. Zero counts
stay zero; absent/null counts stay unknown. Source jurisdiction, contest and
choice IDs remain scoped to their source parents. There are no automatic person
creations, fuzzy name matches, cross-jurisdiction ID equivalences or inferred
winners. State, county, precinct and method totals are overlapping scopes and
are never added together by the collector.

## Container and resource envelope

Build from the repository root after the matching migration and code have reached
main. The image uses Bun 1.4.3 and built-in APIs only:

```sh
docker build -f apps/results-collector/Dockerfile -t civpulse-results-collector .
docker run --name civpulse-results-collector --restart unless-stopped \
  --memory=2g --cpus=1 --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=2g,uid=1000,gid=1000 \
  --env-file /secure/location/results-collector.env \
  civpulse-results-collector
```

Docker or Podman is a hosting recipe, not a claim that a host is provisioned.
Start with 1 vCPU, **2 GiB RAM**, and a writable **2 GiB temporary filesystem**;
measure the chosen production host before reducing limits. A memory-backed
tmpfs is charged to container memory; use a bounded disk-backed scratch volume
instead when testing near the 512 MiB source cap. Allocate 2 GiB RAM in addition
to disk-backed scratch space. Local spool directories are removed on normal
success/failure and may be lost on restart; job, lease, raw receipt and staging
progress live durably in Postgres/R2. Containers open no inbound port.

Use `.env.example` as the shape for the host's secret store. Required server-only
values are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ENDPOINT`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and explicit
`SOS_COLLECTOR_ENABLED=true` when ready to run. R2 credentials must be limited to
object read/write in **civpulse-files**; do not grant account administration or
bucket deletion. The S3 endpoint must be the account's HTTPS R2 endpoint. Public
asset origin is fixed to `https://files.civpulse.org`. Never put these credentials
in `apps/web`, frontend build variables, source control or cron request headers.

`bun run apps/results-collector/src/main.ts once` processes at most one claimed
job; `health` calls the service-only operational reader without claiming work.
The default `run` process checks the durable queue every 15 seconds, renews a
five-minute fenced lease every 30 seconds, and stops taking work on SIGTERM.
Database lease checks protect every staged/published mutation. Queue claiming
uses row locks and a unique unfinished job per election.

## Bounds and recovery

Downloads have a 180-second deadline, refuse redirects, permit only the exact
Georgia SOS export URL pattern, stream SHA-256 and bytes to disk, and reject
empty/truncated responses and downloads over 512 MiB. Parsing retains one
jurisdiction at a time (64 MiB cap), a header up to 1 MiB and metadata up to
128 KiB per jurisdiction. At most 160 jurisdictions are accepted. Counts are
nonnegative safe integers or source null; nested counts, duplicate jurisdictions,
contests and choices are validated. Each source item must fit the existing
2 MiB Bun staging envelope, and batches contain at most 50 items / 2 MiB.
Larger source/schema changes need explicit review instead of silently dropping
records. Source generation time must match the election and cannot be in the
future. Database publication rejects older/conflicting source timestamps.

HTTP 304 records a successful unchanged check. HTTP 429/5xx, malformed JSON,
checksum failures and unavailable assets preserve the last working publication.
Database retry backoff incorporates bounded Retry-After (1–3,600 seconds), then
quarantines repeated failures after eight claims. A job interrupted after staging
began resumes from its **original archived raw key**, checks its exact bytes/hash,
and replays idempotent batches. It cannot be stranded by a newer upstream export.
Its original retrieval receipt is retained so immutable asset retries are stable.

Raw evidence uses
`elections/<election-uuid>/raw/<exact-byte-sha256>.json`. Valid source JSON only
is archived; malformed downloads are rejected before public upload. Immutable
assets use `revisions/<snapshot-uuid>/manifest.json`, `state.json`,
`counties/<source-id>.json` and matching `*-detail.json` objects. Summaries omit
method/precinct arrays; the detail object preserves them for explicit retrieval.
Every immutable PUT uses create-only semantics and verifies size/SHA-256 through
the uncached S3 API, including when an object already exists.

The semantic fingerprint canonicalizes object keys and known source-ID/name
arrays (so harmless contest/choice/precinct/method reordering is unchanged), and ignores only the root
export `createdAt`. It includes source identity, labels, statuses, nulls, zeros,
denominators and detail counts; downward corrections are changes. Changed source
generation times/formatting alone produce evidence receipts without dirtying the
static frontend. Every meaningful committed publication advances the existing
frontend dirty revision once; the normal 20-minute rebuild cadence coalesces work.

## Pointer and browser contract

`elections/<election-uuid>/latest.json` has `schema_version: 1`, election UUID,
`snapshot_id`, monotonic **decimal-string** `revision`, `published_at`,
`source_created_at`, `source_url`, raw provenance and `jurisdictions`. Each
jurisdiction has exact source `id`, `name`, `item_count`, immutable `url`, SHA-256
and `detail_url`. A scope contains schema/election/snapshot identity,
`jurisdiction` metadata and `items: [{jurisdiction_index,item_index,data}]`.
Source data is independent of curated ballot candidates and profile links.

Publication commits the complete database snapshot and durable pointer outbox
together. The pointer is written only afterward. Before each conditional PUT the
worker reads the current pointer through the consistent S3 API, rejects any equal
or newer stored revision, confirms its current DB publication/lease, then uses
`If-Match` on the read ETag or `If-None-Match: *` for first publication. Atomic R2
conditions fence a delayed worker even when its lease expires. A newer pointer
cannot be overwritten by an older revision; contention retries reread it. A crash
after database commit retries only the pointer phase. A crash after successful
PUT but before acknowledgement recognizes the same pointer and finishes without
rewriting it. Failed new assets or pointer work retain the prior working pointer.

Immutable objects request `public,max-age=31536000,immutable`. The pointer requests
`public,max-age=15,s-maxage=15,must-revalidate`. The public bucket/domain must
actually honor these headers and allow browser GET from the site's origins.
Configure bucket CORS for GET/HEAD with `Access-Control-Allow-Origin: *` for these
public-only aggregates; expose ETag and Cache-Control if browser inspection needs
them. Verify the actual custom-domain response, CDN rules and browser request;
object metadata alone does not establish CORS or override a conflicting cache
rule. Never enable collection before this acceptance check.

## Main-first release and controlled acceptance

1. Merge the append-only migrations to GitHub main, then use the existing
   integration or clean/current-main guarded `bun run db:push`. Do not apply
   feature SQL, repair history or use production execute-SQL to skip the guard.
2. Deploy the matching `poll-election-results` Edge Function with its configured
   JWT behavior and deploy the container **disabled**. Verify service-only RPC
   grants and anonymous/authenticated public/private gates locally first.
3. In Supabase Vault create `sos_results_poll_url` pointing at the deployed
   `/functions/v1/poll-election-results` and an independently generated
   `sos_results_poll_token` of at least 32 characters. The cron routine signs
   `sos-results-poll:<unix-seconds>` with HMAC SHA-256; the function checks
   freshness and verifies it against Vault. Cron stores no reusable secret.
4. With an administrator session, call
   `configure_sos_results_feed` with `{p_election_id: <reviewed UUID>,
   p_enabled:false,p_starts_at:<explicit start>,p_ends_at:<explicit end>}`.
   Confirm the returned URL exactly matches the saved election. Choose an
   operational polling window explicitly; official/unchanged status is not a
   stopping condition.
5. For the controlled first import, enable the container and temporarily enable
   the feed with the admin RPC. Let the authenticated cron tick enqueue one job
   and run the container in `once` mode. Inspect health, raw bytes/hash, complete
   DB revision, manifest and all scope assets, then read `latest.json` through
   S3 and the actual public origin. Pause the feed while investigating failures.
   Review the configured start/end window before leaving the daemon enabled.
6. Confirm raw SHA-256 against the downloaded file, source timestamp versus
   successful-check/publication times, `item_count` completeness, CORS and actual
   cache headers/Age. Verify public browser state/county updates, detail links,
   offline retry and existing anonymous/signed-in restrictions. Confirm a
   timestamp-only replay does not advance the frontend dirty revision.
7. Leave the feed enabled only after that acceptance. The installed cron job
   `sos-results-poll` runs `*/5 * * * *`; with no enabled feeds its database
   invocation returns without making an HTTP request. This merge alone enables
   no feed and provisions no worker host or secrets.

Expected freshness is the five-minute polling cadence plus ingestion, source/CDN
propagation and up to 30 seconds of browser polling. This is not instantaneous.

## Health, pause, replay and retention

Run `bun run apps/results-collector/src/main.ts health` using server-side
credentials. Track per-feed attempt/success, revision, last error, pending job,
attempt count, next retry and updated time. Container JSON logs record completion,
duration and RSS or a bounded sanitized failure. Alert through the host's existing
monitoring when errors repeat, pending work/publication lag exceeds 15 minutes,
the process stops, or attempts reach eight. A static/unchanged vote count is not
an alert condition. A working host alert route must be configured before enabling
recurring writes; this repository does not invent or send alert messages.

Pause through admin `configure_sos_results_feed(p_enabled:false)`; stopping the
container alone does not stop source checks. Pause keeps the current pointer and
evidence. After a lease expires, admin `recover_sos_results_job` accepts
`{p_election_id:<UUID>,p_action:"retry"}` to reset attempts and retry immediately.
For an invalid uncommitted import, `p_action:"abandon"` ends that job so a future
poll may enqueue a new source. A committed pointer cannot be abandoned; repair
its credentials/assets and retry its outbox. Re-enable the same reviewed feed to
resume. Source-URL changes require deliberate reviewed configuration/migration,
not an automatic rewrite of existing job identity.

Retain published raw files, manifests, projections and immutable DB snapshots
indefinitely as correction evidence. Public files cannot be recalled from prior
downloads if an election later becomes restricted. Initially retain abandoned
raw uploads/staging too; they remain outside public discovery. Review unused
objects and abandoned unpublished staging after 30 days, while paused, against
both current pointers and every durable job/snapshot receipt before proposing a
separate reviewed deletion. There is deliberately no blanket bucket lifecycle,
automatic evidence deletion or staging-history repair. Temporary local spools
may be removed when the owning process is stopped; durable state does not depend
on them.

## Verification and measured limits

Run `bun run results:check`, `bun run results:test`, the isolated backend tests,
`bun run check` and `bun run build`. Collector tests cover conditional downloads,
304/rate limits/outages/truncation, schema/count validation, semantic changes,
immutable checksum collisions, failed uploads, staging resume, publication and
acknowledgement crash boundaries, decimal revisions and delayed-worker CAS.

Use a downloaded local file without any credentials or external writes:

```sh
bun run apps/results-collector/src/measure.ts /tmp/ga-results-20261103.json 2026-11-03
bun run apps/results-collector/src/measure.ts /tmp/ga-results-20261103.json 2026-11-03 --pipeline
```

`--pipeline` uses a local disk-backed R2 substitute and RPC double. It exercises
streamed download copy, parser, staging JSON serialization, all immutable uploads
and checksum readbacks, database publication interface and pointer CAS. It does
not measure hosted database/network latency, production cost or remote behavior.

Measured November 3 on Linux x86_64, AMD Ryzen 7 5800X, Bun 1.4.3:

| Input | Bytes | Jurisdictions / items | Validation | Local simulated pipeline | Peak process RSS |
| --- | ---: | --- | ---: | ---: | ---: |
| Official November export | 46,363,141 | 160 / 4,178 | 1.52 s | 2.22 s | 379 MiB |
| Larger synthetic export | 174,387,013 | 160 / 4,178 | 3.69 s | 5.63 s | 466 MiB |

The larger fixture preserves the source feed and adds a synthetic 32 KiB
`resourceTestPadding` string to every county ballot item. Its exact SHA-256 is
`4f4ce3c4856a261096848f7b1f033e69ab4e1501f61099411ea771a12a89d2c9`.
This is an allocation/staging-envelope exercise, not additional election evidence.
Peak RSS is the larger of sampled RSS and the operating system's process high
water mark; pipeline runs include an initial separate validation pass. Temporary
raw/source/detail copies require additional disk beyond process RSS.

The exact official raw SHA-256 is
`f464d3b037a82d594c893aef072042530a84b6b1cb3edb76b1e3873bed2dc3ba`;
source generation time is `2026-11-03T10:28:19.3118441Z`. This receipt is evidence
about that downloaded export, not a promise about the next response. Larger
fixture results above do not replace the chosen host's actual cost/latency and
memory-limit acceptance before production activation. Storage grows by raw plus detail bytes and compact
summaries for each distinct byte revision; timestamp-only exports can therefore
increase evidence storage without triggering a rebuild.

API behavior was verified against [Bun S3 documentation](https://bun.sh/docs/runtime/s3)
and [Cloudflare R2 S3 conditional operations](https://developers.cloudflare.com/r2/api/s3/api/).
The latter documents atomic conditional PutObject headers; do not substitute an
unconditional overwrite, cached CDN ETag read, or DB-only stale check.

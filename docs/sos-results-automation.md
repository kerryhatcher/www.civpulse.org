# Georgia SOS collection operations

The static Astro site stays static. Supabase Cron authenticates the small
`poll-election-results` Edge Function through one five-minute Cron heartbeat.
Postgres gates actual HEAD checks by the configured feed cadence and window, then
queues durable jobs; a heartbeat with no due feed makes no HTTP request. The Bun container in `apps/results-collector`
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
URL. Only public elections are admitted to the archive pipeline. Later visibility
changes cannot recall public objects or cancel an upload already in flight; see
the retention guidance below.

Null `reportingStatuses` is valid source evidence and remains null. Zero counts
stay zero; absent/null counts stay unknown. Source jurisdiction, contest and
choice IDs remain scoped to their source parents. There are no automatic person
creations, fuzzy name matches, cross-jurisdiction ID equivalences or inferred
winners. State, county, precinct and method totals are overlapping scopes and
are never added together by the collector.

## Poll cadence and immediate activation

The existing `sos-results-poll` Cron entry remains `*/5 * * * *`; do not add a
second scheduler. `claim_sos_results_poll` and the authenticated invocation both
check the same database due time. Default cadence remains five minutes for existing
clients. An administrator can configure a paused feed with
`configure_sos_results_poll_cadence(p_election_id,p_interval_seconds,p_transition_at,p_after_interval_seconds)`.
Both intervals are 300–86,400 seconds in five-minute increments. There is a bounded
one-minute eligibility allowance for Cron/network jitter; the single five-minute
heartbeat determines the actual recurring checks. Skipped heartbeats do not change
`last_attempt_at` or manufacture successful source checks.

For the approved November rollout, first save the reviewed existing election and
exact export URL, then create/configure its feed disabled. Configure initial
interval **3,600 seconds**, transition **2026-11-03T22:00:00Z**, and subsequent
interval **300 seconds**. Keep the feed and production collector disabled during
implementation and controlled acceptance. At actual activation use the existing
four-argument `configure_sos_results_feed` with the reviewed UUID,
`p_enabled:true`, `p_starts_at` equal to actual activation, and exclusive
`p_ends_at:2026-11-11T00:00:00Z`. If activation happens after 22:00Z, the effective
cadence is immediately five minutes; there is no replay of missed hourly checks.
The transition itself becomes due even if a pre-transition hourly check was recent.

A false-to-true activation records `poll_requested_at` separately from real
`last_attempt_at` and immediately queues the existing authenticated coordinator
through pg_net when its Vault URL/token are configured. Inspect the returned
`poll_request_id` and verify the actual source check and resulting durable work;
an ID alone proves only that a request was queued. Repeating an already-enabled
configuration does not enqueue another activation request. When Vault is absent,
configuration stays compatible with isolated setups: the request remains durably
due and the returned ID is null. A real production activation requires working
Vault credentials before enabling and must not accept that null result as success.
No migration in this feature enables a feed or installs production secrets.

Both public `get_sos_results_health` and service-only
`get_sos_collection_health` add effective `poll_interval_seconds`, transition,
window, `source_checks_expected`, `source_check_expected_since`, and
`next_poll_at` fields. Existing fields and caller grants are retained. The
freshness anchor accounts for activation and a cadence transition without changing
source-check provenance. Source-check delay uses `max(900,2*interval+300)` seconds:
normal hourly silence stays healthy, while the five-minute phase uses a 15-minute
threshold. Publication backlog independently becomes delayed after 15 minutes
from the unfinished job’s original `created_at`, even while its lease renews.
Stalled `updated_at` also has a separate 15-minute threshold. The service health
response exposes `job_created_at` alongside `job_updated_at` so monitoring can
distinguish backlog age from lease/progress freshness. Disabled, future-window,
and expired feeds are paused, with
`source_checks_expected:false`; unchanged vote counts are never an alarm.

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
The image runs that read-only health command every minute, allowing 70 seconds
for its 60-second database request deadline and marking the container unhealthy
after three failed checks. This checks database connectivity and RPC access;
the host's monitoring must still inspect collection errors and publication lag.
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
An equal timestamp is accepted only when the latest snapshot is owned by
automation and its semantic fingerprint matches. A different fingerprint at
the same timestamp is a conflict; an older timestamp is always rejected. Where
the prior snapshot was published manually and has no known fingerprint, an
equal-time replacement cannot establish equivalence and is rejected.

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

## Reviewed ballot mappings

The elections admin includes a reviewed JSON batch editor (1,000 rows / 2 MiB),
using the existing authenticated RPCs below. Validation pins one source snapshot,
reads only the requested scopes, and resolves the complete gated `get_election`
ballot, avoiding directory pagination limits on candidate names. Public source
assets use the fixed configured results origin; restricted elections retain the
gated paginated RPC. Source and target identities are displayed for human review;
the editor never infers a match. Existing replaced links appear in the preview.
Writes run sequentially, stop on first error and are followed by saved readback.
Partial batches retain prior accepted rows; unchanged retries are idempotent.
Immediately before the write loop, the editor rereads the canonical ballot and
the latest source snapshot, pinning that snapshot while reading the selected
scopes. It compares the reviewed election binding, offices/question wording,
candidate identities and source race/option IDs, labels, party and contest type.
Identity changes require a new preview and approval. New source revisions that
change only counts or reporting remain valid; a snapshot ID itself is not a
mapping identity. This is an optimistic preflight, not a transactional lock across
the batch: another edit or publication can still occur after the check. Mappings
intentionally persist across publications, and the RPC continues checking ballot
ownership and choice membership on each write. Verify the current public ballot
after saving rather than treating the preview as an atomic snapshot reservation.
No RLS, database grants, source collection, or public asset contracts change.

After checking the official source and Civic Pulse ballot record, an administrator
can call `put_sos_results_mapping` with `p_election_id`, `p_jurisdiction_id`,
`p_source_contest_id`, exactly one of `p_contest_id` or `p_question_id`, and
`p_choices`. For a contest, each choice is
`{"source_choice_id":"<SOS choice ID>","person_id":"<existing candidate UUID>"}`;
for a question it is `{"source_choice_id":"<SOS choice ID>","choice_label":"<existing question choice>"}`.
Use the exact source IDs within the selected jurisdiction and review each link;
the RPC validates election ownership, candidate membership, question choices and
duplicate targets, but cannot decide whether the source IDs describe the same
real-world race or person. No fuzzy matching or person creation occurs.

`get_sos_results_mappings(p_election_id)` reads the links under the SOS election
visibility gate. Private elections require an admin; unlisted elections require
their UUID. For nonadmins, links to nonpublic people are omitted. Mappings are
stored in Postgres and are never included in public R2 source assets. Use
`delete_sos_results_mapping` with the election, jurisdiction and source contest
IDs to remove a reviewed link. A changed public mapping requests a static rebuild;
an unchanged save does not. Verify the selected jurisdiction and visible ballot
after each change.

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

Expected freshness is the effective configured polling cadence plus ingestion, source/CDN
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
downloads if an election later becomes restricted. The visibility check controls
admission and later database reads; it cannot retract objects already uploaded or
stop an upload already in flight at the instant visibility changes. Initially retain abandoned
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

### Ballot vote metrics

Static and runtime ballot rows share `lib/vote-metrics.ts`: vote share is the
choice count divided by the sum of every source choice within that contest and
selected reporting scope. Counts must be nonnegative safe integers and the sum
must remain safe. Any missing or invalid choice makes the share unavailable;
known individual counts remain readable. An entirely reported zero contest has
zero shares. Unmapped candidates/options always retain an unavailable metrics
row; clearing/changing a scope replaces old annotations with that empty state.
Additional source choices use the full contest denominator, never only the
unmapped subset. These shares do not measure turnout or declare winners.

Photo/PDF ballot rows retain valid explicit source totals. When no total is supplied,
a choice sum is used only if every curated candidate ID or question-option label
is present in that report; partial reports keep their known counts while shares
and the total remain unavailable. No other county/style report fills the gap.

The main election ballot runs SOS and photo/PDF readers in the background, without
their technical control banners. The compact sound toggle remains visible; the
results detail page retains explicit reporting-area/search/refresh controls.
Inline SOS scopes match the selected Georgia county to an exact normalized
published jurisdiction name (optional County suffix), never a derived source ID.
All counties uses only an explicit statewide source; missing or ambiguous matches
leave metrics unavailable. Photo/PDF reads refresh every 30 seconds while visible
and online. Scope/source evidence remains inside race cards.

The coordinator's source HEAD checks and reference collector's source GETs send
`CivicPulse-results-collector/0.1.0 (+https://github.com/CivicPulse/updaters)` as
an explicit, honest User-Agent. This matches the Rust collector's application
identity and avoids relying on different Edge/Bun default client headers. It
does not change source admission, redirects, deadlines, polling windows or the
single scheduling coordinator. Regression tests inspect the actual request
headers supplied to each fetch boundary without contacting the official source.

### Poll completion response handling

`finish_sos_results_poll` returns SQL `void`. The coordinator accepts a successful
empty response (including HTTP 204 or HTTP 200 with no body) for this RPC only,
as well as the existing JSON `null` representation. It records completion once
and continues the bounded claim loop; it never retries a committed finish because
there is no response JSON. Signature verification and claims still require valid
JSON, so empty or malformed responses fail closed. This prevents a completed
queue transition from being misreported as an Edge Function failure. The observed
production symptom was a 502 after successful queueing; the exact upstream HTTP
status/body was not captured, so an empty finish response is a protocol-compatible
reproduction rather than a claim that production returned 204.

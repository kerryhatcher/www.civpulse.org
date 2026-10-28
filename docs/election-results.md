# Election results and turnout

## Unified election detail

Both public detail pages and the visibility-gated UUID viewer hydrate results
alongside the existing ballot through `get_election_results`. The page-session
reader shares paginated report requests with the precinct map; no result counts
or restricted report data are embedded at build time. Refresh results reloads
the report snapshot for the inline display. The map retains its loaded snapshot
until a page reload. Existing election/ballot edits still require a static rebuild.

The inline view selects the newest county/all-unit/all-method report for each
exact county and ballot style. It never sums precinct, county, method or style
reports. Each contest/question uses its own reporting denominators, never the
election-wide precinct total. Shares use the reported choice total, or the sum
of that report's recorded choices if the total is absent; separately reported
unresolved write-ins remain separate. Neither shares nor reporting percentages
infer turnout, winners, certification or candidate status. Missing counts stay
unknown. A source missing a ballot candidate cannot hide that candidate.

The same page transitions from ballot-only to ballot-with-results as reports
are published. Empty/error states retain the ballot, profile links and retry.
The existing RLS/RPC access gates also apply to anonymous and signed-in readers.
Historical SOS race labels retain their original wording. The Bibb ballot gate
recognizes statewide SOS office labels, known legislative districts, and explicit
official Bibb source URLs on imported contests, so those results do not disappear
in the default county view. Unclassified local offices remain outside that gate.

## Georgia SOS results JSON feeds

Each election has an optional `results_json_url`, editable in Elections admin.
Leave it null until SOS publishes the exact URL; the November 3, 2026 URL has
not been supplied. Do not derive a URL from the election name or import a past
feed as its results. The database accepts only HTTPS SOS Georgia export URLs.

The three supplied examples use `electionDate`, `electionName`, `createdAt`,
statewide `results`, and county `localResults`. May's feed is approximately
161 MB, containing 9,708 ballot items across 160 jurisdictions. Store these
as source snapshots in `sos_result_snapshots` and `sos_result_items`, preserving
SOS jurisdiction/contest/choice IDs, vote counts, method/precinct breakdowns,
reporting statuses, nulls and additional source fields. The statewide totals
and county totals overlap; do not sum them. Reporting status is not an inferred
certification or candidacy outcome. Source IDs are not Civic Pulse person IDs.

To validate a published feed, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_ACCESS_TOKEN` to a signed-in administrator's session token in the
shell, then run:

```sh
bun run scripts/sos-results.ts <election-UUID>
bun run scripts/sos-results.ts <election-UUID> --apply
```

The first command downloads and validates without writing. The second stages
bounded batches and atomically publishes the complete snapshot. Missing URLs
return `awaiting_url`; HTTP errors leave the current snapshot intact. Redirects
are rejected, downloads are limited to 256 MiB, and source dates must match the
election. The exact download SHA-256 is a collector receipt; Postgres validates
the structure and completeness of staged items, but does not independently
reassemble and verify the original document hash. Source JSON is stored as JSONB,
not byte-for-byte original formatting. No service-role/browser credential is added.

Identical downloads are no-ops. Interrupted staging can be resumed by rerunning
the same feed; conflicting staged items reject. Only a newer source timestamp
can replace the current snapshot, with an explicit expected-current ID checked
under an election lock. Revisions may lower counts. Historical published
snapshots are immutable; abandoned staging remains admin-only for diagnosis.

`get_sos_results(election_id, snapshot_id?, jurisdiction_index?, offset?, limit?)`
returns current metadata by default and at most ten ballot items per page when
a jurisdiction index is supplied. Pin `snapshot_id` while paging; the manifest
contains each jurisdiction's item count. Exact UUID reads permit public/unlisted
elections; private elections require an admin. These are public SOS aggregates,
independent of editorial candidate visibility. Raw tables have RLS, admin SELECT,
and no direct API write grants. Imports do not trigger static frontend rebuilds.

This is a storage and manual refresh foundation. Scheduled fetching, Realtime
subscriptions/push notifications and integration into visitor result charts are
future work. Saving the URL alone starts no fetch. Existing photo/PDF and turnout
imports/readers remain separate and retain their current behavior.

Merge `20261125000400_sos_results_feeds` and
`20261125000500_attach_known_sos_results_urls` to main before applying in production.
The second migration attaches the three supplied URLs only to matching existing
date/slug records and preserves administrator-supplied URLs. It imports no totals.
Verify locally with `ELECTION_RESULTS_TEST_DATABASE_URL` and
`bun test scripts/tests/sos-results.test.ts scripts/tests/sos-results-db.test.ts`.
No real result totals are seeded or imported by these migrations.

The first release supports Macon-Bibb using existing election, contest, question
and candidate records. `/elections/results/?id=<election UUID>` is a static Astro
shell with live browser RPC data. It shows separate scoped reports and optional
history, not a computed rollup of overlapping county/precinct/tabulator returns.
No SSR, service key, external OCR service or scheduled scraper is introduced.

## Contract

The admin MCP tool `manage_election_results` groups four operations under its
`operation` argument: `upload`, `view`, `read`, and `import`. This keeps the
plugin at 128 tools. Its `upload` operation uploads immutable private JPEG/PNG/PDF originals up to
10 MiB and computes SHA-256. The AI agent visually transcribes the image; upload
itself does not run OCR. Repeated bytes reconcile against the stored checksum.
An admin can retrieve a ten-minute signed URL. Images never appear in public HTML.

The `import` operation calls the `import_election_result` RPC and defaults to validation only. It binds the printed election
date to an existing election UUID and validates candidates/questions against that
election. A scope consists of county, unit type, unit code, counting group and
ballot style. Use `Bibb`, county unit `all`, and canonical precinct/tabulator IDs.
Missing headers block identification; do not guess. Several tapes in one image
become separate reports with distinct source locators.

The report is a complete cumulative snapshot for its scope. It includes election
turnout plus contest-level metrics and choice counts. Preserve the original total
votes separately from unresolved write-ins. Missing counts remain null; a printed
zero remains zero. Choice-table totals must reconcile. Ballots need not equal
candidate votes; the difference does not establish undervotes. Registered-voter
and precinct denominators belong to their printed scope. Do not infer winners,
certification, or finality. Future elections accept turnout-only snapshots.

The transaction locks the election, validates all input and source presence, and
requires the previous current report ID before replacing it. Same scope/time/data
returns the original ID, even when the source is a different photograph. Changed
OCR at the same printed time is a conflict. An older report cannot replace a newer
one. History is immutable and direct writes are revoked, including for admins.
This version requires manual reconciliation of incorrectly imported historic OCR;
there is deliberately no overwrite/delete escape hatch. Do not invent a newer
printed timestamp to correct one. A duplicate photo's original remains in private
Storage but the original report receipt retains its first provenance references.

The public `get_election_results` RPC (also exposed by the admin tool’s `read`
operation) returns up to 100 reports per page, current scopes by default
or history when requested. Private elections require an admin; unlisted elections
are reachable by exact UUID. Source paths/transcription are admin-only. Contests
containing a non-public person are omitted for non-admin readers. Original tables
have RLS and admin select only. RPCs use an empty search path. The internal count
validator has no public EXECUTE grant. Ordinary users cannot upload evidence.

## Examples

- **May 19, 2026:** the [Georgia SOS General Primary](https://results.sos.ga.gov/results/public/Georgia/elections/GeneralPrimary51926)
  is the historical example. Separate Republican/Democratic ballots and voting
  methods; retain the source's status and as-of time. A statewide page is not a
  Bibb County total. Use the site's county selector to obtain Bibb reports.
- **November 3, 2026:** upcoming as of October 26. An empty report list displays
  “No reports yet”, never fabricated zeros. Advance participation can be recorded
  before election day; contest votes cannot. No estimated votes are seeded.
- The supplied photos are independent February, March and April examples; use
  their own printed dates. See [photo extraction audit](research/election-photo-examples.md).

## Verification and release

`ELECTION_RESULTS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/election-results-db.test.ts`
checks permission boundaries, immutable history, dry runs, semantic duplicates,
replacement concurrency preconditions, invalid counts, wrong elections/candidates,
future vote blocking and source requirements. Fixtures and a test-applied schema
roll back. Run MCP tests, `bun run mcp:check`, `bun run mcp:build`,
`bun run plugin:build`, `bun run check`, and `bun run build`, then verify results
and history anonymously and signed in. Use local Supabase for actual uploads.

The migration was CLI-created and moved after existing future-dated dependencies
and shared local migrations to avoid a version collision. Merge it to main before
production application through the existing guarded integration. Then deploy MCP
and frontend, and release the updated plugin package. This change does not import
sample photos or election totals into production.

The Bibb County May page was inspected on October 26, 2026: it labels results
**OFFICIAL RESULTS**, updated June 5 at 8:33:45 AM, and reports **29,184 ballots**,
**105,477 registered voters**, and **31/31 precincts**. Its displayed turnout is
rounded to 28%; ballots/registration is approximately 27.67%. Preserve `official`
as distinct from `certified`. The source labels the numerator ballots, not voters.
The results UI uses voters when reported, otherwise ballots, and labels the basis.
[Bibb source](https://results.sos.ga.gov/results/public/bibb-county-ga/elections/GeneralPrimary51926).

### CI integration

The MCP workflow runs election tool-schema tests. The existing local-Supabase
integration job also runs election database and Auth/MCP/Storage tests using a
synthetic evidence file; it needs no chat attachments or production credentials.
After integrating current main, legislative batch imports use `import_legislation`
with explicit `mode=batched` instead of `import_legislation_bundle`. The original
atomic mode remains the default and preserves its response and 100-record limit.
This consolidation keeps both workflows within the 128-tool catalog budget.

## Structured Georgia SOS aggregates (schema v1)

`manage_election_results` also supports `import_turnout` and `read_turnout`.
These operations use the connected administrator's token; no SQL, service key or
photo conversion is needed. Photo/PDF operations and their validation are unchanged.
The immutable JSON original is stored in Postgres, with a server-verified SHA-256
of the exact UTF-8 document text. It is not a Storage path. Only admins can inspect
the original bytes; public readback projects the allowlisted public aggregate data.
Never supply raw Qlik session transcripts, tokens, headers or voter-level data.

Prepare the updater's saved export offline:

```sh
bun run scripts/prepare-georgia-turnout.ts /path/to/ga-sos-turnout-2026-11-03.json /tmp/turnout.json
```

The command prints the SHA-256 and row counts. It validates source/election and
column identities, resolves the 159 Census county FIPS codes, preserves the
original county/ballot-style labels and builds precise normalized-row locators.
Its output contains only a fixed public aggregate schema, excluding raw session
and arbitrary definition fields. `upstream_sha256` retains the collector's
snapshot reference; it is distinct from the independently verified document hash.
The checked-in county codes come from Census's 2020 national county code file.
The app/object IDs and source URL are pinned. Changed columns, ballot styles or
unresolved counties require a reviewed schema update, never silent coercion.

Read `operation={action:"read_turnout",election_id:"<UUID>"}` first. Call
`operation={action:"import_turnout",document:"<exact file text>",sha256:"<printed hash>",expected_report_id:null,dry_run:true}`.
After successful validation, use `dry_run:false` with the same document and hash.
A replacement must supply the current report UUID. All three tables are one
bounded batch: at most 636 source rows / 2 MiB, validated before any report write
and committed atomically. There is no partial resume offset: retry the entire
unchanged request after an uncertain response. Exact evidence replay is a no-op;
identical tables at a later capture also reuse the current report. The election
lock serializes replacements. Stale captures, older source times and changed
values at an unchanged source timestamp reject. Newer snapshots may lower counts
and preserve their predecessor; no totals are accumulated across observations.

Each table retains its source title, object ID, as-of label and nullable as-of
instant with `America/New_York` timezone. Collection time is separate. A missing
source footnote means `as_of:null`, never the reload or capture time. Early voting
stores accepted ballots; absentee stores requested, issued, returned, accepted,
rejected, spoiled/canceled, outstanding and acceptance ratio. Turnout preserves
county/ballot style. Every measure has `value` and verbatim `display`; counts are
safe nonnegative integers, ratios are fractions in [0,1], and unavailable values
remain null. Suppressed rows are absent, never synthesized zeros. No registration
or precinct denominators are inferred. These records are always unofficial and
turnout-only, including before election day; they contain no candidate votes.

Readback returns report UUID, predecessor, exact document hash, source/app/capture
references, 100 history metadata entries and up to 100 source rows per page.
Use `offset` until `total` is reached. `report_id` selects a historical snapshot;
read it before paging so a concurrent replacement cannot mix report pages.
The election visibility rules match photo reports: public readable by anyone,
unlisted via exact UUID, private admin-only. Public projections contain no editor
IDs or raw private originals. The results page shows structured rows separately
from photo/PDF reports and offers history and Load more controls. It never adds
these overlapping views together. Results are live RPC data after deployment;
Astro code/documentation changes require a build and deployment.

Release `20261124010900_structured_turnout` through GitHub main before applying
it with the normal guarded workflow, then deploy MCP/frontend and refresh plugin
schemas. This feature branch must not apply the migration or upload the real
November bundle to production. Local acceptance may use that bundle inside a
rollback-only transaction; do not commit the private export.

Run the existing photo/PDF suites plus `structured-turnout-db.test.ts` with
`ELECTION_RESULTS_TEST_DATABASE_URL` pointed at local Supabase. The test applies
this migration and rolls back schema/fixtures. The JSON conversion command does
not collect new data or publish anything.

## Scoped browsing and May 19 breakdowns

The browser loads all paginated reports through the existing visibility-aware
RPC, then selects an exact county/unit-type/unit, counting group, and ballot
style. It defaults to a county overview when present. Search matches contest and
candidate labels; native disclosures keep long ballots manageable. URL filters
preserve the selected scope, search, and history mode. No cross-report sum is
computed. Older reports remain independent snapshots. Public access rules and
private evidence storage are unchanged.

The May 19, 2026 Bibb import adds 31 precinct reports (official precinct codes)
and four county voting-method reports to the existing county/all snapshot.
Both partitions independently reconcile to the county choice totals. Source:
Georgia SOS county Excel export, last updated June 5 at 08:33:45 EDT. PDF evidence
is a faithful conversion of that workbook, with one worksheet per page; the
original workbook SHA-256 is recorded in source transcriptions. Contest ballot
counts are preserved where printed; election-wide precinct/method turnout stays
unknown where the workbook does not supply it. No precinct-by-method totals are
inferred from the partially unreported media-feed cells.

One source discrepancy is retained explicitly: Howard 1 / Rick A. Williams / State
Senate District 25 Republican is 2 in the official workbook, but 0 in the separate
media export. The workbook value reconciles to the county total and is used;
the HO1 report records the discrepancy. No county total or historical candidacy
outcome was changed by this import.

## Election detail turnout charts and precinct map

The site header provides the only county selector for ballots, turnout charts,
and report browsing. County changes update the charts from their loaded snapshot;
All counties displays separate labeled county groups without summing their
counts. A county absent from the snapshot shows a no-data message instead of
selecting another county. Ballots have no independent area dropdown. Direct race
anchors reveal their target without changing the header's session preference.

Public election detail pages and the gated UUID viewer load turnout at runtime
through the existing visibility-aware RPCs. Structured county charts page the
latest report and pin subsequent pages to that report ID, default to Bibb, and
keep overlapping source tables separate. Counts have no inferred registration
percentage; source as-of labels and collection times remain distinct.

The Bibb precinct map reuses the build-exported public voting-precinct layer.
Only exact Bibb/precinct/all-method/ballot-style result scopes join to the
boundary `precinctid`; no names, county totals, contest totals or overlapping
method reports are combined. The latest observed report per scope supplies
voters (otherwise ballots) and the same report's registered count. Missing,
invalid or zero denominators remain unreported; a true zero numerator is 0%.
`TURNOUT_BANDS` defines shared, fixed percentage bins for map fills and legend:
under 10%, 10–<15%, 15–<20%, 20–<25%, 25–<30%, and 30%+. Opaque yellow-to-green
colors distinguish lower-turnout precincts without blending into the background.
The final band is open-ended; popups and tables retain the actual percentage.
Gray identifies unavailable rates and stays distinct from a reported zero.
Popups and an accessible table retain exact counts, report times and status.
Structured county aggregates cannot populate precinct percentages. Precinct
reports with both participation and registration counts enable the map’s rates;
contest-only reports or missing denominators leave those precincts unreported. Boundary snapshots may differ from
historical election boundaries and require review before interpreting comparisons.

Run `bun test scripts/tests/election-turnout.test.ts
scripts/tests/precinct-turnout.test.ts`, then the standard check/build/browser
flow. Include empty reports, missing versus zero values, county and ballot-style
selection, mobile layout, retry, snapshot paging and the gated UUID viewer.
The Public map snapshots CI workflow also runs the turnout and scoped-results
unit tests on pull requests and pushes to main.

### Shareable section links

Election detail sections expose `dates-and-deadlines`, `voter-turnout`,
`precinct-turnout`, and `ballot` IDs with native heading permalinks. Public and
gated UUID detail pages use the same IDs. The reports page exposes
`result-filters`, `reports`, and `structured-turnout`; hash links preserve its
existing election and reporting query parameters.

`restoreSectionAnchorAfter` re-aligns an initial hash after the page’s initial
runtime reads finish, including turnout charts above the map. It respects hidden
or unavailable sections, malformed fragments, changed hashes and visitor input;
it does not override someone who has started scrolling or navigating. Existing
contest/question links still reveal their linked races through election scope.

The UUID viewer’s optional admin-edit lookup runs independently of turnout and
anchor readiness. A delayed or failed role lookup cannot postpone the shared
section’s alignment; the edit link stays hidden unless admin access is confirmed.

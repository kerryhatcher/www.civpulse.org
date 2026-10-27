# Election results and turnout

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

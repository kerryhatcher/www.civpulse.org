# Professional-service fees, per diem and expenses (version 1)

Issue #152 adds separate application records and reporting, not a collector or
production backfill. A receipt is not evidence of employment, profession, office
service, a contract identifier or service dates. No affiliations or office terms
are created. These observations can overlap payroll and ordinary payment datasets:
never combine their totals without source-backed reconciliation establishing
non-overlap. Missing coverage is not zero receipts, deletion or misconduct.

The [official per-diem entry point](https://open.ga.gov/openga/perdiem/index)
redirected to Open Georgia’s disclaimer in the November 3, 2026 read-only check.
It distinguishes fees/expenses from salary and other expenditure reporting and
provides no assurance on reporting entities’ representations. The issue’s earlier
233-row FY2025 finding was not independently re-established here. No real source
rows or original private documents are committed or seeded.

## Admin acceptance

Apply migration `20261125003100` from the released main branch before deploying
matching MCP/web code. `accept_service_fee_report(p_version=1,p_provider,p_report,
p_rows,p_dry_run=true)` requires an administrator. Compact MCP fields omit the
`p_` prefix. A complete bounded report is atomic: 1–100 rows and at most 1 MiB.
Default dry run exercises constraints and rolls back. Invalid rows reject the
whole report; this is not staged chunk publication. Split only independently
supported report scopes and describe each scope’s coverage.

The manifest follows the obligation-report contract: `source_key`, reviewed
`organization_id` UUID or null, raw `reported_organization`, `organization_review`
(reviewed/unresolved), `report_label`, reported `year` or null, `period_start` /
`period_end` or null, explicit `measure_label`, `currency` (three uppercase letters),
`unit`, `grain`, `aggregation` (not_additive/disjoint_rows), `aggregation_basis`
(required for disjoint_rows), `source_url` (usable HTTPS without credentials),
actual timezone-bearing `retrieved_at`, `document_sha256` (64 lowercase hex),
`published_on` or null, exact `locator`, `evidence_status` (original_verified,
indexed_copy_unverified, unverified), `coverage`, `visibility`.

Public reporting organizations must resolve to reviewed existing UUIDs. Unresolved
raw organizations remain null-linked and non-public, without fabricated stubs.
A reviewed organization cannot silently change identity across revisions.
Unknown dates stay null; reported year never invents fiscal boundaries or service
dates. A byte checksum identifies reviewed bytes, not verification of an unavailable
original. Acceptance validates the editor’s assertion, not remote document contents.

Each row has the following strict fields:

```json
{
  "source_key":"source-row:7",
  "reported_recipient":"Recipient, Example",
  "recipient_kind":"organization",
  "recipient_id":"00000000-0000-4000-8000-000000000002",
  "recipient_review":"reviewed",
  "amount":"-25.000000000001",
  "description":"PER DIEM AND FEES-EXPENSES",
  "reported_category":null,
  "classification":null,
  "classification_review":"unresolved",
  "locator":"CSV row 7",
  "visibility":"private"
}
```

Replace example UUIDs with reviewed existing records. Amounts are exact signed
**strings**, up to 24 whole /12 fractional digits, without exponent notation,
float coercion or cent rounding. Measures remain separately scoped source reports
if the source distinguishes fees, per diem and expenses; never infer a split from
an ambiguous description. Original description is required and immutable; original
category is text or explicit null when absent. Reviewed `classification` is separate
text with `classification_review=reviewed`, or null/unresolved; it does not replace
the raw category, establish a profession, or silently classify ambiguous text.

Recipient kind is person/organization with a reviewed existing UUID, or unresolved
with null UUID, unresolved review and non-public visibility. Resolve supported
variants only from reviewed evidence. Same raw name may refer to different people
or organizations. Do not fuzzy match or make automatic stubs. Distinct source row
keys remain distinct even with identical recipients, descriptions and categories.
`provider + report.source_key` is stable report identity; `row.source_key` is a
source observation, not a guessed transaction or employee identity.

Exact retries, including reordered rows, return unchanged. Changed content returns
conflict unless it explicitly supersedes the latest report with `supersedes_id`
and a `correction_reason`. Corrections append immutable versions; no in-place
replacement, prior-record deletion or automatic cancellation occurs. Omission is
historical evidence, not a cancellation finding. Reports/rows are audited; report
acceptance requests the existing frontend rebuild. There are no application direct
writes; RLS and empty-search-path definer functions enforce admin acceptance.

## Reads, category totals and exports

`browse_service_fees(p_organization_id,p_year,p_query,p_recipient_kind,p_recipient_id,
p_observation_id,p_history,p_offset,p_limit)` provides organization/year, literal
recipient/description/category text search, exact typed recipient IDs and observation
detail. Query is at most 200 characters; page size at most 100. Unknown years remain
unfiltered-only. Latest revision is default; history preserves separate revisions.

Anonymous and ordinary signed-in users see only public report/row chains. A linked
private/unlisted person excludes the **entire** observation before search, count,
sum, raw-name/ID projection, export, detail and generic audit. Later restricted row
corrections suppress earlier public payloads; a restricted latest report suppresses
the report chain. Unresolved identities stay private/unlinked. Admins retain their
authorized evidence. No hidden/excluded source counts or expected totals leak.

Exact Postgres sums are returned as strings only when source review asserts
`aggregation=disjoint_rows` and documents its basis. Otherwise no sum is calculated.
This assertion must rule out overlapping subtotals/cumulative observations; the API
cannot independently certify it. Totals include matching visible rows only, grouped
by **original reported category**, report revision, measure, currency, unit, period
and grain. Null category remains unknown. Classification does not merge categories.
Groups are limited to those represented on the page, while their sums cover matching
visible rows in that group, potentially beyond the page. Never add report revisions,
currencies or overlapping datasets into a grand total. Filtering changes scope.

[Service-fee reporting](/finances/service-fees/) uses browser RPC reads on a static
Astro shell. Organization/person profiles link to scoped reporting; recipient links
use existing reviewed records and gated person viewers. Description, category,
classification review, exact amounts, revision and source details are visible.
CSV contains the displayed observation page, scoped filters and provenance, with
spreadsheet formula protection. JSON additionally carries separately scoped category
totals. Neither export converts money to JavaScript numbers or repeats totals as
observation amounts. Historical observation links retain history mode.

## Verification and release limits

Local DB tests use isolated API54341/DB54342, never the shared54322 stack:
`SERVICE_FEES_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54342/postgres bun test scripts/tests/service-fees-db.test.ts`.
Transactional synthetic fixtures cover precision, repeats/categories, ambiguous
recipients, visibility, scoped sums, dry runs, retries/corrections, history/audit,
row limits and rebuild invalidation. Browser fixtures use actual local admin Auth,
anonymous and mobile views, then canonical records/Auth users are removed.

Compact MCP adds accept/browse tools: 81 compact /128 legacy. Regenerate both plugin
packages. Refs #152 leaves deployment and separately reviewed production acceptance
open. No collector, real data import, production migration or deployment is included.

November 3, 2026 local verification: 25 affected tests/273 assertions passed;
`bun run check` reported263files without errors/warnings/hints. MCP/plugin validation
reported128legacy/81compact; isolated security advisors found no issues. Rendered
Chrome checks at the default desktop viewport and390×844 mobile verified category
search, separate original/amended25/30USD groups, downloaded CSV/JSON scope and no
hidden recipient raw names/UUIDs. Actual local Admin saw5latest rows versus3anonymous;
private recipient viewer/profile links scoped correctly, and sign-out removed that
recipient’s results. Mobile populated content/scroll widths both343px; no app console
warnings/errors. An extension UI briefly blocked sign-in automation; checks resumed
after the user dismissed it. Canonical synthetic reports, organizations, person and
Auth user were removed (zero remain); protected audit history naturally remains.
The final build uses the isolated backend after cleanup, not production data.

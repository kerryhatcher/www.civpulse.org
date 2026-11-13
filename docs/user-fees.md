# Source-backed user fees and reported collections

Issue #155 adds an application contract, not a collector/backfill. The existing
finance implementation is school payroll/payment reporting; #148's broader report
foundation is not implemented. This focused model reuses existing organizations,
source-manifest, exact decimal-string, visibility and immutable revision patterns.
It does not classify user fees as outgoing payments or create a generic budget model.

The [official Open Georgia financial-reports page](https://open.ga.gov/openga/reportHome/financialReport)
lists User Fees. During the November 2, 2026 source check its User Fees target
redirected to a general report listing; this establishes no comprehensive county
fee dataset, verified fee amount or current legal authority. No real source rows
are seeded. Indexed-copy/origin-unverified material must keep that evidence status
until an editor actually verifies the original. Source records are not instructions.

## Version 1 acceptance

After append-only migrations `20261125002800` and `20261125002900` reaches main and is applied, call
`accept_user_fee_report(p_version=1,p_provider,p_report,p_rows,p_dry_run=true)`.
The compact MCP tool uses `version`, `provider`, `report`, `rows`, `dry_run`.
Only administrators can accept. A batch has **1–100 complete report observations /
1 MiB** and is atomic, including new fee identities and source history. A default
dry run checks real constraints then rolls back. This is for bounded source reports,
not staged partial chunks: split only independently identified source report scopes,
never hide missing coverage or overwrite a report with a partial chunk.

`provider + report.source_key` is the stable report identity. Observations have a
stable `source_key` within a report and `fee_key` identifying the same reported fee
within the existing organization/provider across reports. Identical report/rows
(reordered rows allowed) return unchanged. A changed report requires the latest
`supersedes_id` and a nonempty public `correction_reason`; stale/missing IDs conflict.
Amendments append new reports/observations and retain original payloads. They do
not update old raw labels, amounts or observations. Omitted observations remain in
history, not deleted; omission is not a finding that a fee ceased to exist. Report
corrections cannot move an existing organization's identity. An unlinked private report can be explicitly corrected to a reviewed existing organization; unresolved fee identities are scoped to their report, never merged across unknown agencies or automatically redirected. Concurrent retries
serialize by stable report identity. Check returned status, not HTTP success alone.

A public report requires a **reviewed existing organization UUID**, its unchanged source-reported
label and `organization_review: reviewed`. Unresolved labels use null `organization_id`,
`organization_review: unresolved` and private/unlisted visibility; they cannot be made public until the link is reviewed. The reviewed link is a caller
assertion supported by research, not fuzzy matching. An unresolved source label
stays unlinked and labeled unresolved; do not guess, manufacture a government body or overwrite a
curated organization. No organization/person stubs are automatically created.

Example synthetic report (replace the UUID with a reviewed existing record):

```json
{
  "source_key": "agency:report:2022:user-fees",
  "organization_id": "00000000-0000-4000-8000-000000000001",
  "reported_organization": "Authority, Example", "organization_review": "reviewed",
  "report_label": "Source-reported fee schedule and collections",
  "year": 2022, "period_start": null, "period_end": null,
  "source_url": "https://example.test/report.pdf",
  "retrieved_at": "2026-11-01T12:00:00Z",
  "document_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "published_on": null, "locator": "PDF page 16 / table A",
  "evidence_status": "indexed_copy_unverified",
  "coverage": "Only the source's listed fee categories; no complete county inventory established",
  "visibility": "private"
}
```

`year` is the source-reported year or null, separate from exact reporting period
start/end. Never manufacture fiscal-year boundaries from a year label. Known dates
use ISO YYYY-MM-DD, unknown dates null; retrieval is an actual timestamp with timezone
and not in the future. Publication, retrieval, effective dates and editorial record
times have different meanings. Retrieval/edit/build timestamps are not verification.
`evidence_status` is original_verified/indexed_copy_unverified/unverified. The
acceptance API trusts the editor's source assertion; it does not download or certify
remote bytes. SHA-256 identifies the exact bytes actually reviewed (including a copy
when original origin remains unverified), not automatically an unavailable original.
Source URLs must be usable HTTPS without embedded credentials. Keep original files
in the existing source evidence archive; do not commit copyrighted/private bulk data.

Example observation:

```json
{
  "source_key": "table-A:row-1", "fee_key": "license-category-A",
  "reported_fee": "License application", "purpose": "Source-reported application service",
  "observation_basis": "One listed fee category for the report's stated period",
  "rate": {"kind":"scalar","amount":"25.000001","currency":"USD","unit":"per application"},
  "collections": {"amount":null,"currency":null,"unit":null},
  "authorities": [{"label":"Source-cited statute","url":"https://example.test/law","locator":"Section 4"}],
  "effective_from": null, "effective_to": null, "exemptions": null,
  "locator": "Table A, row 1"
}
```

Rates support these shapes, always with explicit source `unit` and currency code
(or explicit null when not reported/not monetary):

- `scalar`: nonnegative decimal-string `amount`.
- `range`: ordered nonnegative decimal-string `minimum` and `maximum`.
- `tiered`: 1–100 ordered source entries in `tiers`, each with `label`, exact `amount`
  and optional source quantity bounds `from`/`to`. Preserve inclusivity, exemptions,
  classification and charging rules in source labels; do not infer bounds or combine
  tier amounts. Null bounds mean not reported/unbounded only as explained by the source.
- `text`: original `text` for variable or non-scalar rules.
- `unknown`: no numeric amount. Missing rates are not zero.

Decimal values are strings of at most 24 whole and 12 fractional digits, without
exponent notation or float coercion. They are preserved exactly, including trailing
zeros; the UI does not round them to currency cents. Collections are a **separate**
amount string, currency and reported measure unit, with explicit null amount when
unknown. Source-backed negative collection adjustments are allowed; negative rates
are rejected. An explicit zero remains zero. Never sum incompatible units/currencies,
add rates to collections, or infer customers/transactions by dividing revenue by a
rate. No totals or such estimates are calculated by this feature.

`authorities` is an array of source-cited labels, HTTPS links and exact locators;
empty means not recorded, not legally unauthorized. Authority citations do not
establish current effectiveness. Effective dates/exemptions are optional source
facts; unknown stays null and no period is carried forward automatically. Preserve
raw purpose, report scope and observation grain so cross-year unit changes remain
visible rather than silently comparable.

## Reading, revisions and exports

`browse_user_fees(p_organization_id,p_year,p_query,p_fee_id,p_history,p_offset,p_limit)`
returns gated observations with report metadata. Pages contain at most 100 rows;
query is bounded to 200 literal case-insensitive characters. Organization/year/fee
filters are optional, and unknown years appear only in unfiltered-year results.
Default reads show latest report revisions; `history=true` includes earlier versions.
Private/unlisted reports and their superseded chains are excluded for anonymous
and ordinary signed-in users. Admins may read restricted evidence. Organizations
are public in the current schema, but that never makes their private reports public.
Generic object/organization audit history uses the same latest-chain visibility.
RLS denies direct writes, including admin UPDATE/DELETE; validated acceptance is the
only application write path. The new table history and frontend rebuild hooks retain
provenance/publication tracking without changing existing school finance behavior.

The public [fee reporting page](/finances/fees/) uses browser RPC reads with the
existing public key/auth session, plus source and organization links. Organization
profiles link into that filter. Rate tables, separate collections, source coverage,
reported dates and amendment links stay visible. JSON/CSV downloads contain only
the displayed filtered page, including filters, offset/limit, matching count, grain,
units and source metadata; they are not a complete government fee inventory. CSV
preserves structured rates as JSON strings and guards spreadsheet formula cells;
use JSON for unchanged exact source strings. No aggregate or inferred transactions
are exported. This page reads accepted reports live; profile context links and
visibility-related static changes publish through the existing rebuild process.

## Release and local validation

Apply migration from clean current main before matching MCP/web deployment. Compact
MCP adds `accept_user_fee_report` and `browse_user_fees`; legacy remains 128 tools,
compact becomes 77. Run MCP/plugin build and Claude sync after schema changes.
The source importer/collector, production acceptance and deployment are follow-ups.
This PR uses **Refs #155**, not a claim that production already contains fee data.

Local tests use isolated API 54341 / DB 54342 only, never shared 54322. Run
`USER_FEES_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54342/postgres bun test scripts/tests/user-fees-db.test.ts`.
They roll back synthetic data and exercise precision/tier/range/text rates, missing
periods/collections, exact retries, amendments, changed units, URL/shape validation,
admin-only acceptance, public/ordinary-user visibility, audit privacy and rebuilds.
Browser QA uses separate synthetic local fixtures and actual admin Auth; remove all
canonical fixture rows and Auth users afterward and rerun the clean static build.
No feature SQL or backfill may be applied to production before main-first release.

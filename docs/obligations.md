# Reported obligations and commitments (version 1)

Issue #151 adds a distinct application contract, not an importer or backfill.
Reported commitments are not cash paid, original contract values, outstanding
balances or verified full contracts. It reuses organization/person identities,
source report revisions, validated decimal/HTTPS helpers and audit/rebuild patterns
from school-finance/user-fee work. It does not broaden #148 into a generic ledger.

The [official obligation entry point](https://open.ga.gov/openga/obligation/index)
redirected to Open Georgia's disclaimer during the November 2, 2026 read-only check.
That disclaimer describes reporting entities' representations and no audit assurance.
The issue's prior FY2025 search/count is not independently re-established by this
feature, nor does it establish county-wide coverage. No real records are seeded.
Indexed-copy/origin-unverified sources stay so until the original is actually checked.

## Acceptance and identity

After migration `20261125003000` reaches main and is applied, call
`accept_obligation_report(p_version=1,p_provider,p_report,p_rows,p_dry_run=true)`.
Compact MCP uses `version`, `provider`, `report`, `rows`, `dry_run`. Only admins can
accept. One **complete bounded source report** has 1–100 observations / 1 MiB and
is atomic. Dry runs validate actual constraints then roll back everything. Invalid
rows reject the entire report. This is not staged chunk publication; split only
independent source report scopes and state their coverage explicitly.

`provider + report.source_key` identifies one report across immutable revisions;
`row.source_key` identifies an observation within that source report, not a guessed
contract. Rows with the same vendor label or reviewed vendor ID are separate
observations and are never deduplicated by name. Same report/rows (including reordered
rows) retry unchanged. Changed reports need the latest `supersedes_id` and a public
`correction_reason`. Corrections/cancellations append a report revision and preserve
old amounts/status/labels. A cancellation does not automatically zero an amount,
create a payment or compute a remaining balance. Omission is retained in history,
not a source finding of cancellation, deletion or misconduct.

Public payer organizations require reviewed existing UUIDs and source-reported
labels. Unresolved payers use null UUID, explicit unresolved review and restricted
visibility; no placeholder organization is created. A reviewed payer cannot silently
move between organizations. Resolve supported variants explicitly from evidence,
never fuzzy match, merge curated profiles or infer identity from vendor totals.

Synthetic report example (replace UUIDs with reviewed existing records):

```json
{
  "source_key":"payer:2025:obligations", "organization_id":"00000000-0000-4000-8000-000000000001",
  "reported_organization":"Payer, Example", "organization_review":"reviewed",
  "report_label":"Source-reported obligations", "year":2025,
  "period_start":null, "period_end":null,
  "measure_label":"Obligation Amount", "currency":"USD", "unit":"reported dollars",
  "grain":"One source-reported vendor obligation observation",
  "aggregation":"not_additive", "aggregation_basis":null,
  "source_url":"https://example.test/report.csv", "retrieved_at":"2026-11-01T12:00:00Z",
  "document_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "published_on":null, "locator":"CSV rows 1–20", "evidence_status":"indexed_copy_unverified",
  "coverage":"Only the selected source report; no complete contracts or county-wide ledger established",
  "visibility":"private"
}
```

Report fields are strict. Required provenance includes usable HTTPS without embedded
credentials, SHA-256, actual retrieval timestamp/timezone (not future), exact source
locator, evidence status and coverage. The checksum identifies the bytes actually
reviewed; an indexed copy's digest does not certify an unavailable original.
Evidence is original_verified/indexed_copy_unverified/unverified. Acceptance trusts
the editor's assertion; it does not download/certify remote bytes. Keep original
files in the evidence archive, not private/copyrighted bulk attachments in Git.
Publication/retrieval/reporting periods have distinct meanings. Unknown dates stay
null; a year does not manufacture fiscal-year start/end dates or verification time.

Synthetic observation:

```json
{
  "source_key":"source-row:7", "reported_vendor":"Vendor, Example",
  "vendor_kind":"organization", "vendor_id":"00000000-0000-4000-8000-000000000002",
  "vendor_review":"reviewed", "amount":"-25.000000000001", "visibility":"private",
  "locator":"CSV row 7", "contract_id":null, "purchase_order_id":null,
  "source_date":null, "category":null, "reported_status":null, "cancelled_on":null,
  "reported_balance":null, "contract_value":null, "payment_links":[]
}
```

Amounts are exact **signed decimal strings**, up to 24 whole and 12 fractional
digits, without exponent notation, float coercion or cent rounding. Zero is retained;
missing coverage is not zero. Required report currency/unit/measure/grain must be
supported, not inferred from a portal's defaults. Do not accept a report with guessed
currency. Optional source contract/PO IDs, dates, category, lifecycle status and
cancellation date remain null unless supplied. Optional `reported_balance` and
`contract_value` are separate exact strings/null; a known amount requires explicit
`reported_balance_currency` / `contract_value_currency` (code or null if unknown),
never inheriting obligation currency or calculating a balance from payments.

Vendor kind is person/organization with a reviewed existing UUID, or unresolved with
null UUID and restricted row visibility. Unresolved labels remain unlinked/private;
no people/organization stubs are created automatically. Source-reported names remain
immutable separately from reviewed links. Private/unlisted linked people are
excluded entirely from non-admin rows, including raw names, IDs, optional contract
fields, payment references, detail/count/search/sums/exports and generic audit paths.
They are not merely replaced by a hidden profile link. Admins retain authorized
source evidence. A later restricted row correction suppresses its earlier public
payload in public history; omitted source rows remain historical evidence.

`payment_links` contains at most 50 source-supported references with `provider`,
`source_id`, `evidence_url` and exact `locator`. This is evidence of a source ID
association, not a numeric vendor/year match or an assertion of reconciled payment
coverage. Empty means unsupported/not recorded. Never link from equal vendor totals,
subtract unrelated spending or add obligations and payments. No payments are created.

## Public reads, comparisons and exports

`browse_obligations(p_organization_id,p_year,p_query,p_vendor_kind,p_vendor_id,
p_observation_id,p_history,p_offset,p_limit)` supports organization/year/vendor search,
exact typed vendor IDs and observation detail. Query is literal case-insensitive text
up to 200 characters; pages contain at most 100 rows. Unknown years appear only when
not filtering year. Default shows latest report revisions; optional history keeps
prior revisions separate. Private report/row chains and hidden people remain excluded
for anonymous and ordinary signed-in users. No hidden/excluded counts or source-wide
expected totals are projected. RLS denies direct application writes; only validated
admin acceptance appends. Generic report/row audit and rebuild hooks retain history.

Totals are exact Postgres numeric sums serialized as strings, **only** when the
report declares `aggregation=disjoint_rows` with a supporting `aggregation_basis`.
Default `not_additive` returns no sum. The assertion requires source review showing
no overlapping subtotals, duplicate cumulative snapshots or incompatible observation
grains; it is not independently certified by the API. Public totals include only
matching visible rows, not hidden rows or an asserted complete source total. Groups
remain separate by report revision/measure/currency/unit/period/grain; never sum
comparison cards, revisions, currencies or reports together. Filtering changes their
scope. The bounded total list covers only report groups represented on the current
page, while each sum covers that group's matching visible rows, not necessarily just
the page. History shows original/amended groups side by side, without inferred
percentage changes or balances. This is not an official grand-total certification.

The [obligation page](/finances/obligations/) uses browser RPC reads and existing auth.
Organization profiles link to their payer filter; each observation links to reviewed
vendor records, exact observation detail and typed vendor history. CSV downloads
contain only the displayed observation rows with filters, measure/currency/unit,
period/grain, provenance and row scope. Group comparisons/totals are separate in JSON,
not a repeated additive CSV amount column. JSON contains the scoped page plus clearly
labeled group totals. CSV guards spreadsheet formula cells; JSON retains unchanged
signed strings. No cash-paid/contract/balance estimates are exported.

## Release and validation

Release migration from clean current main before matching MCP/web code. Compact MCP
adds accept/browse tools (79 compact, 128 legacy); regenerate both plugin packages.
No collector, real source import, production SQL or deployment is part of this PR.
Refs #151 leaves deployment and separately reviewed production source acceptance open.
Unknown coverage remains unknown. Public reporting reads accepted data live; static
profile context/visibility changes still require the existing publication process.

Local validation uses isolated API 54341 / DB 54342, never shared 54322. Run
`OBLIGATIONS_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54342/postgres bun test scripts/tests/obligations-db.test.ts`.
Tests roll back synthetic vendors/people/reports and verify signed precision, exact
visible sums, repeated labels, typed identities, private raw-name/detail/audit
exclusion, atomic dry-run/retry/amendment/cancellation behavior, invalid source dates/
links, non-additive coverage, row caps, CSV scope and rebuild invalidation. Browser QA
uses separate disposable local fixtures, actual admin Auth and public/mobile views;
remove those canonical records/Auth users and rerun a clean build afterward.

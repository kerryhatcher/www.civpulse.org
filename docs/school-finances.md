# Bibb school payroll and payments

The first finance adapter covers Open Georgia organization **6111**, exactly
`BIBB COUNTY BOARD OF EDUCATION`, county FIPS **13021**. It does not cover county
payroll, state-to-local receipts, regional institutions or individual schools.
Fiscal years run July 1–June 30. The frontend remains static Astro; `/finances/`
is a static shell with live, public-key RPC search. Organization/person profiles
still require a rebuild after changes. Existing people/affiliation triggers mark
that rebuild; the finance tables need no static export or invalidation trigger.

## Evidence and preparation

Keep original downloads in the collector's checksum-addressed evidence archive,
never in Git or browser assets. The finance API stores source metadata and
normalized rows, not original bytes. Payroll ZIP and its extracted TXT need
separate evidence checksums: the manifest checksum identifies the **parsed file**.
Retain the parent ZIP/member relationship in collector evidence. Row references
are one-based data-row numbers in that original file, excluding the header.
The filtered release's `row_number` is a separate contiguous ordinal.

Payroll bulk TXT is CSV; it may require Windows-1252 and single-quote removal
around money/year fields. Payments exports are organization/recipient summaries.
Their fiscal year is established by captured export filters, not a CSV column.
A result URL alone does not reproduce those session filters. Do not silently
accept the wrong organization, year, unexpected headers or incomplete downloads.

Prepare downloaded CSV/TXT without network access or database writes:

```sh
bun run scripts/prepare-school-finances.ts --file /path/payments-2025.csv --dataset payments --year 2025 --source-url https://open.ga.gov/openga/payment/index --retrieved-at 2026-11-01T00:00:00Z --output /tmp/bibb-payments-2025.json
```

Use `--dataset payroll` for the extracted annual TXT. Optional `--organization-id`
must identify the reviewed `bibb-county-board-of-education` organization; never
use the Board of Elections. Publication resolves that fixed slug or creates the
school organization if absent. No fuzzy matching or organization-name search
is used for reconciliation.

The schema-v1 bundle has `manifest`, `rows` and `source_row_numbers` (an offline
cross-check of the original row ordinals). The manifest fields are:

- `dataset`: `payroll` or `payments`; `fiscal_year`: integer, 2015–2100.
- `organization_id`: reviewed school UUID or null.
- `source_url`: official `https://open.ga.gov/…` URL; `source_filename`.
- `source_sha256`: lowercase SHA-256 of the exact CSV/TXT bytes, before decoding.
- `source_filters`: captured organization, organization ID/type and fiscal year.
- `retrieved_at`: actual source retrieval timestamp, never the replay timestamp.
- `parser_version`, `expected_rows`, `expected_amount`, `expected_travel`.

Amounts are decimal **strings**. Preserve source precision, including scientific
notation expanded without floating-point arithmetic. Actual payment exports
contain values such as `3688.1800000000003`. Storage and validation retain up to
18 fractional digits; only the UI rounds to cents. Exported page CSV retains
stored precision and protects textual spreadsheet formula prefixes. Salary and
travel are separate; payment count is not export row count.

Payroll rows: `row_number`, `source_row_number`, `name`, `title`, `amount`
(salary), `travel`. Payment rows: `row_number`, `source_row_number`, `name`
(recipient), `amount`, `payment_count`. Do not send managed fields such as person
IDs, review flags, publication status or editor IDs.

## Import and publication API

The MCP tool `school_finances` uses `{operation:{action,payload}}` and forwards the authenticated caller to
`manage_school_finances(p_action,p_payload)`. Every operation requires
`public.is_admin()`. There are no API-role direct table writes or reads. RLS is
enabled on both tables. No service key is used by the frontend or MCP server.

1. `begin`: send the exact manifest as `payload`. Returns `release_id`, `status`,
   `row_count`. Dataset/year/source-checksum is idempotent; different metadata
   under the same identity is rejected. Staging is invisible to public readers.
2. `append`: `{release_id, rows}`; 1–500 rows and at most 1 MiB per request.
   Ordinals must be within the expected range. Exact retries succeed; changed
   rows at an existing ordinal reject the whole batch. Interrupted batches can
   all be replayed while staging; do not assume a count proves which rows arrived.
3. `publish`: `{release_id, confirm_publication:true, expected_current_id:null}`
   initially; replacements specify the exact currently published UUID from
   `browse_school_finances`. Count and exact salary/payment/travel totals must
   reconcile. Replacements need newer retrieval evidence. The transaction locks
   the dataset/year, retains history and replaces the current release atomically.
   A confirmed retry for the already-published release succeeds. Do not append
   after publication. A failed/partial import never replaces current data.
4. `withdraw`: `{release_id}` hides the release immediately from finance reads;
   it never revives a superseded release. Its generated person profiles become
   unlisted and their source affiliations are removed. Static profile withdrawal
   follows the site's normal rebuild workflow; previously downloaded files and
   HTML copies cannot be recalled.

Publication requires **a reviewed complete dataset**. The API does not download
or independently attest original files: the collector must retain and verify
bytes, filters, totals and approval evidence before setting the confirmation.
The updater currently cannot publish; its collector/publisher integration is
tracked separately. No production import or deployment is performed by tests.

## Employee person records and identity review

Payroll can link a reviewed existing person during staging; see the reviewed
links contract below. Unresolved rows create separate public `people` stubs,
including identical names, with kind `other`, the reported job title and a
historical source description. There are no employee IDs in the source. Only
unresolved identities receive `identity_review_required=true`; source names
remain exactly as reported.
The organization affiliation says `Payroll record FY2025 (identity needs review)`
rather than asserting current employment. No employee contact details, individual
schools or work locations are inferred. Payment recipients are not automatically
classified as people: the export also contains organizations and payroll totals.

Repeated names remain separate when identity is uncertain. Cross-year and
corrected releases can share a canonical person after evidence-backed review;
unresolved rows retain separate source profiles. Superseded profiles retain historical provenance
and gain a superseded-source notice. Publication retries create no duplicate
profiles. New source profiles enter existing person search, affiliations and
static profile publication. Finance rows link to the existing UUID person viewer;
pretty profiles appear after the normal rebuild.

`review_person` accepts `{release_id,row_number,person_id,confirm_identity:true,
review_note:"Source-backed verification, at least ten characters"}` for a
published payroll release. It checks the current row/person binding, clears the
flag and records the review note on the row. Source-owned stubs also receive the
review note on their profile and affiliation; canonical profiles are preserved.
It does not merge people or transfer links. Existing admin person editing remains
available; reconcile identities only with additional evidence. Original payroll
names and amounts remain immutable. Private/unlisted person IDs and review flags
are omitted from public finance projections; source payroll facts remain public.

## Search and UI

`browse_school_finances(p_dataset='payments',p_year=null,p_query='',p_offset=0,
p_limit=50,p_sort='amount',p_person_id=null)` returns only current published
releases, including for administrators. It projects public provenance, available
years, filtered count/totals and up to 100 rows. A null year selects the latest
published year **of that dataset**. Missing years return a null release. Name/title
search uses a generated simple-language tsvector with a GIN index; all terms must
match. Sort is amount descending or name ascending, with deterministic ties.
The optional person filter requires a public linked person. The same read is
available as MCP `school_finances` with `operation.action=browse`.

`/finances/` supports dataset/year, search, sort, 50-row pagination, current-page
CSV and expandable provenance. Dataset/year/query/sort/person filters are
shareable in the URL. Navigation, the Bibb hub, search page and school profile
link to it. Imported people already participate in general site search; finance
amount/recipient search uses this dedicated view. There is no new global-search
SQL branch for financial records in this release.

Counts are source records, not unique employees, headcounts or invoices. SALARY,
SALARIES and BENEFITS payment entries are labeled payroll aggregates. Never add
payment totals to payroll. Missing data is not zero. All totals follow the search;
CSV downloads explicitly cover the current page. Money and travel stay separate.

## Release and verification

Migration `20261125001000_school_finances.sql` was generated with the CLI and
ordered after existing migrations. Merge it to GitHub main before production
application through the integration or guarded push. Then deploy the MCP bundle
and static frontend, and only then publish approved data. Never apply feature
SQL to production. Preserve existing migrations and history.

```sh
bun test scripts/tests/school-finances.test.ts scripts/tests/school-finances-mcp.test.ts
FINANCE_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/school-finances-db.test.ts
FINANCE_SOURCE_DIR=/path/to/saved-exports FINANCE_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/school-finances-db.test.ts
bun run mcp:check
bun run mcp:build
bun run plugin:build
bun run check
bun run build
```

Database tests reuse an applied feature schema or install feature DDL inside rollback
transactions; use only a local or disposable preview database. The optional source
test expects `payments-2024.csv`, `payments-2025.csv` and
`SalaryTravelDataExport2025.txt`. It validates 2,749 / 2,586 / 4,260 records,
respectively, exact totals and person creation. Originals and bundles stay outside
Git. Browser checks must cover anonymous and signed-in read/search, pagination,
identity notices/profile links, no results, unavailable years, retry, downloads,
mobile overflow and console health. Finance withdrawal and staging must remain
absent from public responses.

`school_finances` is exposed only on the compact v2 MCP endpoint
`https://api.civpulse.org/functions/v1/mcp/v2`. The compatibility catalog is already
at 128 tools and is unchanged. Updater publishers must select v2 and refresh tool
discovery after deployment. RPC readers remain available to the static browser.

Updater follow-ups: [collector #11](https://github.com/CivicPulse/updater/issues/11)
and [authenticated publisher #12](https://github.com/CivicPulse/updater/issues/12).

The [fresh-download test report](research/bibb-school-finances-test-import-2026-11-01.json) records original checksums, exact totals, 4,260 distinct employee profiles, seven repeated-name groups, retry checks and anonymous readback. The test rolled back all records and schema changes.

## Payment recipient profiles

Migration `20261125001100_school_finance_recipients.sql` adds a shared recipient
registry and a `recipient_id` foreign key on each nonaggregate payment row.
At publication, a single exact name match across existing organizations and
people is reused. Matching ignores case and repeated whitespace, but preserves
punctuation; there is no fuzzy matching. Missing or ambiguous matches create a
public **provisional organization stub**, as requested by the user. Stubs and
unverified matches are marked for identity review. This provisional type does
not establish that the recipient is legally an organization. Long source labels
stay intact in the finance records; profile display names fit existing limits.

SALARY, SALARIES and BENEFITS remain aggregates with no recipient profile.
Registry mappings are reused across years/releases and exact publication retries;
the immutable source name, amount and original row number do not change. Staging
creates no profiles. Existing published releases are linked by the migration.
Resolving a recipient does not delete a previous stub or unrelated affiliations.

The admin `resolve_recipient` action takes `recipient_id`, `kind` (`person` or
`organization`), a sourced `review_note` of 10–2000 characters, and optionally
`target_id`. An existing target confirms the reviewed mapping. Omit `target_id`
to create a stub of the selected kind; that new stub still needs identity review.
This changes the shared mapping for every linked payment, not the source facts.
The reporting organization remains independently linked on the release.

Public browse rows include a `recipient` object with kind, profile ID/slug/name,
stub status and review flag. Private/unlisted people and all their mapping IDs
are omitted, even for signed-in/admin public browse. The source payment label
remains public. The registry has RLS and no direct API-role table grants. Original
import/read implementations live in a non-exposed private schema with revoked
API execution; public wrappers retain admin checks and publication visibility.

The UI links recipient names to their profiles and distinguishes provisional
stubs, unverified links and reviewed identities. New pretty organization pages
appear after the normal rebuild. Runtime finance search reflects publication
immediately. Run `FINANCE_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/school-finance-recipients-db.test.ts`
for exact/ambiguous matching, cross-year reuse, identity correction, hidden-person
redaction, retries, FK integrity and role/execute-grant checks.

## Reviewed payroll links (migration 20261125001200)

The current import policy links payroll to an existing person when independent
source evidence supports the match. During staging, `resolve_payroll_person`
accepts `{release_id,row_number,person_id,confirm_identity:true,review_note}`.
The sourced note must contain 10–2000 characters. Exact retries are accepted;
a conflicting target is rejected. Matching is an explicit editorial decision,
not an automatic fuzzy-name join. Name order, punctuation and initials can differ;
check job/organization context and ambiguity before linking.

Unresolved rows receive separate person stubs marked for review, including
same-name rows that cannot be distinguished. Matched rows clear that flag and
retain their original source name, title, amounts and row number. Linking never
rewrites an existing biography, visibility or affiliations. Finance rows themselves
retain the reporting organization. Withdrawal and supersession affect only
profiles generated for that source, preserving linked canonical people.

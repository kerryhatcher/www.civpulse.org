# Georgia SOS JSON evidence contract, version 1

Pass the exact UTF-8 JSON text as `operation.document` to `manage_election_results`
action `import_turnout`, along with its lowercase SHA-256 as `operation.sha256`.
Maximum 2 MiB and 636 rows; one atomic transaction, dry run by default.
All objects reject keys outside the lists below. No raw session/auth data is allowed.

Root fields (all required):

| Field | Type / value |
| --- | --- |
| schema_version | integer `1` |
| provider | `georgia-sos-turnout` |
| election_id | existing election UUID |
| election_date | `YYYY-MM-DD`, matching that election |
| status | `unofficial` |
| source_url | `https://sos.ga.gov/page/election-data-hub-unofficial-turnout` |
| app_id | `137c0a43-928b-427a-a267-eb55aa7fa8a9` |
| capture_run_id | collector run UUID |
| captured_at | collection instant, ISO 8601 with explicit UTC offset |
| upstream_sha256 | 64 lowercase hexadecimal characters; collector reference, distinct from document hash |
| tables | exactly three table objects, one of each below |

Table fields: `table`, `object_id`, `source_title` (1–300 characters),
`as_of_label` (0–200 characters), `as_of` (ISO instant or null),
`as_of_timezone` (always `America/New_York`), `rows` (array).
An absent footnote is `as_of_label:""`, `as_of:null`. A present footnote must
match `*Data as of : M/D/YYYY h:mm:ss AM` or `PM` and its New York instant.
Collection time is never a substitute for missing source time.

| table | object_id | measure keys |
| --- | --- | --- |
| early | `7cc869cd-2124-43be-82f4-1c8d394dc6d8` | accepted |
| absentee | `CTgPMg` | requested, issued, returned, accepted, rejected, spoiled_canceled, outstanding, acceptance_ratio |
| turnout | `QDFdpV` | turnout |

Row fields (all required):

- `county_fips`: five-character Census Georgia county code, e.g. `13021`.
- `county_label`: original county name, e.g. `BIBB`; must match that code ignoring case.
- `ballot_style`: original `Early In-Person` or `Absentee`.
- `counting_group`: respectively `advance` or `absentee_mail`.
- `locator`: precise source row locator, 1–500 characters; include object, county and style.
- `measures`: object containing exactly the keys for that table.

`early` rows use `Early In-Person`; `absentee` rows use `Absentee`. Turnout rows
retain their original style. County/style pairs must be unique within each table.
Each measure is exactly `{"value":123,"display":"123"}`. Counts are safe
nonnegative integers, at most 9007199254740991; acceptance_ratio is a numeric
fraction in [0,1], such as `{"value":0.5,"display":"50%"}`. An unavailable
measure uses `{"value":null,"display":"—"}` with the actual source display
text. Display strings have at most 200 characters. Never infer zero or denominators.
Suppressed rows stay absent; the three arrays need not have full county coverage.
No candidate votes, winners or certification fields exist in this contract.

First read action `read_turnout` with `election_id`. Then import with
`expected_report_id` equal to the current report UUID, or null for the first
snapshot. Use `dry_run:true`, then `dry_run:false` when authorized. Exact replay
is a no-op. Newer corrections preserve the predecessor and may lower counts;
stale captures/source times, changed values at unchanged source times and stale
predecessors reject. Retry the entire unchanged batch after an uncertain outcome.

Read action `read_turnout` accepts `election_id`, nullable `report_id`, `offset`
(default 0) and `limit` (1–100, default 100). The response contains `report`,
`rows`, `total` and up to 100 latest `history` metadata entries. Pin `report_id`
when paging. Rows add table/object/title/as-of provenance to the stored fields.
The report contains source/app/capture metadata, `id`, verified `sha256` and
`supersedes`. Raw document bytes and editor IDs are not in public readback.

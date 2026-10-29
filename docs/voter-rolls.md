# Admin-only voter roll history

This backend data model stores Georgia SOS **full county registration rolls**
without creating public people profiles. The initial sources are the February
2026 Bibb and Houston files located on Kudzu; see the
[source inventory](research/voter-roll-inventory-2026-10-29.md).
The model and RPCs are implemented; a file importer and browser management page
are not yet implemented. No real voter records have been imported by this change.

## Objects

| Object | Purpose |
| --- | --- |
| `voter_roll_imports` | County FIPS, source snapshot date, original filename and SHA-512, expected record count, importing admin/time, completion time and optional correction predecessor |
| `voter_roll_records` | One original 53-column SOS row per registration number per import, plus its CSV source row number |

The composite primary key is `(import_id, registration_number)`. The registration
number identifies a voter across these Georgia SOS files; a name or address does
not. Keep registration numbers, postal codes, dates, district codes, empty cells
and all other CSV values as **strings**, including leading zeros. Each record's
`data` JSON object uses the exact 53 source header labels. SQL validates all keys,
string values, a numeric registration-number string, nonempty status, matching
county and source-row bounds. Unknown columns require a reviewed schema change;
they are not silently dropped. Original CSV bytes must be retained separately
in restricted storage when a file importer is implemented.

No name/address fuzzy matching or linkage to vendor/VAN IDs is performed. If an
SOS registration number changes, records remain separate pending an explicit
identity reconciliation; a shared name is insufficient evidence.

## Import contract

Only authenticated administrators may call the following RPCs:

1. `begin_voter_roll_import(p_county_fips, p_snapshot_date, p_source_filename,
   p_source_sha512, p_expected_records, p_supersedes_id=null)` returns an import
   UUID. `13021` is Bibb; `13153` is Houston. Snapshot date describes the source,
   not the day it was uploaded. An identical county/date/checksum retry returns
   the same UUID if the other metadata agrees.
2. `append_voter_roll_records(p_import_id, p_rows)` accepts 1–1,000 rows and at
   most 2 MiB of JSON per atomic call. Each item is
   `{ "source_row": 2, "data": { ...all 53 SOS columns as strings... } }`.
   `source_row` is the logical CSV record number including header row 1, not a
   physical line number when quoted cells span lines. Exact retries are harmless;
   conflicting retries, duplicate registration numbers and duplicate row numbers
   are rejected without partially saving the batch.
3. `complete_voter_roll_import(p_import_id)` checks the record count and seals
   the snapshot. Only then does it participate in the history reader. Completion
   and append serialize on the import; completions also serialize per county.
   Completion retries are harmless. API roles cannot update/delete source rows
   or modify metadata directly, even as administrators.

Expected count must be positive. Unique, bounded source row numbers plus the
exact count ensure every declared row is present. A future importer must parse
the **entire** original file, validate CSV quoting and headers, compute SHA-512
over its exact original bytes, verify county coverage and provide the parsed
count. The database records the declared file checksum; it cannot independently
verify original bytes from JSON batches. Never pass a filtered file, incremental
update, election participation file, active-only subset or truncated download as
a full county snapshot. A zero-row file is rejected to prevent accidental mass
absence; a genuinely empty county would require a reviewed exception.

Incomplete staging imports remain available for admin inspection/retry but never
establish an absence. No automatic cleanup deletes history. Importing real rolls
and archiving original files are separate follow-up work.

## History and disappearance

`get_voter_roll_history(p_registration_number, p_limit=100, p_offset=0)` returns
the registration number, total event count and chronological `history`. Each
entry includes source import/date/county, filename/checksum/row, original `data`,
`previous_data`, event and a `changes` object keyed by changed source column.
For example, a status change contains
`"Status": { "before": "ACTIVE", "after": "INACTIVE" }`.

Events are evaluated independently within each county:

- `first_seen`: first appearance in that county's effective snapshots.
- `changed` / `unchanged`: compare every source field with the preceding snapshot.
- `missing_from_snapshot`: present previously, absent from the next complete roll.
- `still_missing`: absent again in a subsequent complete roll.
- `reappeared`: present after at least one complete snapshot without that voter.

Missing entries have `data=null`; the old source row is retained in its import.
Presence transitions use their event and before/after data, rather than reporting
every field as deleted/added. For `reappeared`, consult the earlier history for
the last known source values. Pagination is applied **after** computing events,
so page boundaries do not reset comparisons. Entries include unchanged snapshots
to show continued observation. No entries are fabricated before first appearance
in a county, or after its latest completed snapshot.

An SOS status is kept exactly as supplied. Inactive status is not inferred to be
removal. Missing from a full county roll is evidence of absence from **that
snapshot**, not proof of cancellation, death, ineligibility or statewide removal.
A later Houston appearance can coexist with a Bibb absence for the same number;
the system does not invent a move reason. The change happened between source
observations unless the source explicitly provides a relevant date. Neither
snapshot date nor upload time is automatically the actual removal/change date.

## Corrections and backfills

An older snapshot may be imported later; history sorts by **snapshot date**,
not upload time. A different file for the same county/date must explicitly name
the latest completed same-date import as `p_supersedes_id`. A stale predecessor
is rejected at completion, including competing corrections. The history reader
uses the latest completed correction for each county/date, while original and
superseded source rows remain available to admins in the tables. Corrections
can therefore revise derived change events without erasing original evidence.

## Privacy, release and verification

Both tables have RLS with `public.is_admin()` SELECT policies. Anonymous roles
have no table or RPC grants. Ordinary authenticated users see no table rows and
RPCs reject them. Only checked administrator RPCs may write; API roles, including
the service role, have no direct mutation grants. The database owner remains a
trusted maintenance principal. Voter tables are excluded from the general public
object-history registry, search, public people profiles and static build readers.
Future UI must fetch after an admin check at runtime; never embed these records
in HTML, public JSON, map layers, logs or the public document archive.

The new migration follows existing applied versions as
`20261125000700_voter_roll_history.sql`; it was initially generated using
`supabase migration new`, then assigned the next unused repository version.
Merge to GitHub main before production application. No production migration or
real-data import is part of this change. The old data host remains out of scope
at the owner's request.

Run the rollback-only database test against local Supabase:

```bash
VOTER_ROLL_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres \
  bun test scripts/tests/voter-roll-history-db.test.ts
bun run check
bun run build
```

The test installs the migration within its transaction when needed, uses only
synthetic voters, and rolls back schema and fixtures. It checks full snapshots,
retry conflicts, immutable history, absence/reappearance, source-field changes,
cross-county observations, corrections, backfills, pagination and access denial.
The existing Meeting imports and originals GitHub workflow also runs this test
against its disposable local Supabase database on pull requests and main pushes.

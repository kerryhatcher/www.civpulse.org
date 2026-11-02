# Sourced meeting imports and original documents

Issue #40 extends the existing attendance, motion and choice model. It does not
resume paused source collection, recreate historical meetings or publish archives.
Apply the append-only meeting migrations through main before deploying the MCP
bundle. Feature SQL is tested locally only. Refresh connected tool discovery after
deployment; `bun run plugin:build` regenerates the plugin's schemas and tool guide.

## Import contract

Call `import_meeting_records(meeting_id, provider, records, dry_run=true)` through
MCP, or the same PostgREST RPC with `p_` parameter names. Resolve existing event and
person UUIDs; the event must already be a meeting. At most 100 records / 2 MiB of
JSON enter one transaction. Send attendance, then voting rounds, then choices.
Each row has `source_key`, `kind`, `data`, and `provenance`:

```json
{
  "source_key": "meeting:35355:item:YphplusBPTIr6anygm63ZhOMA==:round-index:0:miller",
  "kind": "choice",
  "data": {
    "person_id": "2f8e724b-6bd6-4e79-b45f-878efaa02c8a",
    "vote_source_key": "meeting:35355:item:YphplusBPTIr6anygm63ZhOMA==:round-index:0",
    "choice": "yes",
    "original_text": "Yes: Mr. Lester M. Miller"
  },
  "provenance": {
    "source_url": "https://simbli.eboardsolutions.com/SB_Meetings/ViewMeeting.aspx?S=4013&MID=35355",
    "document_sha256": "d7bcc37ce12bafe704c3b6e52ddf7b882ca54b1aa853e7031479475677ebd4f7",
    "locator": "LstItemMinutes[1].ChildMinutesLst[0].MeetingOnlineVotings[0]"
  }
}
```

The checksum above identifies the saved published-minutes JSON.
The source-backed test fixture contains the verified digest and locator from the
saved December 19, 2013 published-minutes JSON, without capturing new source data.
Its encrypted item ID is preserved. The round has no official ID, so the array
index is explicitly labeled as a local locator.

Attendance data requires `person_id`, `status`, and `evidence`. Use `observed` for
an explicit named cast ballot at that moment, `unknown` for roster-only evidence;
`present`, `absent` and `excused` require independent source support. Existing
attendance identities must be reconciled rather than overwritten. A vote requires
`subject`; optional `description`, `agenda_context`, `position` and `outcome` retain
motion wording, agenda context and order. Separate rounds use distinct source keys.
Choice data requires the person UUID, vote source key, normalized choice and original
text. Choices are yes/no/abstain/recused/unknown. “Vote Not Recorded” stays unknown;
unknown does not require a presence assertion. A cast ballot requires present or
observed attendance. No import derives choices/outcomes from totals, unanimity,
sponsorship, service dates or a Voting Members roster. Outcomes are nullable.

The database locks the meeting for concurrent imports. Exact replay returns the
same canonical IDs and unchanged counts. Changed source snapshots or changed
canonical fields reject the entire batch for explicit reconciliation; this first
version never patches a previously sourced observation (`updated` remains zero).
Do not bypass conflicts by inventing new source keys. Omission never deletes
records or editorial notes. Dry runs exercise real constraints in a rolled-back
subtransaction: returned new UUIDs are provisional. A failed batch returns zero
created/updated and an indexed field error; the rejected count covers the whole
batch. Authentication/invalid envelope failures return RPC errors.

`get_meeting` includes provenance for already-visible people. The paginated
`get_person_meeting_votes` RPC/tool adds organization and inclusive date filters,
source wording and provenance. It uses the same public discovery gates as profile
votes; ordinary signed-in users have anonymous visibility. Unlisted meetings are
reachable by direct meeting UUID, but only admins discover them in person histories.

## Original bytes and resumption

Connected agents should use the authenticated MCP chunk relay described below.
Direct TUS remains for applications already holding their own user session; never
extract a general token from connector/browser internals to make that handoff.

`begin_meeting_attachment_upload` requires meeting UUID, provider, stable source
key, file name, exact byte count, lowercase SHA-256 and original HTTPS URL. It
returns an immutable session UUID/path, a scoped signed upload token, TUS endpoint
and metadata. Supported types are PDF, Office, OpenDocument, TXT, CSV and JSON.
The exact maximum is **26,214,400 bytes (25 MiB)**. Inline legacy base64 is capped at
3 MiB; transport observations do not establish its historical failure's root cause.

Use [Supabase's resumable protocol](https://supabase.com/docs/guides/storage/uploads/resumable-uploads):
POST to the returned endpoint with `Tus-Resumable: 1.0.0`, `Upload-Length` and
base64-encoded `Upload-Metadata` entries (`bucketName`, `objectName`, `contentType`).
Send the returned `x-signature`; gateways may also require the connected user's
`Authorization: Bearer <access-token>` and the public `apikey`. Never send a
service key. Persist the returned Location and use HEAD's `Upload-Offset` before
resuming PATCH requests with `Content-Type: application/offset+octet-stream` and
6 MiB chunks (last chunk may be smaller). Never set `x-upsert`. Prefer the direct
`<project>.storage.supabase.co` hostname for hosted projects.

Sessions last 24 hours; signed upload tokens last two hours. Repeat begin with
identical metadata to refresh the signature within the session lifetime. Changed
metadata conflicts; complete/cancelled/expired receipts do not create fresh uploads.
TUS handles partial offsets; session status reports whether the object has reached
Storage and whether canonical metadata exists. A missing status object may still
have partial TUS chunks: consult the saved Location.

Finalize downloads the stored original under the admin's token, validates exact
size, PDF/Office signature or JSON parse where applicable, and calculates SHA-256.
It then calls `finish_meeting_upload`, which locks the session, checks Storage
size/MIME, and atomically creates one canonical attachment/checksum/source receipt.
The low-level RPC accepts an admin-verified digest; admins are trusted editors.
Use MCP finalization to verify bytes rather than supplying an unchecked digest.
This is format checking, not malware scanning or a certification of the content.
Concurrent finalization and retry after a lost receipt return the same attachment.
`manage_meeting_attachment_upload` reconciles state by session ID; `get_meeting` and
`get_meeting_attachment_url` expose the completed file through existing visibility.
Pending bytes are admin-only, and public archive publication stays explicit/separate.

Cancel unfinished sessions with `manage_meeting_attachment_upload (action=cancel)`.
Cancellation records a durable receipt and removes any completed staged object;
it does not terminate partial TUS resources or revoke issued capabilities. Private
partial bytes remain until Storage expiration. An in-flight PATCH can still finish
an object, so repeated explicit cleanup may be required. Completed canonical
attachments cannot be cancelled.
`manage_meeting_attachment_upload (action=list_cleanup)` pages expired/cancelled receipts for explicit cleanup.
Already-issued Storage tokens/TUS URLs cannot be revoked by the database state
change. Repeat cleanup after those capabilities expire (up to 24 hours); partial
TUS data expires in Storage. Keep receipts and never delete objects from the paused
historical backfill as part of this workflow.

## Authenticated MCP byte transfer

After migration `20261125002100` and the matching MCP deployment, connected agents
can transfer original bytes entirely through existing tools:

1. Call `begin_meeting_attachment_upload` with the stable meeting/provider/source
   identity, exact byte count and original SHA-256. Retain the returned session ID.
2. Split original bytes into **at most 262,144 bytes (256 KiB)** per call. Send
   `manage_meeting_attachment_upload(action=transfer_chunk,id,offset,data_base64)`.
   Offset is a byte offset, not a base64/string offset. Standard canonical base64
   has at most 349,528 characters; no data URL or whitespace. Never send the whole
   large file in one tool request. Source bytes must not be re-encoded/reformatted.
3. Use returned committed `offset` for the next chunk. After an uncertain MCP
   response, call `transfer_status`. If a `pending_chunk` is reported, resend
   that **exact original chunk at its original offset**; the server reconciles
   its already-accepted prefix using HEAD and sends only the remainder. Conflicting
   replay bytes fail. Retrying committed chunks returns unchanged, without PATCH.
4. At the original byte count, call `finalize_meeting_attachment_upload(id)`.
   Existing download/type/size/SHA-256 verification and atomic canonical receipt
   remain in force. Retry the same session after a lost finalization response.
   Download through `get_meeting_attachment_url` and independently compare SHA-256.

The server uses the caller's verified MCP authentication internally with the
project's public key; agents do not supply/export a bearer or service key. It
persists a private, initiating-admin-bound TUS Location, a two-minute lease and
chunk hash/length receipts. No document bytes are stored in Postgres. It validates
configured Storage origin/path, disallows redirects, and checks HEAD length and
bucket/object/MIME metadata against the exact session before forwarding bytes.
Raw Locations, leases and auth headers are not returned by the MCP relay; errors
do not echo upstream bodies/headers. Another administrator cannot take over a
claimed transfer. Existing admin finalization/attachment permissions are unchanged.

If an internal Storage POST response loses its Location, the durable creation
intent produces `creation_uncertain` and prevents blind duplicate POSTs. This is
an explicit **operator-reconciliation limitation**, not automatic creation recovery:
keep the receipt, inspect Storage/transfer diagnostics, and do not invent a source
key or export a token to bypass it. A missing/expired TUS resource or failed HEAD
also stops byte forwarding. Leases expire after two minutes if the MCP request is
interrupted; retry once the lease has expired. Storage partial resources/capabilities
retain their existing expiration behavior, and cancellation still needs the existing
explicit cleanup/reconciliation discipline. No archive publication is automatic.

A narrowly confirmed pre-creation JWT-expiry rejection can return
`authentication_required` after safely clearing its empty creation intent. Refresh
the connection and retry the same session/chunk. Other rejection shapes, lost POST
receipts, missing Locations, and failure to persist the reset remain
`creation_uncertain`; do not blindly repeat creation. Completed direct-TUS sessions
report `complete` with the final offset/attachment UUID even without relay state.

Supabase's direct-client example uses 6 MiB chunks. The MCP relay deliberately uses
smaller protocol PATCHes to stay below its transport envelope; the upstream TUS S3
store supports persisted incomplete parts. Local Storage tests verify this path;
**hosted connector/S3 behavior remains a release acceptance check**, not a claim
established by the local filesystem-backed fixture.

## Release and verification

Run `MEETING_IMPORT_INTEGRATION=1 bun test scripts/tests/meeting-import-integration.test.ts`
with local Supabase and the seeded admin. It exercises real Auth verification,
MCP protocol serialization, PostgREST/RLS, Storage TUS, interruption/reconciliation,
concurrent import/finalize replay, source conflicts and synthetic named-choice
cases. Fixtures are local and cleaned up. It tests the reported PDF sizes and
25 MiB maximum with deterministic transport fixtures. To additionally verify the
captured originals, set `MEETING_ORIGINAL_CAPTURE_ROOT` to the paused capture export;
the test checks manifest digests and uploads the two actual PDFs without source requests.

Run `bun run mcp:check`, `bun run mcp:build`, `bun run plugin:build`, `bun run check`
and `bun run build`. Verify a local person/meeting anonymously and signed in,
including the named Yes example and observed-only attendance. Public anonymous slug
profiles use build snapshots; rebuild after import. Signed-in/UUID profiles and
calendar meeting viewers read live. Production acceptance still requires the main
migration/deployment sequence, authorized import against the existing Miller/meeting
UUIDs, and checking the rebuilt public Lester Miller profile. API success alone
is not proof of public site visibility.

Local verification on October 26, 2026 also exercised the captured 5,179,685-byte
Head Start Operating Agreement (`e711a9a80b7f2b93f55e265f89e2cc8621cb849b8a4d81c522c7f9cb1471cfe7`)
and 20,968,285-byte Monthly Report
(`782c470ac434f651eb14ffd633513a2dd971058e152e0860c7bd1fd8f0e67b41`).
Both original downloads matched their captured digests. This local verification
created no production records and made no requests to the source provider.

Release review also covers named source labels such as
`Vote Not Recorded: Mr. Lester M. Miller`: the append-only wording guard rejects
normalizing those rows to a cast ballot, just as it rejects the bare label.

## Cited outcome observations

After the cited-outcome migrations reach main and are applied, administrators can
use the compact MCP endpoint's `set_meeting_vote_outcome` tool. Supply `vote_id`,
`outcome` (passed/failed/tabled/withdrawn), an original `https://` source URL,
lowercase document SHA-256 and exact page/item/round `locator`. Download and hash
the exact original bytes and check the exact motion. This API records the admin's
source assertion; it does not fetch the document, validate its hash against remote
bytes or independently certify the interpretation. The source, locator and public
correction reason must contain no private account information.

The RPC appends an observation; it never updates the imported vote, ballots,
attendance or `meeting_record_sources` payload. Exact replay of the current
observation (outcome **and citation/correction inputs**) returns `unchanged`.
A changed request returns `conflict`, without writing. Read `get_meeting` to
reconcile, then explicitly pass the current observation ID as `supersedes_id`
and a nonempty `correction_reason` to append a correction. A stale ID conflicts.
Correcting a nonempty original outcome also requires a reason, even when no cited
observation exists yet. Keep old observations; do not delete and recreate motions
or invent import source keys. Check the returned status, not merely HTTP success.

The effective outcome is the latest cited observation, falling back to the original
recorded outcome. Readers return `original_outcome`, current
`outcome_observation`, chronological `outcome_observations` and
`original_sources`. Meeting pages and person vote histories expose the evidence,
original result and correction history; source/attachment-aware meeting responses
are retained. Public calendar/profile snapshots carry these fields after rebuild.
Observation timestamps label when the editorial observation was recorded, never
when the source was published or the whole record verified. Public history redacts
editor account UUIDs; admins retain attribution. Private event/calendar/election
and participant gates, discovery limits, filtering and pagination are unchanged.

### CivicClerk passFail and a reviewable backfill

[Issue #126](https://github.com/kerryhatcher/www.civpulse.org/issues/126) reports
that code `1` matched “approved” in the minutes examined, while two `-1` items
also had carried motions. That review is evidence about those cited motions, not a
universal provider-code definition. In particular `-1` must not be translated to
failed; `0` on an item without a recorded round does not create a vote. No numeric
code, tally, unanimity or sponsorship alone establishes an outcome. Unconfirmed
meaning remains unspecified. A passed pre-commission/committee motion is not a
claim that the full commission adopted the proposal; link the separate final vote
only when supported by its own record.

This change performs **no real-person or production outcome backfill**. After
main-first release, review small batches against posted official minutes: retain
original bytes/hash, exact meeting/item/round identity, quoted supporting language,
proposed outcome and committee/full-body scope; record reviewer and uncertainty in
a review artifact. Skip missing minutes or ambiguous rounds. Read existing
observations first, submit only verified citations, inspect created/unchanged/
conflict results, and recheck meeting/person histories and source links. Rebuild
and confirm the published snapshots before claiming the public site is corrected.
The issue's reported missing archives are an observation at the time of its review,
not a current guarantee that those minutes remain unavailable. Real backfill and
publication remain release follow-ups requiring source review, not feature SQL.

Tracked release/source-review follow-up: [#168](https://github.com/kerryhatcher/www.civpulse.org/issues/168).

### Issue #60 local verification and hosted acceptance gap

The isolated real Auth → MCP HTTP → PostgREST/RLS → Storage TUS relay test uses
deterministic PDF-signature transport fixtures of exactly **5,179,685** and
**20,968,285** bytes. Downloaded SHA-256 matches, with one canonical attachment
per session. Maximum serialized MCP request measured **349,748 bytes**, below
2 MiB; 100 bounded PATCHes transfer both fixtures. Tests cover lost PATCH/HEAD
receipts, exact/conflicting replays, owner/non-admin denial, private meeting and
cross-meeting download gates, uncertain POST blocking and finalization replay.
These fixtures are not the captured official PDFs and establish no source facts.

After main-first migration/MCP release, issue #60 still requires an **actual hosted
connector-only** run with the captured originals: 5,179,685 bytes / SHA-256
`e711a9a80b7f2b93f55e265f89e2cc8621cb849b8a4d81c522c7f9cb1471cfe7`
and 20,968,285 bytes / SHA-256
`782c470ac434f651eb14ffd633513a2dd971058e152e0860c7bd1fd8f0e67b41`.
Verify interruption/resumption and downloaded digests, one canonical attachment,
unchanged provenance, private visibility and no archive copy. Do not close that
hosted acceptance criterion from local test success. This branch performs no
hosted upload, production SQL, backfill, deployment or source collection.

## Compact and attached Simbli imports (issue #140)

After migration `20261125002300` reaches main and the MCP bundle is deployed,
`import_meeting_source` is available on the compact `/mcp/v2` catalog. The legacy
128-tool catalog and atomic `import_meeting_records` contract remain unchanged.
Default `dry_run=true` returns counts and up to 25 indexed errors (with an explicit
truncation flag); successful observations are not echoed. A compact request declares
`provenance: {source_url, document_sha256}` once, `attendance` with source key,
locator, person UUID, status and evidence, and `motions` with source key, locator,
subject, optional description and nested `ballots: [{person_id, choice, text}]`.
A ballot may specify its existing `source_key`; otherwise it is deterministically
keyed by its motion and person UUID. Resolve existing UUIDs explicitly first.
Up to 2,000 expanded observations fit within the unchanged 2 MiB expanded JSON cap;
a 150-observation synthetic meeting measured 14,002 bytes in one MCP request.

The new RPC is **ordered partial import in one database transaction**: attendance,
then each motion and its ballots. Each observation calls the existing immutable
import authority; rejected observations roll back individually and appear in the
report, while accepted observations commit together at transaction completion.
This is not all-or-nothing validation: a changed motion can conflict while missing
ballots for its existing source key are accepted. Check `created`, `unchanged`,
`rejected` and errors, not HTTP success alone. The default dry run executes the same
constraints and then rolls back **all** accepted observations. No source payload,
canonical description or original outcome is overwritten. Existing cited outcome
corrections remain a separate explicit operation.

For an attached capture, supply `attachment: {id, adapter: "simbli-minutes-v1",
people: [{name, person_id}]}` instead of inline attendance/motions. Names must match
source spelling exactly, including titles. The server resolves the attachment
under the meeting's current access gate, downloads its original bytes with the
caller's authenticated Storage client, checks byte count and the required SHA-256,
and checks the source URL against the captured Minutes document. It never fetches
a caller-supplied URL. Legacy attachments may lack stored hashes; the supplied
expected digest is still checked against the actual original, without rewriting
attachment metadata. This adapter accepts bounded TXT/JSON captures up to 2 MiB,
not arbitrary PDFs, raw provider HTML, or a universal Simbli export format.

The versioned adapter recognizes the existing labeled capture preamble plus a JSON
array of `{document, public_content}` entries, with exactly one `Minutes` document.
It walks `LstItemMinutes` / `ChildMinutesLst`, preserves item/round locators and
handles multiple `Voting:` text blocks inside one provider round plus `VotingHTML`
named-choice arrays. It reports motion-like items and unsupported voting text;
warnings or missing name bindings stop import for review. It does not execute HTML,
infer outcomes from “unanimous,” or derive attendance from a roster. Explicit named
cast choices support `observed`; explicit Not Present/Absent labels support absence
only for people with no cast choice in the document and do not create ballots.
“Vote Not Recorded” remains an unknown choice. Source approval labels are preserved;
source-reported votes do not establish formal minutes approval.

Start with `reconcile_only=true`. It returns document counts, exact locators,
existing imported motion source keys/IDs and ballot counts, plus missing identity
bindings/warnings. Reconciliation matches each ballot's person UUID **and** immutable
source key, not counts alone. `missing_ballots` retains exact source names, expected
choices/text and keys; `unexpected_ballots` retains the stored person/key/choice/text;
`ballot_differences` shows expected and stored wording/choices for matched identities.
Only an exact identity/evidence match is `complete`; missing-only ballots are
`partial`, and unexpected identities or changed evidence are `differs`, even when
counts are equal. These reports do not delete or overwrite imported observations.
An already-imported provider requires `attachment.source_keys`
for **every** parsed motion locator before writing. Map those locators to existing
immutable keys; use the optional `<motion locator>:<exact source name>` binding for
existing ballot keys and `attendance:<person UUID>` for attendance keys. A genuinely
missing motion needs a stable reviewed key. Never assign a fresh key to evade an
existing observation conflict; changed descriptions remain a reported conflict,
not a supersede operation. Uncertain responses are reconciled by repeating the
same request; unchanged observations retain their canonical IDs.

Read-only validation on November 2, 2026 downloaded the existing private August 20
and July 16 captures through the authorized connector. The adapter found **7
motions / 49 named cast ballots** and **18 motions / 129 named cast ballots**,
respectively, with no unparsed-motion warnings. Original capture bytes were kept
outside the repository; no production import, SQL or attachment mutation occurred.
Synthetic integration tests cover real local Auth, MCP, Storage downloads/checksum,
150-observation capacity, dry rollback, exact retry, partial conflicts, and private
meeting/non-admin gates on isolated API 54341 / DB 54342. This is **Refs #140**:
post-main deployment and an authorized actual hosted attachment import/reconciliation
remain release acceptance work. Read-only source counts and local fixtures do not
establish that production records have been completed or public pages rebuilt.

Repeat focused local verification with
`MEETING_SOURCE_LOCAL_STATUS=/path/to/isolated-status.json bun test scripts/tests/meeting-source-import.test.ts scripts/tests/meeting-source-import-integration.test.ts`.
The status file is private and must identify API 54341. Optionally set
`MEETING_SOURCE_CAPTURE_ROOT` to a private folder containing the authorized original
`issue140-aug.txt` and `issue140-jul.txt` downloads to repeat the count checks. Never
commit those files or signed download URLs; obtaining them is a read-only source
review, not permission to backfill production records.

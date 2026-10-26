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

Cancel unfinished sessions with `manage_meeting_attachment_upload (action=cancel)`, terminating
any saved TUS URL first. Cancellation records a durable receipt and removes a
completed staged object; completed canonical attachments cannot be cancelled.
`manage_meeting_attachment_upload (action=list_cleanup)` pages expired/cancelled receipts for explicit cleanup.
Already-issued Storage tokens/TUS URLs cannot be revoked by the database state
change. Repeat cleanup after those capabilities expire (up to 24 hours); partial
TUS data expires in Storage. Keep receipts and never delete objects from the paused
historical backfill as part of this workflow.

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

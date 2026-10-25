# Public document archive

The archive is an explicit publication channel for unrestricted civic documents.
It is separate from private Supabase meeting attachments. Uploading an attachment
does **not** publish it, and nothing backfills existing attachments automatically.

## Components

- `public_documents` is the Supabase catalog, with SHA-256 identity, provenance,
  original filename, size, document type, text origin and publication status.
- `public_document_meetings` links one document to multiple public meetings. A
  committee and full-board session can share one transcript without duplicate
  storage or duplicate search results.
- `apps/kb` is a separate Cloudflare Worker at `kb-api.civpulse.org`. It uses a
  caller's Supabase token, the public project key and the database admin allowlist.
  It never uses a service-role credential. The Astro frontend stays static.
- R2 bucket `civpulse-public-documents` is intended for public delivery through
  the R2 custom domain `kb.civpulse.org`. All objects placed here are deliberately
  public, regardless of later changes to meeting visibility.
- AI Search instance `civpulse-public-documents` indexes the bucket directly.
  The Worker returns matching passages, not generated answers. Query rewriting
  and similarity caching are disabled per request. Queries are explicitly
  submitted and rate limited to 20/minute per client IP per Cloudflare location.

The API accepts browser origins only from `ALLOWED_ORIGINS` and returns the
matching configured value in CORS responses. Attachment paths must contain the
selected meeting UUID and a valid attachment UUID before Storage is contacted.
Storage fetches use Workers-supported `redirect: 'manual'` and reject non-2xx
responses, so credentials cannot follow a redirect to another host.
Admin mutation RPCs explicitly revoke anonymous execution in the follow-up
`20261122000000_public_document_admin_execute.sql` migration. Interrupted MCP
attachment inserts retain their objects even when an immediate recovery read
is empty; inspect the returned attachment ID before retrying or reconciling.

## Publication and recovery

An admin chooses an existing attachment from a **public meeting on a public
calendar**, supplies an original HTTPS source URL, document type and text origin,
and confirms unrestricted public distribution. The Worker downloads only from
the configured Supabase Storage host and validates the actual size (max 25 MiB).
It hashes the bytes, reserves a pending catalog entry with a claim UUID, writes
R2, and finalizes the catalog entry as published. The object key is immutable:
`documents/<document-id>/<sha256>.<extension>`.

The database serializes claims and deduplicates by checksum. Existing published
bytes are reused; retries do not overwrite provenance. Pending entries can be
retried after ten minutes. An uncertain finalization preserves the R2 object:
inspect `list_public_documents(include_unpublished=true)` before retrying. No
destructive compensation runs after an ambiguous database response.

An approved R2 object can exist while its catalog entry is pending. Direct R2
delivery is public at that point; catalog listing and API search remain blocked
until finalization. Only approved public material may enter this workflow.

Publication is independent of the source meeting's visibility. Hiding a meeting
removes its relationship from public catalog results but does not withdraw a
separately published document. Use the explicit withdrawal action instead.

Withdrawal changes the catalog first, then deletes R2. Retry withdrawal if object
cleanup fails. Pending publications must finish before withdrawal; withdrawn
checksums cannot be automatically republished. R2 responses use `no-store` to
avoid long-lived CDN copies; configure no overriding cache rule on the domain.
Downloads saved elsewhere cannot be recalled. AI Search cleans its derived index
on its next R2 sync. Every returned passage is checked against the **anonymous**
live catalog projection, so stale or withdrawn entries are discarded immediately.
Do not expose an independent AI Search public endpoint/MCP endpoint that bypasses
this catalog check.

## File compatibility

The archive preserves the same PDF, TXT, CSV, Office and OpenDocument originals
accepted by the meeting uploader. Downloadable does not mean indexed. The API
marks unsupported/oversized originals as requiring a searchable derivative.
Current AI Search limits are 10 MiB for TXT and PDFs with OCR enabled, and 4 MiB
for supported rich formats. The live pilot successfully indexed the 3.8 MiB
PPTX presentation (six chunks), so PPTX is eligible within the 4 MiB conversion
limit even though Cloudflare's published format table omits it. Keep its TXT
fallback. Legacy PPT, DOC and ODP need a supported PDF or TXT derivative. No conversion service is
included in this first version. Publish derivatives explicitly and identify OCR
or automated transcription accurately. Local research critiques are not official
minutes. Indexing eligibility is advisory; actual ingestion success must be
checked in Cloudflare's indexed items/logs.

## Activation

Publication and content search are enabled in production for the approved
two-meeting pilot. A build never copies attachments automatically.
`PUBLICATION_MEETING_IDS` remains limited to the two approved event IDs. Local
frontend builds without `PUBLIC_KB_API_URL` still show the preparation state.

1. Apply the append-only `20261121000000_public_document_archive.sql` migration.
   The filename follows the existing future-dated meeting/audit migrations; it
   was generated by the CLI then moved after its dependencies before application.
   Never repair another checkout's shared local migration history to apply this.
2. Create the dedicated R2 bucket in the configured Kerry Personal account and
   connect the R2 custom domain `kb.civpulse.org`. Keep the development `r2.dev`
   endpoint disabled. No private or unlisted material belongs in this bucket.
3. Create an R2-backed AI Search instance with the configured name. Use the
   AI Search Index Engine service credential after explicit approval for its
   account-level scope. Configure the instance to use only this dedicated
   public bucket. Enable hybrid
   keyword/vector indexing and OCR, include `documents/**`, and configure custom
   metadata `document_id`, `document_kind`, `text_origin`. Leave the instance's
   public endpoint disabled. Set a deliberate sync interval and monitor indexing
   failures, including automatic sync pausing for inactive instances.
4. Validate `apps/kb/wrangler.jsonc`, then deploy the separate API Worker. Set
   `PUBLICATION_ENABLED=true` only when publication is authorized and set
   `PUBLICATION_MEETING_IDS` to the comma-separated authorized event UUIDs. An
   empty allowlist blocks every publication. The checked-in allowlist contains
   only the two pilot events. Enable search
   after a known test document indexes. Neither flag initiates a bulk upload.
5. Set `PUBLIC_KB_API_URL=https://kb-api.civpulse.org` in frontend build variables
   and rebuild the website. The deployed Supabase MCP wrapper defaults to this
   API URL; server-only `KB_API_URL` can override it. Deploy the generated function
   bundle and refresh the MCP catalog.
6. Limit the initial real-document pilot to the February 19, 2026 Bibb school
   board meeting and March 18, 2026 Macon-Bibb commission meeting. The user
   authorized those two meetings after the original synthetic-only restriction.
   Use `scripts/fixtures/public-documents-pilot.json` to identify the selected
   files; do not bulk-import other meetings. Verify download bytes, metadata,
   actual indexed passages and withdrawal before expanding publication.
   Both production pilot events currently have `is_meeting=false`; set it to
   `true` through the deployed MCP event editor before attaching any pilot file.

Do not enable a cache-everything rule on the download domain. Avoid uploading
active HTML or private metadata; filenames are bounded and path-free, and file
downloads use attachment disposition with the stored document MIME type.

## Verification

```
bun run kb:check
bun run kb:test
DOCUMENTS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/public-documents-db.test.ts
bun run mcp:check
bun run mcp:build
bun run plugin:build
bun run check
bun run build
```

### Two-meeting pilot

The committed manifest records source URLs, SHA-256 checksums, sizes and text
provenance. Original files stay outside Git. With the selected files in the
manifest's relative directory layout, run:

```sh
DOCUMENTS_PILOT_DIR=/path/to/pilot-2026 DOCUMENTS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres bun test scripts/tests/public-documents-pilot.test.ts
```

The pilot exercises the actual Worker handler, real Postgres RPCs/RLS and MCP
document decoder with source bytes. Storage, authenticated-user verification and
AI Search use local adapters; all database fixtures and migration DDL roll back.
The two local meeting rows use new IDs, so production events are never modified.
The test is skipped unless both local inputs are supplied. A manifest consistency
check runs without those inputs.

The October 25 run passed 104 assertions: nine accepted files (PDF, PPTX and TXT),
two oversized PDF rejections, checksum-preserving publication, repeated upload
deduplication, anonymous catalog/search projection and withdrawal with stale
search suppression. School files include the agenda, investment report, academic
presentation, extracted slide text and automated transcript. County files include
the SPLOST ordinance, Red Cross agreement and extracted packet/roadway text.
The original county packet (319,246,551 bytes) and roadway exhibit (71,881,354
bytes) exceed the 25 MiB upload limit and must not be sent through MCP as base64.
Their local TXT derivatives retain the original source URL and are labeled
unofficial extracted text. The live PPTX indexed successfully; its TXT derivative
is also available. The committee/full-board school recording is shared;
the selected full-board event retains its existing video URL.

**Production verification, October 25:** PR #12 deployed the catalog migration,
admin mutation permission follow-up, MCP function and static site. PR #13 added
the two-meeting publication allowlist. The archive API and dedicated public R2
bucket/custom domain are deployed. The site build uses `PUBLIC_KB_API_URL`.
Publication is enabled only for the two pilot IDs. The user explicitly approved
the exact nine public copies and the account-scoped indexing credential. The
R2-backed AI Search instance and Worker binding are deployed, with hybrid
keyword/vector indexing and OCR enabled. The independent AI Search public
endpoint remains disabled; public queries go through the catalog-checking API.

Nine attachments are stored on the production meeting records. Signed downloads
of every attachment matched the local SHA-256 and size. See
`scripts/fixtures/public-documents-production-pilot.json` for the exact files,
attachment IDs, provenance and checksums. The school PPTX/agenda/transcript were
uploaded through the admin UI; the other six uploads passed through MCP. The
county Red Cross PDF transfer timed out without creating an attachment record;
its all-page TXT derivative is the ninth production attachment instead.

All nine files are published. Every public R2 download matched its source SHA-256
and size, with the expected MIME, attachment disposition and `no-store` headers.
The live API returns 200 for status/catalog/search, 401 for anonymous publication
and 403 for untrusted origins. Real indexed queries for `budget`, `Red Cross` and
`Stone Creek` returned document passages and the correct meeting citations.
Anonymous and signed-in browser checks use the real index. Automated tests cover
withdrawal and stale-result suppression; the nine approved public copies are
retained, so no live destructive withdrawal was performed on them.

The original approvals were blocked by automatic review until the user explicitly
approved both steps. The failed bucket-only reader credential was revoked after
Cloudflare rejected its registration. No credential values were recorded. A
manual sync can return `7020 sync_in_cooldown`; wait for the cooldown before
requesting another sync rather than treating queued/running items as failures.

The database test installs this new migration inside a rollback transaction when
needed, and rolls back all tables and fixtures. It covers anonymous, regular-user
and admin access, confirmation, source visibility, claims, deduplication,
multi-meeting links and withdrawal. Worker tests exercise publication pause,
auth, trusted source retrieval, interrupted responses, stale search suppression,
rate limiting and origin checks without touching Cloudflare.

For local browser testing, `bun run kb:dev` uses port 8788. Override Supabase URL,
public key and allowed localhost origin in an ignored `.dev.vars`; keep remote
publication/search disabled. Configure `PUBLIC_KB_API_URL=http://localhost:8788`
only when the local database has the catalog migration. Without it the archive
page presents its preparation state and meeting editing works normally.

References: [R2 data source](https://developers.cloudflare.com/ai-search/configuration/data-source/r2/),
[supported formats](https://developers.cloudflare.com/ai-search/configuration/data-source/),
[AI Search pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/).

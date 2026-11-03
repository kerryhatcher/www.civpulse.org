---
layout: ../../layouts/DocsLayout.astro
title: Admin guide
description: Add board meeting notes and maintain the records people use across Civic Pulse.
---

Admin pages follow your browser or operating system’s light/dark appearance
setting, just like the public site. Changing appearance does not change access
or published content.

## Editorial correction workflow

The [editorial policy](/editorial/) names the confirmed operator/maintainer and
sets requirements for new/corrected material; it does not certify review of every
legacy record. The public [GitHub issue tracker](https://github.com/kerryhatcher/www.civpulse.org/issues)
is the correction channel. Reports require GitHub sign-in and are public. No
confidential contact or response-time promise is supplied; do not request private
record links, account information or sensitive personal data in a public issue.

For a report, identify the public record, exact claim and original dated source.
Reconcile identity/body/jurisdiction/service period before changing an association.
Compare automated transcripts/summaries/OCR to source documents or recordings for
material names, figures and choices. Retain uncertainty when evidence conflicts.
Use the record-specific editor/correction/import workflow, preserving original
source facts and revision history; do not overwrite immutable financial imports.

For a material change, add a dated correction note to the affected public
description/notes where supported, describing the changed claim, reason and public
report link. A note is scoped to that correction, not whole-record verification.
Use source dates accurately; edit/import/rebuild times are not verification dates.
After the successful rebuild, inspect the public record and related histories or
downloads before saying the correction is publicly visible. A merged PR/closed
issue or a saved edit alone does not establish publication. Explain unresolved
reports or no-change outcomes rather than inventing a correction notice. No
automatic triage, confidential inbox or historical notice register is implied.

## Civic topic guide maintenance

The Bibb pilot adds four resident-question guides under the existing county hub:
[following a government decision](/counties/bibb/government/),
[researching an election](/counties/bibb/elections/),
[property tax research](/counties/bibb/property-taxes/) and
[districting/apportionment](/counties/bibb/districting/). Do not clone these into
locality variants without distinct questions, public coverage and reviewed local
sources. The county overview remains the broad geographic/statistical entry.

The editor publishing a guide change owns its source review. This is a workflow
responsibility, not a new permission role or an assignment to a named person.
Before publication, review the official linking pages, linked resource purpose,
geographic scope and dated records. Review again when an official notice changes,
a correction is reported, or curation is expanded. Keep a source-review note in
the PR and update `BIBB_TOPIC_LINK_REVIEW` only after that review, never as a build
timestamp or automatic whole-record verification date.

The initial official linking-page review was November 1, 2026. County commission
and elections pages, Georgia.gov's sample-ballot guide and the SOS calendar were
checked. Direct automated portal/My Voter Page fetches returned access errors;
their links/purposes were confirmed from the official parent pages, not from
accessing personal voter information. No voting hours, eligibility determination
or current officeholder roster is copied into these guides.

The expanded tax/districting source review uses the Bibb Assessors' notice and
appeal materials, Tax Commissioner property/FAQ pages, DOR's Bibb facts, Census
apportionment explanation and Georgia Legislature's reapportionment resources.
The payment destination presents a verification challenge; its purpose/link was
confirmed on the Tax Commissioner's site. The legislature's office landing page
is application-rendered; its official process/resource PDFs provide background,
not a claim that any plan is currently effective. Do not copy rates, appeal/payment
deadlines, exemption determinations or litigation outcomes into the guides without
a separate source review. No parcel/payment dataset or tax calculation is supplied.

Public organizations, maps, affiliations, elections and calendar records supply
the guide previews at build time. Fix source records first, then publish. Record
dates may be past or future; they are not a live schedule. The local commission
roster/meeting coverage is incomplete, so retain the official-directory link and
explicit gap language. Do not match officials by name or infer a personalized
ballot from imported contests. The publishing editor must verify that new links
resolve and that private/unlisted records remain absent, including after sign-in.

## Source and refresh conventions

Cite material biography claims with Markdown links in the person's description,
including reference-style citations if useful. Identify which claim a source
supports and preserve any source date/period in the prose. Contact websites and
social links are not automatically biography citations. A cited link is a source
reference, not a declaration that Civic Pulse independently verified every claim.
If a biography has no citations, its provenance panel says so.

Keep date meanings separate: an article's **Published** date is its publication;
**Fetched on** is retrieval. Office service dates, election dates, and meeting/vote
dates describe the event or service, not when someone checked a source. Current
person/office/election/meeting models have no dedicated verification date, so
**Last verified** remains **Unknown**. Do not use an edit, import or site rebuild
timestamp to fill that gap, or parse a date mentioned in prose into verification.
Dated source notes can describe a particular claim and review scope; they do not
automatically become a whole-record verification status.

Maintain original office source links, election date/deadline links and ballot
question sources next to their claims. Check the original record before correcting
facts, retain historical context and publish a successful rebuild afterward.
Source retrieval is not a guarantee that a source is current or correct. Vote
histories cover added records only; attendance roll calls are excluded from
legislative history. Never infer a participation denominator, absence or opposition
from missing records. Private/unlisted source facts stay behind their access gates.

Public profile page titles use the person's recorded title (or type when no title
is recorded), and page descriptions use the record name and stored summary. Keep
historical roles and service dates explicit; do not turn an old title into a
current-office claim. Give each record a useful summary rather than repeating a
generic description. These metadata changes publish with the next site rebuild.

Public profiles now prerender office terms, candidacies, article associations,
meeting votes and individual nonattendance legislative choices from the existing
anonymous export. Larger histories have public continuation pages. Keep office
source URLs/date precision, article roles/publication/fetch dates, election
context and meeting/vote sources accurate. Missing service ends are labeled
unrecorded, rather than turning historical service into a current-office claim.
Publish after corrections or visibility changes so both the profile and its
history pages update. Signed-in interactive views retain live access checks;
admin-visible related records must never be copied into public evidence manually.

Public profiles also publish machine-readable names, portraits/logos and the
same public affiliations shown on the page. Maintain those source records
accurately and preserve historical wording: an affiliation is not automatically
an employer or current office. Website and social links remain ordinary contact
links; they are not automatically treated as verified identity (`sameAs`) links.
Do not enter private facts merely to enrich search markup.

Public event detail markup uses recorded dates and physical venue text. Keep
venues and dates accurate, and use election date kinds for deadlines and voting
periods so they are not labeled as attendance events. A venue name is not a
verified street address, and the calendar publisher is not automatically the
organizer. Search engines may require more verified facts before showing an event
rich result. Structured data changes publish after the next rebuild, alongside
the visible page; private/unlisted viewers and admin pages publish no JSON-LD.


## Voter roll history

The backend now has an admin-only model for historical SOS county registration
rolls. It preserves original snapshots so future imports can show changes to
registration details, absence from a later county roll and reappearance. An
absence does not by itself establish why a voter left the roll. Ordinary
signed-in accounts cannot access these records.

A voter-file importer and management page are not available yet. Do not upload
voter rolls into public people profiles, maps or the public document archive.

## Publish a meeting document to the public archive

Archive publication is separate from uploading a meeting attachment. When the
archive is configured, open **Meetings**, select a public meeting on a public
calendar, and expand **Publish to public archive** beneath an attachment. Supply
a title, original HTTPS source URL, document type and text origin, then confirm
unrestricted public distribution. **Publish document** creates an independently
public copy. Ordinary uploads never publish automatically.

Review **Public archive publications** for pending, published and withdrawn
copies. If a response is interrupted, check this list before retrying; pending
attempts can be retried after ten minutes. Identical bytes reuse one document.
For a combined committee/full-board transcript, the MCP's
`link_public_document_meeting` links the published document to the other meeting
without uploading another copy.

Changing meeting visibility does not withdraw an archive publication. Use
**Withdraw public document** to remove it from every linked meeting's archive
record and delete the public file. Retry file cleanup if needed. Copies already
downloaded elsewhere cannot be recalled. Pending publications must be resolved
first. The operator initially keeps publication paused; no existing files are
copied automatically. Oversized or unsupported originals need a supported PDF or
TXT derivative for content search.


Admin tools require an account with admin access. [Sign in to the Meetings admin page](/signin/?next=/admin/meetings/), or use **Admin** in the site header after signing in.

## Add notes from a board meeting

1. Open [Meetings](/admin/meetings/) and choose the board meeting from the **Meeting** list. The newest meetings appear first.
2. Enter your notes in **Meeting notes or minutes**. Include the meeting date, the main topics, decisions, and any next steps you can verify. Notes are plain text; use line breaks to keep them readable.
3. Add an optional **Video URL** for the recording. YouTube and Vimeo show an embedded player; other HTTPS hosts show a watch link. Leave existing notes, transcript and video fields in place when editing another field: **Save meeting details** saves these fields together. Look for **Meeting details saved.** Clear the video field and save to remove a recording.

Set **Video start time (optional)** to seconds, `MM:SS`, or `HH:MM:SS` to open
the recording at that meeting's beginning. It controls the player and the watch
link without changing the saved URL, so committee and full board meetings can
share one URL with different start times. Blank uses the URL's/default start;
`0` explicitly starts at the beginning. Clearing a recording also clears its
start time in the editor. Save meeting details to apply the change immediately.
4. Select **View meeting** to check the meeting page. The **Meeting record** section shows the notes to readers who can access that event.

If the meeting is missing from the list, open [Calendars](/admin/calendars/). Create a calendar for its organization if needed. In **Add an event**, choose the calendar, enter the meeting title and start time, check **This is a meeting**, choose its visibility, and select **Create event**. For an existing event, edit it and check **This is a meeting**. Then return to [Meetings](/admin/meetings/).

## Add other meeting records, if available

- **Attendance:** Select a person, choose **Present**, **Absent**, or **Excused**, add an optional note, and select **Add or update**. Add the person in [People](/admin/people/) first if needed.
- **Votes:** Add the subject, details, and outcome. After adding the vote, you can record each present attendee's **yes**, **no**, **abstain**, or **recused** choice when known.
- **Attachments:** Upload supporting PDF, Word, spreadsheet, presentation, text, or CSV files. Each file can be up to 25 MB.

Check names, dates, and vote outcomes against the source record before saving. You can return to a meeting later to revise its records.

### Add meeting files with an AI assistant

`create_event` and `update_event` also accept `meeting_video_url` for meetings.
Their optional `meeting_video_start_seconds` field accepts a nonnegative whole
number of seconds. Omit it to preserve the value, or use `null` to clear it.
Supply an HTTPS video URL, omit it to preserve the current value, or set it to
`null` to clear it. Back-to-back committee and board meetings can use the same
recording URL while retaining separate meeting records. Supported YouTube links
can include `t` or `start` to begin at that meeting's point in the recording.

Connected administrators can also use the compact MCP `import_meeting_source`
workflow after its main-first release: reference a checked existing TXT/JSON
minutes attachment, supply exact source-name/person bindings, and reconcile
existing immutable source keys before importing. Start with reconciliation and a
dry run. Counts distinguish accepted, unchanged and rejected observations;
a commit may accept valid rows while reporting conflicts. Never invent replacement
source keys, infer roll calls from totals, or treat an API result as a completed
public rebuild. This workflow does not automatically change existing imported
wording or publish private source files.

Recorded individual votes also appear in the member's profile **Meeting votes**.
The profile links each choice back to the motion and full roll call on its meeting.
Meeting attendance and roll-call names link to member profiles; recognized full
and shortened participant names in meeting text do too. Ambiguous shortened names
remain plain text. Public visitors see public meetings in profile voting records;
admins also see private and unlisted meetings. Recording or editing a choice
updates the voting record immediately without a site rebuild.

An administrator connected through [Civic Pulse MCP](/docs/ai/) can set
`is_meeting: true` on an event, save meeting notes or a transcript, and upload
meeting originals using resumable upload sessions. Use
`begin_meeting_attachment_upload`, then `manage_meeting_attachment_upload` with
`action=transfer_chunk` for bounded 256 KiB original-byte chunks, then
`finalize_meeting_attachment_upload`. Authentication is forwarded internally;
do not extract a connector token for direct Storage TUS. The limit is 25 MiB;
inline `upload_meeting_attachment` is limited to 3 MiB. Sessions retain source
identity and SHA-256 so an interrupted response can be reconciled using
`manage_meeting_attachment_upload`. JSON public-source projections are supported.
Files inherit meeting visibility; public archive publication is separate.

## Visibility and publication

Calendars and events can be **Public** (listed and searchable), **Unlisted** (available by direct link), or **Private** (admins only). A meeting's visibility also depends on its calendar. Check both settings before sharing the meeting link.

Admin changes are saved to the database immediately. The calendar and meeting viewer load records in the browser. Other public pages built from database content need a rebuild and deployment before edits appear there.

## Publish saved changes

Once automatic publishing is configured, saved changes that affect static pages are
queued automatically. Every 20 minutes, the publisher checks for pending changes and
rebuilds the site when needed. Edits saved during a build remain queued for the
next run, and failed builds leave changes pending. Completed builds are checked
on the next scheduled run; the public site updates as soon as deployment succeeds.
Scheduling and build time can
delay publication beyond 20 minutes. Use **Publish** below when you need an earlier
update. Runtime short links and election results continue to update immediately.

1. Save your edits, then open [Publish](/admin/publish/) from the admin navigation.
2. Select **Publish changes** to rebuild the public site with saved changes from all admins. Unsaved edits are not included.
3. Watch **Build status**: queued, preparing, building and deploying, then **Published successfully**. Status updates every 10 seconds while the page is open. You can leave and return later, or select **Refresh status**.
4. Open **View public site** after publication to check the result. If you saved more edits during the build, publish again after it finishes so those edits are included.

If another build is in progress, wait for it to finish. A failed, canceled, or skipped build does not confirm publication; use **View build logs in Cloudflare** to investigate. Migration validation and the usual build checks must pass before deployment. If a request times out, refresh status before trying again because Cloudflare may already have accepted it. If publishing is not configured, ask the site maintainer to complete the Edge Function setup.

Publishing rebuilds from the production code on `main`; it does not publish unmerged code. It also does not make private records public. Changing a previously public record to private still requires a successful rebuild to remove the old public page.

## Other admin areas

- [Publish](/admin/publish/): rebuild the public site and check deployment status.
- [Users](/admin/users/): find registered accounts and grant admin access when appropriate.
- [Organizations](/admin/organizations/) and [People](/admin/people/): maintain profiles and the people referenced by meeting attendance.
- [Offices](/admin/offices/) and [Elections](/admin/elections/): maintain offices, contests, candidates, and election information.
  Elections also accept an optional Georgia SOS results JSON URL. Leave it blank
  until SOS publishes the feed. Saving it does not import data or enable automatic
  refreshes; an administrator currently runs the manual feed importer.
- [Articles](/admin/articles/): add external articles and link them to people or organizations.
- [Layers](/admin/layers/) and [Maps](/admin/maps/): manage geographic data and published maps.
- [Calendars](/admin/calendars/) and [Meetings](/admin/meetings/): manage events and their meeting records.

## Connect an AI agent

Follow [AI plugins, MCP, and skills](/docs/ai/) for ChatGPT and Codex setup,
other MCP clients, OpenAI and Pi plugin repositories, and reusable civic workflows.
Each assistant connects through your own Civic Pulse account. Admin tools require
an admin account; review proposed changes before saving. Revoke access under
[Account → Connected apps](/account/).

## Document an open records request

Use [Records requests admin](/admin/requests/) to create a private draft. Set a
target organization, a requesting/source organization, or both. Your account is
the initial owner; the organization association does not grant account access.
The title is required. Record the scope, ORR/FOIA type, agency reference number,
submission date and next follow-up date as appropriate.

After saving, open **Manage this request**. Maintain the stage independently of
the outcome. Add dated timeline entries for responses, clarifications, delays,
record productions, denials and appeals. Stage/outcome changes automatically add
a status entry. They cannot be removed through the editor.

**Record a fee or payment** adds a USD estimate, bill or payment with its date
and note/invoice reference. Enter each separate charge once. When an estimate is
superseded, remove the previous estimate and add the revised amount. Each total
sums only its own category; this is a documentation ledger, not payment processing.

**Attach files and links** accepts images, PDF, Office/OpenDocument, text and CSV
files up to 25 MB each, plus HTTP(S) links to news coverage or other sources.
Files default to private. Choose “Share with everyone who can view the request”
only for a shareable/redacted copy. Existing uploads are immutable; remove and
upload a replacement to change file content or its access setting.

Public visibility lists the request; unlisted visibility allows direct-link
access; private visibility restricts it to the owner and admins. Details,
timeline, fees and links inherit request visibility. The owner ID and transfer
history never appear to public readers. Transfer to an existing account using
its user ID and a reason; history retains the previous/new owner and acting user.

These request pages load live records in the browser, so changes appear after
save without rebuilding request content. Deploy the frontend and database
migration before using the feature. No outgoing agency messages, automated
legal deadlines, payments, or notification delivery are performed.

## Audit log and record history

Choose **Audit log** in the admin tabs to browse the live change feed. Filter by
record type and optionally a record ID, or use **View history** on a public
profile or an admin list row. Expand a revision for its earlier and later values.
The admin view includes private, unlisted, and deleted records, editor display
names and account IDs, revision IDs, and transaction IDs. A shared transaction ID
helps identify related edits saved together, including cascade deletions.

Civic data changes are captured in Postgres, including site edits, MCP writes,
imports, relationship changes, meeting records, and stored geographic features.
History survives record and editor-account deletion. Display names are captured
at the time of the edit; unnamed accounts appear as **Editor**, and writes without
a user session appear as **System / import**. Account profiles, authentication,
and the admin allowlist are not civic objects and are outside this audit log.

History cannot be edited or cleared through the site/API, including by admins.
No prior edit history is fabricated: tracking starts when the migrations are
applied. No-op saves and automatic updated timestamps/search indexes are omitted.
To correct a record, use its normal editor; the correction creates a new revision.
Public history applies both historical and current visibility, so an admin may
see revisions that visitors cannot. No restore action is provided.

## Short links and QR codes

Open **Admin → Short links** (`/admin/links/`) to create a redirect. Enter a label
and destination URL, choose Active, and save. Bare domains use HTTPS. The saved
record has a permanent URL such as `https://www.civpulse.org/l/a1b2c3d4`.

Use **Edit & QR** to reopen a record, copy its short URL, view total redirects
and its last visit, or download its QR code as a 1024-pixel PNG or scalable SVG.
The record URL (`/admin/links/?id=<uuid>`) can be bookmarked. Both QR formats
contain the public short URL. Editing the destination takes effect immediately
and preserves the code, usage totals, and previously shared QR codes. A rebuild
is not required for link edits.

Pause a link to stop redirecting; visitors see a not-found response. Reactivate
the same record to restore the same URL and QR code. Codes are generated by the
system and cannot be renamed, deleted, or reused from this interface. Destinations
must use HTTP or HTTPS without embedded credentials; Civic Pulse `/l/` destinations
are rejected to prevent redirect loops.

Select **Refresh usage** to load the latest totals. Counts measure successful
GET resolution requests, including repeats, scanners, and bots; they are not
unique people or proof the destination finished loading. HEAD requests do not
increment the count. QR generation and downloads do not visit the short URL.
No visitor IP addresses, user agents, or cookies are stored in these statistics.

## Legislative records

Public bill, vote and session details, as well as bill/session directories, are
published snapshots. After legislation
imports or edits, use [Publish](/admin/publish/) to rebuild them. Signed-in
directory browsing continues to use live permissions, so your admin view can show
new or restricted records before the public snapshot. Private and unlisted rows
and rows with hidden parents are excluded from published directory and detail
files. Public details omit restricted children and count only public vote choices.
Signed-in detail readers use the live viewer; use **Open live record with access
checks** to inspect context-permitted data explicitly.

Use [Legislation admin](/admin/legislation/) and choose a record type. Existing
organizations represent legislatures, chambers and committees; existing people,
offices and service records identify members. Create records in this order:

1. Legislative term, then regular/special session and chamber/committee.
2. Dated body memberships linked to each member's office term.
3. Bill or resolution, with an official identifier and numbering context. Keep the
   same context across annual sessions when bills carry over; use a separate context
   when special sessions restart numbering.
4. Sponsorships, positions, official text versions, amendments and dated actions.
5. Vote with its exact question, category, method, outcome and coverage; link affected
   bills and optional versions/amendments, then enter individual member choices.
6. Media coverage links to existing articles and optional calendar-event links.

Use Edit to update a record and Cancel editing to clear the form. Record withdrawn
sponsorship with an end date. Preserve official sponsorship and voting terminology
in the source-role/source-choice fields. Never infer absence from a missing vote,
or support from a procedural vote. Mark incomplete member lists as partial. Voice
votes use “no individual record” coverage and cannot contain member choices.

Supply an official source URL when available. Provider record IDs must be paired
with a provider name. Uncertain service dates or missing body memberships require a
review note before saving a vote choice. Historical references cannot be reassigned;
delete/recreate dependent records explicitly when correcting context. Referenced
records cannot be deleted until their dependencies are reconciled. Audit history
preserves corrections.

Visibility applies to each record and its references: a hidden person, article or
bill association never becomes public merely because another parent is public.
Records appear live in the public viewers after saving; frontend code changes still
require deployment. MCP tools support the same records and an atomic, repeatable
normalized import keyed by source provider and ID. A provider-specific bulk import
must resolve identities and coverage before marking records complete.

Search **Saved records** within the selected record type, then choose **Edit**.
The editor opens with the selected record's name. **Cancel editing** discards the
unsaved form. To create a record, expand **Add or edit a record**; required fields
are marked with *. Optional provider IDs, source URLs and retrieval dates are
under **Source & import details**. Field guidance explains historical office
service, visibility, official totals and partial coverage. Save returns to the
record list and announces the result. Search and Clear affect only the list.

Legislative saved-record search also matches displayed relationship names, such as a member in vote choices. Reference pickers refresh after deletions and can retry failed requests.

For legislative terms, set **jurisdiction** to federal or state; state terms also
require **state name** (use a consistent full name, such as Georgia). Leave state
name blank for federal or unspecified terms. Unclassified terms remain browsable
under all jurisdictions and **Not yet classified** until their metadata is set.
Adding jurisdiction metadata does not import any bills automatically.

### Import legislative records

In **Admin → Legislation**, expand **Import legislative records** and choose a
normalized JSON file (up to 20 MB / 20,000 records). The preview shows record
counts and batches before saving. Files contain an array of `{ "table": "…",
"data": { … } }` records, with `source_system` and `source_id` in every data
object. Order parents before children and use stable UUIDs for references within
the file. Describe resource fields through MCP before preparing a file.

Choose **Import records** to save batches of at most 100 records. Every batch is
atomic; completed batches remain saved if a later batch fails. **Resume import**
retries the stopped batch. After reloading the page, choose the same file again;
provider IDs make repeated imports update existing records.
An existing vote category of **attendance** is preserved on reimport even if a
stale file supplies another category; other supplied metadata still updates.
Use an explicit record edit to correct an attendance classification after source
review. Honor the Georgia source adapter's `attendance` indicator even when the
original caption or `isRollCall` flag disagrees. Review the saved
records and public profile afterward. A single-member backfill has partial roll
call coverage even when the official chamber totals are available.

### Publishing map changes

Public map layers and stored geometry, including homepage previews, are published
as static snapshots. After editing map settings, importing/replacing features,
changing default layers or visibility, use **Admin → Publish** and wait for a
successful build. Public visitors see the last successful publication until then.
A failed map export stops publication and leaves the previous deployment in place.
Signed-in map views and UUID links continue to check access to private/unlisted
content against the backend. Private and unlisted layers are never exported.
After making formerly public data restricted, publish promptly; cached public
files can remain in browsers for five minutes, and downloaded copies cannot be
recalled. Public external GeoJSON sources are also captured during publication;
changes at their hosts appear in public slug pages only after the next successful
build. A failed or invalid external source stops publication. Gated live UUID
viewers retain their existing source/access behavior.

Public map pages now include readable layer summaries and feature listings, with
static continuation pages for larger layers. Maintain the layer description,
presentation attribution/source URL/note, title property and popup fields: these
also supply the readable information. Do not put confidential facts in a public
feature or configure geometry/internal fields as popup details. Source-check dates
use the feature's recorded `sourceChecked` date; boundary versions remain source
facts, not a current-office or update-date claim. Representative names do not
automatically create links to people with matching names. Supply verified source
links in the existing feature/popup fields instead. Do not invent dates or
affiliations to fill gaps. Publishing visibility changes must remove the old
HTML continuation pages as well as geometry assets in the new static deployment.

### Publishing profile sections

Public profile offices, candidacies, news/article links, meeting votes and
legislative records now use published snapshots. After edits or imports, use
**Admin → Publish** and wait for a successful build. Public visitors see the last
successful snapshot; signed-in and UUID profile views continue to use live access
checks. Private/unlisted profiles and their restricted related records are never
exported. If formerly public data becomes restricted, publish promptly; browser
caches can retain published files for five minutes and existing downloads cannot
be recalled. Office/candidacy date groups update in the visitor's browser without
a daily publication.

The public people, organization and election directories now publish with the
site, including search data and filters. Choose **Publish** after imports,
record edits or visibility changes. Signed-in searches still use live access
checks; seeing an edit there does not mean the public directory is published.
When hiding a record, publish promptly and allow up to five minutes for old
cached assets to expire. Previously downloaded public copies cannot be recalled.

### Sourced meeting ballots

AI tools can validate and import attendance, individual motion rounds and named
choices with `import_meeting_records`. Resolve existing meeting/person UUIDs,
validate first, and import attendance before rounds and choices. Stable source
keys make exact replay safe; changed snapshots reject the entire batch for review.
No omitted records or editorial notes are deleted. Preserve original wording,
source URL/checksum and exact item/round locator. “Vote Not Recorded” remains
unknown. “Observed” attendance means presence at a recorded ballot only; it does
not claim attendance for the whole meeting. A roster does not establish attendance.
Unknown outcomes remain unrecorded; never infer individual ballots from unanimity.
Read back `get_meeting` and `get_person_meeting_votes`. UUID and signed-in profile
views use live data; anonymous public slug profiles require a rebuild. Verify the
actual public profile after publishing before reporting site visibility.

Choose **Publish** after calendar/event imports, meeting record edits, or visibility
changes to refresh public calendar months, event pages, meeting details, homepage
upcoming events and the subscription feed together. Signed-in views remain live;
seeing an edit there does not mean it is published. Hidden events/calendars and
hidden meeting participants are excluded from public snapshots. Restricting
visibility requires prompt publication; allow up to five minutes for cached data
to expire. Attachment download permissions remain checked at click time.

### Backfilling district-based legislative service

Keep historical offices attached to their recorded district organizations.
Before importing sponsorships or chamber memberships, use the organization
relationship tools to link each district to its verified chamber with the exact
relationship **Legislative district of**, reverse label **Contains legislative
district**, and an official roster source URL. The chamber must belong to the
bill or membership's legislature. This requires the district-service validation
migration to have reached production through main. Do not substitute a different
office term or change an office's organization to bypass validation.

When committee sources identify only a session and role, retain that session
label in a sourced profile summary; do not invent appointment dates for dated
membership records. Mark incomplete roll calls and archival coverage as partial,
and preserve held source conflicts for review. Public profile descriptions and
legislative sections require a rebuild/deploy;
signed-in and UUID viewers continue to read live records.

For larger normalized backfills, `import_legislation` with `mode=batched` accepts up to 1,000
records (2 MB) and sends ordered 100-record batches through the existing import
RPC using the caller's admin session. Each batch commits separately. Inspect
`status` and `next_offset`; after a partial result, retry the same bundle from that
offset. Later batches are not attempted after an error. Provider IDs make retries
idempotent, including uncertain network responses. Use `import_legislation` when
the entire request must be atomic. Neither mode needs ad hoc SQL or a service key.

## Election results and turnout

Use the Civic Pulse **Election results and turnout** skill with an authenticated
admin AI agent. Attach original tape photographs or printed summaries, including
headers, and specify the election and reporting area. The agent uploads private
originals, transcribes them, resolves candidate/contest records, checks duplicates
and validates a complete report before saving. Readable evidence and your existing
instruction to update totals authorize a save; missing dates, IDs or uncertain
digits require clarification.

Different photographs of the same report count once. New cumulative summaries
replace earlier snapshots while retaining history. Never add county summaries to
machine tapes, or sum successive summaries. Keep ballots, voters, candidate votes,
unresolved write-ins and registration denominators separate. A printed zero is
not the same as an unreadable value. Standard tape certification text does not
make the county results certified. November 3, 2026 accepts turnout before election
day, but no candidate votes. May 19 is a separate historical election.

Inspect saved reports at [Election results and turnout](/elections/results/),
including earlier reports. Saved results appear there immediately; other election
and candidate edits still require Publish. Conflicting OCR at the same printed
time is rejected for reconciliation, not silently overwritten.

## Format a person’s profile description

Person descriptions support Markdown links (`[Board name](/orgs/board-slug/)`),
paragraphs separated by blank lines, emphasis and lists. These render on public
person profiles and UUID profile viewers. Raw HTML displays as text, and unsafe
link protocols are blocked. Save the description, then publish the site to update
the public profile. Other description fields retain their existing formatting.

Publications share public legislative reads across profiles and the archive and
fetch counted pages with bounded parallelism. The Publish workflow is unchanged.
A changing total or failed/incomplete export stops publication and leaves the
previous deployment serving. Publish again after imports/edits settle; no private
or unlisted records should be made public to get a build through.

### Georgia SOS structured turnout

The AI tool `manage_election_results` accepts `import_turnout` JSON evidence and
`read_turnout` readback alongside the existing photo/PDF operations. Validate
first with `dry_run:true`, then save with the current predecessor report ID.
Each JSON import is atomic (up to 636 source rows / 2 MiB), checksum verified and
unofficial turnout-only. Preserve all absentee measures, county FIPS, original
ballot styles, display text, nulls and source as-of labels. Collection time cannot
replace an absent source timestamp. Do not upload raw authentication/session
material. Exact replay is a no-op; successive corrections replace rather than add.
See the repository's `docs/election-results.md` for offline export preparation and
the JSON contract. Deployment of the feature is required first; saved reports
then appear live on the results page without a rebuild.

If the connector rejects `read_turnout` or `import_turnout` as an unknown action,
follow the [tool refresh instructions](/docs/ai/#if-setup-does-not-work), then
verify a read succeeds before retrying the import. Updating bundled skills alone
does not refresh the connected app's schema.

### Publishing records requests

Public request directories and detail pages are snapshots. After imports, edits
or visibility changes, [Publish](/admin/publish/) to refresh them. Signed-in
requests, ownership/transfer history, management controls and private files remain
live behind their existing permissions. Public files recheck current access when
downloaded; private file names, storage paths and signed URLs are excluded from
published files. Refresh publication when changing public file metadata as well.

## County demographic statistics

Open [County statistics](/admin/statistics/), choose a county/state and measure,
then **Load statistic**. Edit the numeric value together with its availability,
reference period, official dataset, variables/calculation, source components and
uncertainty. Available observations require a numeric value; unavailable or
suppressed observations require a blank value. Preserve zeros that are actual
measurements. **Save statistic** checks the loaded timestamp; reload if another
editor changed the record. Database/search/API edits are immediate; rebuild to
publish updated pages and CSV/JSON snapshots. All 59 records and six headline
slots must remain present for every county and Georgia before the build succeeds.

Connected administrators on the compact MCP catalog can use
`save_county_statistic` and `save_county_statistic_source`; resolve the
catalog and read current `updated_at` first. Dataset source metadata requires
the exact official file SHA-256 and retrieval date. Do not mix source vintages,
copy another county’s values, remove uncertainty, or replace missing data with zero.

## School finance imports and employee review

School payroll/payment imports use the authenticated `school_finances`
MCP tool: begin an evidence manifest, append bounded batches, then explicitly
publish a complete reconciled release. Partial imports stay private. Replacement
requires the exact current release ID and retains history. See the repository's
`docs/school-finances.md` for the versioned contract and offline Bun preparer.
The updater's collector and authenticated publisher are separate follow-up work.

During staging, link supported payroll identities to existing people with
`resolve_payroll_person` and a sourced review note. Publishing creates separate
flagged stubs only for unresolved rows, including ambiguous repeated names.
Check additional source evidence before confirming an identity.
Use `review_person` with the release ID, row ordinal, current person UUID,
`confirm_identity:true` and a sourced review note to clear the flag. This does not
merge profiles. Standard person editing remains available under People.

Finance search reflects publication immediately; employee/organization profiles
appear after the normal rebuild. Withdrawing a release hides its generated
profiles and removes source affiliations only when other published releases do
not still reference them. Curated profiles remain intact; static changes
require that rebuild too. Source files must remain in the collector's evidence
archive. Do not upload full statewide payroll or treat payment recipients as
people without verification. Production migrations must reach main before use.

### Reviewing payment recipients

Payment publication links recipients to one exact existing organization/person
match, or creates a provisional organization stub for missing/ambiguous matches.
Mappings are shared across years. Use the school finance `resolve_recipient`
action with recipient_id, kind, a sourced review_note and an existing target_id
to confirm/correct an identity. Omit target_id to create a new person/organization
stub that still needs review. Reclassification preserves all payment source facts
and does not delete the previous stub. Do not treat a provisional organization
classification as a verified legal identity. Payroll aggregates have no payee link.

Payroll imports can link a source row to an existing person before publication
when source evidence supports the identity. Only uncertain rows need separate
person stubs flagged for review. Preserve the original payroll name and use a
sourced review note for spelling, initials or name-order differences; a similar
name alone is insufficient. See [the finance import contract](https://github.com/kerryhatcher/www.civpulse.org/blob/main/docs/school-finances.md).

## Person-to-person relationships

Maintain these links through the authenticated MCP/plugin tools. Use
`save_relationship` with `request.relationship=person_relationship` and
`change.operation=create`, `person_id`, `related_person_id`,
`relationship`, `reverse_relationship`, and optional `source_url`.
The first label describes the other person on the first profile (for example,
“Child of”); the reverse label describes the first person on the other profile
(“Parent of”). Use the returned row `id` for partial updates and
`delete_relationship`; deletion removes the link from both profiles but keeps
both people. Read back `read_related_records` with
`request.relation=person_relationships` and `person_id` from both endpoints.
Only admins can write. Reverse duplicate pairs and self-links are rejected.
There is no separate web relationship editor in this release.

Use precise free-text labels, not an inferred spouse/family/associate category.
The database permits a missing source for incomplete records; editorially,
add a reliable, public source supporting the exact claim before publishing a
family or sensitive association. Do not infer from surnames, addresses, photos,
co-attendance or shared organizations. Consider civic relevance and privacy,
especially for relatives who are not public figures; do not create profiles of
private relatives merely to complete a family tree. An unlisted endpoint is not
a public source or consent. Use existing visibility controls and avoid recording
sensitive personal details. No real-person family links are backfilled.

Recheck identity and both directional labels, preserve the source and uncertainty,
and follow the [editorial correction workflow](#editorial-correction-workflow).
Public/public links publish after rebuild; hidden endpoints remain excluded from
anonymous HTML and relationship reads. A visibility change also requires prompt
republication of previously public static copies.

Person relationship tools are available in the compact catalog at
`https://api.civpulse.org/functions/v1/mcp/v2` after the matching MCP deployment.
The compatibility catalog remains at its existing 128-tool limit; refresh tool
discovery and use only selectors advertised by the connected endpoint.

## Cited corrections to imported vote outcomes

Do not edit an imported motion's original outcome or replay it under a new key.
Use the compact MCP `set_meeting_vote_outcome` tool with the existing vote UUID,
passed/failed/tabled/withdrawn, original HTTPS document URL, SHA-256 of its exact
bytes, and a precise page/item/round locator. Verify the motion text and whether
the body is a committee or the full commission; numeric passFail codes and totals
are not enough. The tool trusts the admin's citation review and does not download
or certify the source itself.

Read back the meeting and check created/unchanged/conflict. Exact citation replay
is unchanged. To correct, name the current observation's UUID in
`supersedes_id` and explain the change in a public `correction_reason`.
A stale or omitted expected ID conflicts; original observations and ballots stay
intact. Cited records cannot be deleted through the vote editor. Public pages
show the effective result, original recorded outcome and source evidence; private
records retain their existing gates. Rebuild and recheck meeting/person pages and
published JSON before closing a correction report. No real outcome backfill is
included; review and publish source-supported batches after the release.

## Original documents through a connected agent

Use `begin_meeting_attachment_upload`, then the same session's
`manage_meeting_attachment_upload` with `action=transfer_chunk`, `id`, byte
`offset` and `data_base64` for at most **256 KiB of original bytes**. Keep the
original byte count/hash and exact bytes; do not send an entire large PDF in one
call. No general bearer/service key is needed in tool arguments. The server uses
the connected caller's authentication internally; do not copy browser/connector
tokens or manually supply a TUS Location.

After an interrupted response, use `transfer_status`. Retry an exact pending
chunk at its original offset; the server skips its accepted prefix. A different
chunk at that offset conflicts. A transfer is bound to its initiating admin.
Wait out a busy two-minute lease before retrying. `creation_uncertain` means a
Storage creation receipt is missing: retain the session for operator reconciliation,
not a new source-key workaround. `authentication_required` means a confirmed
pre-creation JWT-expiry rejection was safely reset: refresh the connection and
retry the same session/chunk. Failed resets still require reconciliation.
Cancellation removes completed staged objects but does not terminate private
partial TUS resources or revoke capabilities; repeat explicit cleanup after expiry
if an in-flight write finishes. Finalize with the existing session ID and verify
the downloaded original's SHA-256. Existing meeting visibility and separate public
archive publication remain unchanged. This release still needs the hosted connector
acceptance check described in issue #60; local success alone does not close it.

### Historical roster observations

Use the compact MCP `accept_officeholder_observations` version-1 contract after
main-first release; this release has no separate web roster editor or collector.
Resolve the historical organization and exact existing office/person IDs; preserve
reported spelling, role, district/seat and source labels independently. Leave an
ambiguous name unlinked and unresolved rather than guessing or duplicating a
curated person. Record original/indexed-copy/unverified evidence status honestly,
including original-source availability, SHA-256, retrieval date and exact page/row.
Identity review does not mean the original was independently verified. A June 30
roster establishes no January 1 start, December 31 end, election, appointment or
current-office status. Use year/unknown precision when appropriate. Link existing
corroborating terms without changing them; flag contradictions, acting/interim
roles and predecessor organizations explicitly. Dry-run first; conflicts/errors
roll back the whole batch. Corrections require the latest observation ID and a
public reason; immutable history is retained. Publish and check both person and
organization views after acceptance or visibility changes. The FY2022 ACFR cited
in issue #147 is not imported or newly verified by this feature.

### Accepting sourced fee reports

After main-first release, use compact MCP `accept_user_fee_report` version 1; this
feature has no collector or separate browser editor. Resolve the exact existing
charging organization UUID and preserve its raw source label/review status. Never
infer a body from a similar name or create duplicate curated organizations. Retain
source URL, actual retrieval timestamp, checksum, publication date when known,
page/table/row locators and coverage. Preserve scalar/range/tier/text fee structures,
source units, authority citations, effective-date uncertainty and collections as
separate exact decimal strings/null. An authority citation is not a claim of current
effectiveness. Dry-run the complete bounded report, then explicitly accept; errors
roll back the whole batch. Exact replay is unchanged; amendments need the current
report ID and public correction reason. Read back public/admin views and history,
check units and missing collections, and publish static context/visibility changes
through the existing workflow. No real fee records are backfilled by this release.

### Accepting obligation reports

Use compact MCP `accept_obligation_report` version 1 after main-first release;
there is no collector or separate browser editor. Resolve existing payer and
person/organization vendor IDs from evidence, preserving raw labels and repeated
source observations. Unresolved identities stay private/unlinked, never guessed
or automatically stubbed. Retain exact signed decimal strings, source measure/
currency/unit/period/grain, original URL/hash/retrieval/publication/locators and
coverage. Default to not additive; assert disjoint rows only when the source proves
no overlapping subtotal/cumulative observations. Dry-run complete bounded reports;
errors roll back all rows. Corrections/cancellations require latest report ID and a
public reason, preserving originals rather than zeroing amounts. Only source IDs
with supporting citations link payments; no vendor-total matching or inferred
balance. Recheck public/admin/detail/history/download views, especially private
people (raw names and amounts must be absent publicly), then publish static context
or visibility changes. No production obligations are backfilled by this release.

---
layout: ../../layouts/DocsLayout.astro
title: Admin guide
description: Add board meeting notes and maintain the records people use across Civic Pulse.
---

Admin tools require an account with admin access. [Sign in to the Meetings admin page](/signin/?next=/admin/meetings/), or use **Admin** in the site header after signing in.

## Add notes from a board meeting

1. Open [Meetings](/admin/meetings/) and choose the board meeting from the **Meeting** list. The newest meetings appear first.
2. Enter your notes in **Meeting notes or minutes**. Include the meeting date, the main topics, decisions, and any next steps you can verify. Notes are plain text; use line breaks to keep them readable.
3. Select **Save text** and look for **Text saved.** The **Transcript** field is separate. Leave any existing transcript in place when editing notes because **Save text** updates both fields.
4. Select **View meeting** to check the meeting page. The **Meeting record** section shows the notes to readers who can access that event.

If the meeting is missing from the list, open [Calendars](/admin/calendars/). Create a calendar for its organization if needed. In **Add an event**, choose the calendar, enter the meeting title and start time, check **This is a meeting**, choose its visibility, and select **Create event**. For an existing event, edit it and check **This is a meeting**. Then return to [Meetings](/admin/meetings/).

## Add other meeting records, if available

- **Attendance:** Select a person, choose **Present**, **Absent**, or **Excused**, add an optional note, and select **Add or update**. Add the person in [People](/admin/people/) first if needed.
- **Votes:** Add the subject, details, and outcome. After adding the vote, you can record each present attendee's **yes**, **no**, **abstain**, or **recused** choice when known.
- **Attachments:** Upload supporting PDF, Word, spreadsheet, presentation, text, or CSV files. Each file can be up to 25 MB.

Check names, dates, and vote outcomes against the source record before saving. You can return to a meeting later to revise its records.

## Visibility and publication

Calendars and events can be **Public** (listed and searchable), **Unlisted** (available by direct link), or **Private** (admins only). A meeting's visibility also depends on its calendar. Check both settings before sharing the meeting link.

Admin changes are saved to the database immediately. The calendar and meeting viewer load records in the browser. Other public pages built from database content need a rebuild and deployment before edits appear there.

## Publish saved changes

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

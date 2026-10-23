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

## Other admin areas

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

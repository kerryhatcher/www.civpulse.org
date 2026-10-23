---
layout: ../../layouts/DocsLayout.astro
title: Using Civic Pulse
description: Find a meeting, explore a map, check an election, and understand what you can see.
---

You can browse public information without signing in. Start with the [community calendar](/calendar/) for events or [Search](/search/) when you know a name or topic.

## Find a meeting and read its notes

1. Open the [community calendar](/calendar/). Use the month arrows to find a date. Select a day to show its events, or switch to **Agenda** for a list of upcoming events.
2. Use **Organization**, **Calendar**, **Category**, or **Search events** to narrow the list. Meetings are labeled **Meeting**.
3. Select the event title to open its page. If records have been added, the **Meeting record** section shows notes or minutes, a transcript, attendance, votes, and downloadable files.

If you do not see meeting notes, they may not have been added yet. For an older meeting, go to its month and select its day; the default event list starts from today.

## Keep up with the calendar

Calendar times are shown in the America/New_York time zone. **Subscribe to calendar** adds an updating feed of public events to your calendar app. If that button does not open your app, expand **Use a subscription URL** and copy the address. **Download calendar** imports a one-time copy instead. Updates to a subscription depend on your calendar app's refresh schedule.

## Search and explore

- [Search Civic Pulse](/search/) by name or topic, or choose a **Content type** to browse without entering a search term. Results can include people, organizations, elections, articles, maps, and events.
- [Explore maps](/maps/) by choosing a map, then opening **Map settings** to turn layers on or off. Use **Search places, precincts or addresses** in **Places on your map**; select a place there or on the map to see its details. **Copy map link** shares the current layer selection.
- Browse [people](/people/) and [organizations](/orgs/) to find profiles and related information. Each directory has its own name search.
- Open [elections](/elections/) for available contests, candidates, and dates or deadlines. Select a date to open its calendar event.

If a search shows nothing, try a shorter term, another content type, or fewer calendar or map filters. Some records have not been added yet.

## Accounts and access

You do not need an account to browse public information. To create one, [create an account](/signup/) with your email and a password of at least eight characters. Complete the security check and confirm your email if prompted. After signing in, [Your account](/account/) shows your account details and lets you sign out. A regular account currently gives you the same content access as a public visitor.

**Unlisted** records can be opened with a direct link but do not appear in public listings or search. **Private** records require admin access. If a link says an admin account is required, signing in with a regular account will not open it.

Information may change. Confirm important meeting, voting, or service details with the organization that published them.

## Connect an AI agent

Use `https://api.civpulse.org/functions/v1/mcp` as the remote MCP server URL,
or install the Civic Pulse plugin and connect **Civic Pulse MCP (Supabase)**.
Sign in with your Civic Pulse account and review the consent screen.
The agent has your account’s supported access; administrator accounts can edit
content and manage users. Revoke access under [Account → Connected apps](/account/).
If your client still uses `mcp.civpulse.org`, update its URL and reconnect.

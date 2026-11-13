# Imported calendar refresh — October 25, 2026

Reviewed all 23 existing calendars and inventoried 977 saved events before edits.
Live content changes were made through the authenticated Civic Pulse MCP plugin.
The [audit JSON](./calendar-refresh-2026-10-25.json) records every affected UUID,
source URL, new occurrence, and before/after field change.

## Changes

- Added 86 events: 72 local Mobilize occurrences, seven Macon-Bibb pension-board
  meetings, five Water Authority/Macon Soils meetings, and two absentee-ballot
  deadlines linked to the existing November general election.
- Moved 37 upcoming library teen programs from Adults to the existing
  Teens/ Young Adults calendar, matching CalendarWiz's category. The separate
  event `category` metadata is not writable through the current MCP tool and
  was preserved; calendar membership is corrected.
- Updated the November 5 Bloomfield Library gardening class title and summary.
- Corrected the October 26 Macon-Bibb Events Subcommittee meeting to 7–8 p.m.
  Eastern, as shown by Mobilize.
- Updated six election-date records with official sources, complete all-day
  boundaries, and conditional runoff wording. Early-voting spans include their
  final day and describe date windows rather than continuous opening hours.
- Unlisted the past October 18 Shurling Library 3D Printing Class after its
  source detail page explicitly reported that it may have moved or been deleted.
  The record and provenance remain available; cancellation is not asserted.

Total: 86 additions and 46 updated records. No records were permanently deleted.

## Sources and reconciliation

- [MGRLS CalendarWiz](https://www.calendarwiz.com/calendars/calendar.php?crd=mgrl):
  inspected October–December month listings and individual detail pages. All
  344 upcoming source listings found were already represented. One saved past
  listing was absent and explicitly unavailable at its detail URL. Source
  all-day 23:59 ends remain normalized to exclusive next-midnight ends.
- [BCSD district calendar](https://www.bcsdk12.net/calendar) and its published
  ICS feed: existing recurring board meetings and district dates retained.
  The [2026–27 academic PDF](https://www.bcsdk12.net/fs/resource-manager/view/fe04e0c9-956a-4997-b5a3-a05e070ccc58)
  still identifies the March 19, 2026 revision and matches the imported dates.
  Newly published 2027–28 and 2028–29 academic calendars are outside this refresh
  of the existing 2026–27 calendar and were not imported.
- [Middle Georgia DSA calendar](https://www.mgdsa.org/events/calendar): checked
  publicly available embedded Google ICS feeds. No verified changes to the
  imported public events were found. Two embedded feed URLs returned 404;
  unavailable feeds are not evidence of cancellation, so their records were
  retained. Private/busy entries were not imported.
- [Mobilize nearby feed](https://www.mobilize.us/democraticpartyofgeorgia26/?lat=32.8407&lon=-83.6324):
  compared existing listings and added new Macon/Houston County listings and
  every published upcoming shift from their embedded event data. JSON-LD shows
  only the first ten shifts for some listings, so it was not used as the full
  inventory. When the source marks a location private, only the city and signup
  instructions were saved, even if JSON-LD exposed a street address. The three
  distinct Warner Robins outreach signup listings retain their own titles and
  source links. More distant geographic areas were not added.
- [Macon-Bibb CivicClerk](https://maconbibbcoga.portal.civicclerk.com/): paginated
  the official 2026 meeting API, compared all existing imported source IDs and
  titles, and added seven upcoming pension meetings. Existing commission starts
  match the source's Eastern wall-clock times. Three source entries for the
  December 1 pre-commission meeting represent the same occurrence; the existing
  event was retained without duplicate additions.
- [Water Authority public calendar](https://macon-water.community.diligentoneplatform.com/Portal/MeetingSchedule.aspx):
  added the November 5 Engineering, Finance, Pension and full-board meetings and
  December 3 Macon Soils board meeting. Public detail pages identify agendas as
  under revision. The November board packet is linked from the board event,
  rather than imported as a second meeting. Unknown end times were omitted.
- [Georgia Secretary of State summary](https://sos.ga.gov/sites/default/files/forms/2026%20Short%20Calendar%20.pdf),
  [Georgia.gov election information](https://georgia.gov/georgia-general-election-2026),
  and [runoff advance-voting guidance](https://georgia.gov/events/2026-11-23/general-election-runoff-early-voting):
  verified election dates, federal registration deadline, advance-voting windows,
  and absentee deadlines. Runoff advance voting may begin earlier according to
  the county; the state specifies no later than November 23, through November 25.

## Verification and publishing

Read back all 132 affected records as the connected admin. All created fields
match their saved payloads, and all 37 teen events belong to the correct calendar.
Anonymous search excludes the unlisted library event. The anonymous live event
viewer shows the corrected October 26 7–8 p.m. time.

`bun run check` passed with no errors, warnings or hints. `bun run build` passed.
These local checks do not constitute deployment. The hosted web rebuild was
requested using the already deployed commit
`4e595a3c1784050f3587daf3adfad3656697e34c`, preserving unrelated local work.
Cloudflare build ID: `fcfdefdd-4406-4941-9813-cf8ea8242364`; completed successfully.
The published `/events.ics` was fetched after deployment and contains all 86
new UUIDs, omits the unlisted event, and has 1,062 public occurrences. Verified
the corrected October 26 23:00Z–00:00Z meeting and exclusive all-day ends of
October 31 and November 26 for the respective advance-voting spans. The live
anonymous viewer also displays the new Water Authority board meeting at 4 p.m.
Eastern on November 5, with no browser console errors.

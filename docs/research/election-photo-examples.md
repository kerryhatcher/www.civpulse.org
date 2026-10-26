# Election photo extraction audit

Provided October 26, 2026. These are visual transcriptions for development,
not production imports. Original images remain in the chat attachments; they are
not committed or publicly published. No missing header or unreadable field was
invented. All printed summaries describe unofficial/incomplete results.

| Photo | Identified report | Ballots / voters | Choice-table total | Import decision |
| --- | --- | --- | --- | --- |
| 1 | Senate 18 tape, header cropped | Not visible | 685 | Hold: election date, tabulator and printed time missing |
| 2 | Senate 18 tape, header cropped | 317 / 317 | 317 | Hold for identifying header |
| 3 | Senate 18 tape, header cropped | 317 / 317 | 317 | Hold; different candidate counts from photo 2 |
| 4 | Bibb February 17, 7:34:22 PM | 1,685 / 1,685 | 1,682 | First county snapshot |
| 5 | February 17, three advance-voting tapes | 671 + 194 + 697 | 670 + 193 + 696 | Three tabulator scopes, already included in county advance totals |
| 6 | Bibb February 17, 8:23:21 PM | 2,133 / 2,133 | 2,130 | Supersedes photo 4, not an increment |
| 7 | Bibb February 17, 9:28:41 PM | 7,052 / 7,052 | 7,049 | Supersedes photo 6, not an increment |
| 8 | Bibb April 14, 7:27:28 PM | 300 / 300 | 300 | One report |
| 9 | Same printed April report and timestamp as photo 8 | 300 / 300 | 300 | Semantic duplicate despite different photograph |
| 10 | Bibb March 17, 8:41:32 PM | 899 / 899 | 897 | Separate election; two unresolved write-ins shown separately |

Photos 1–3 candidate order: Eugene Allison, LeMario Nicholas Brown, Lauren Daniel,
Steven McNeel, Nathan Warnock, Eric S. Wilson, Write-in. Their vectors are
`[2,356,55,164,9,99,0]`, `[3,136,32,99,6,41,0]`, and
`[3,155,20,80,7,52,0]`. All reconcile to their printed totals. Equal total voters
alone cannot identify duplicates.

Photo 5 left/center/right tabulator IDs are **251 / 136 / 250**, at Elections
Office. Printed times February 17 are **19:05:50 / 19:04:46 / 19:06:12 EST**.
Brown/McNeel votes are **352/318**, **97/96**, and **350/346**. These total
799/760, matching advance votes in the county summaries. Tape boilerplate headed
“Certification” is not evidence of county certification.

February county summaries: registered voters **108,508**, precincts **10/31**.
Senate 18: registered voters **37,714**, precincts **10/10**. These denominators
are different scopes, not OCR mistakes. Brown/McNeel progress **884/798 →
1,067/1,063 → 2,810/4,239**. Advance ballots remain 1,562 and mail ballots 123;
Election Day ballots progress 0 → 448 → 5,367. Candidate votes exclude three
ballots without a printed supported choice; do not label those undervotes without
additional source evidence.

April: county registration **17,944**, contest registration **10,298**;
county precincts **6/31**, contest precincts **6/6**. All 300 ballots are advance;
Andrea C. Cooke **203**, Edward C. Foster **97**.

March: county registration **19,210**, contest registration **11,558**;
county precincts **6/31**, contest precincts **6/6**, while the heading says
“Polling places: 4 of 6.” Preserve that additional statement in a report note;
do not convert the heading into a replacement precinct count. Candidate totals:
Cooke 458, Foster 167, A. Chester Gibbs 44, Ulisha Hill 8, Landon A. Justice 81,
Stephanie Stephens-Lanham 139. Their sum is 897. Separately printed unresolved
write-ins are 2; ballots are 899. Retain all three values.

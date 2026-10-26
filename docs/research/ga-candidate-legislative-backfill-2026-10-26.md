# Georgia legislative history for November 3 candidates

Research date: October 26, 2026. Election: `295d864d-80c8-4a87-ab16-3f4f3fa5ddb7`.

The recorded election contains 51 candidates. Seventeen have reconciled current or former Georgia legislative service. This backfill uses official General Assembly member IDs, session rosters, floor votes and bill details, plus identified Georgia Senate archival sources. It does not establish complete lifetime coverage.

## Coverage

The companion JSON records per-person prepared choice and sponsorship counts, source failures, held records and import-file SHA-256 values. Josh McLaurin's earlier import is retained and expanded with sponsorships. Sanford Bishop's pre-API service has one explicitly sourced archival floor vote and a sourced committee summary. Floyd Griffin's 1995 sponsorship is linked as an archival article; his modern House history is structured separately.

Committee summaries preserve session labels and roles. They do not invent appointment or departure dates. Six older district offices/terms for Austin Scott and David Lucas retain the precision supported by the source. Lucas's documented House departure is July 1, 2011. Twenty-seven sourced district-to-chamber relationships permit the existing service validator to reconcile legislative records.

## Limits and interpretation

- Seventy-five official vote-detail endpoints failed with HTTP 500 after retries; their missing choices remain unknown.
- Five early House session lists returned no vote rows. Earlier service, including Bishop's, Lucas's, Scott's and Griffin's pre-API years, remains partial archival coverage.
- Fourteen candidate vote choices were held for conflicting duplicate source entries or service-date mismatches. Thirty-three bill candidates were held for missing introduction dates or unreconciled sponsor service.
- Three duplicate official sponsorship pairs were collapsed into canonical sponsorships, preserving both source IDs and sequences in provenance. The 6,833 source entries represent 6,830 distinct person/bill/role/date sponsorships.
- Nine membership intervals lack sufficiently precise boundaries. Existing office service is retained; exact membership dates are not invented.
- Official vote 21003 is attendance despite its caption and flag. Its raw history remains retained, while legislative displays exclude it. Prepared counts include four newly imported choices and one prior Josh choice for this attendance vote.
- Partial roll calls contain only the candidates researched here. Missing names are not inferred absences. Procedural choices are not endorsements; reported tallies do not establish outcomes.
- Sponsorship dates use the documented originating-chamber introduction/first-reading date, with this policy retained in source-role provenance. No dated bill versions or amendments were invented from undated source lists.

## Supported import path

[PR #41](https://github.com/kerryhatcher/www.civpulse.org/pull/41) added sourced district/chamber validation, faster batch validation, attendance protection and a resumable MCP bundle importer. Its migrations reached main before production application. Content imports use the authenticated legislative import API, stable provider IDs and parent-first batches; no ad hoc SQL is used for the backfill.

The deployed bundle tool was not yet exposed by this chat's refreshed connection. The existing atomic 100-record import tool remains supported and was used for this run. Independent table batches run concurrently only after their referenced parents are present.

## Primary sources

- [Georgia General Assembly](https://www.legis.ga.gov/): member profiles and session-specific committee assignments; public session rosters, vote detail and bill detail APIs.
- [1991 Senate journal, volume 1](https://dlg.usg.edu/record/dlg_ggpd_y-ga-bl402-b1991-bv-p1): Bishop's committee appointments, pages 89–95.
- [1991 special-session Senate journal](https://dlg.usg.edu/record/dlg_ggpd_y-ga-bl402-b1991-bspec-p): Bishop's August 22 SB 6 EX affirmative vote, journal page 2634; passage is explicitly reported.
- [January 27, 1995 Senate weekly wrap-up](https://dlg.usg.edu/record/dlg_ggpd_i-ga-bl411-b-pp1-bn4-b1995-s2-bfolio): Griffin's sponsorship of SB 149. No precise introduction date or enactment is inferred.

## Verified per-person records

All per-person vote totals and all 27 office-service sponsorship totals matched on read-back. Raw choice counts include the five attendance choices explained above; legislative displays exclude them.

| Candidate | Source member choices | Sponsorships |
| --- | ---: | ---: |
| [Tim Fleming](https://www.civpulse.org/people/tim-fleming/) | 1,643 | 112 |
| [Tanya Miller](https://www.civpulse.org/people/tanya-miller/) | 1,643 | 203 |
| [Miriam Paris](https://www.civpulse.org/people/miriam-paris/) | 4,485 | 260 |
| [Anissa M. Jones](https://www.civpulse.org/people/anissa-m-jones/) | 818 | 86 |
| [Dale Washburn](https://www.civpulse.org/people/dale-washburn/) | 3,207 | 221 |
| [Tangie Herring](https://www.civpulse.org/people/tangie-herring/) | 818 | 113 |
| [Floyd Griffin](https://www.civpulse.org/people/floyd-griffin/) | 818 | 67 |
| [Greg Dolezal](https://www.civpulse.org/people/greg-dolezal/) | 3,345 | 673 |
| [Brian Strickland](https://www.civpulse.org/people/brian-strickland/) | 5,790 | 1,094 |
| [Steven McNeel](https://www.civpulse.org/people/steven-mcneel/) | 429 | 43 |
| [Rick A. Williams](https://www.civpulse.org/people/rick-a-williams/) | 4,151 | 794 |
| [David E. Lucas](https://www.civpulse.org/people/david-e-lucas/) | 9,057 | 1,135 |
| [Tyler Harper](https://www.civpulse.org/people/tyler-harper/) | 3,809 | 1,016 |
| [Keisha Sean Waites](https://www.civpulse.org/people/keisha-sean-waites/) | 2,412 | 351 |
| [Austin Scott](https://www.civpulse.org/people/austin-scott/) | 3,119 | 180 |
| [Josh McLaurin](https://www.civpulse.org/people/josh-mclaurin/) | 3,342 | 482 |
| [Sanford Bishop](https://www.civpulse.org/people/sanford-bishop/) | 1 | 0 |

## Verification and publication

All content imports completed through the authenticated MCP import API. Read-back confirmed 48,887 raw candidate choices (48,882 excluding the reviewed attendance vote), 6,830 sponsorships and 28,904 bill actions. The combined research files cover 16,349 distinct bill IDs; the provider catalog has one additional record outside that file set. Existing records are preserved.

The current checkout passed bun run check with zero diagnostics and bun run build with local test data (274 pages). Public anonymous Bishop and vote-detail pages rendered correctly with no console errors. PR #41 also passed its database and MCP regression tests.

Publication: final rebuild pending after all content imports.

# Search visibility and AI sourcing baseline — November 1, 2026

This is an observation baseline, not evidence of ranking loss or an SEO/AI citation
improvement. Read-only access to the owned property was available. Full indexed
coverage and a general AI citation/accuracy rate remain **unknown**.

## Evidence and scope

| Artifact | What it establishes |
| --- | --- |
| [Inventory summary](inventory-summary.json) | Production sitemap fetch dates, HTTP status, SHA-256, shard counts and categories |
| [Exact URL inventory](expected-public-urls.csv.gz) | 54,097 unique production sitemap-listed canonical candidates; compressed CSV, not proof of indexing or an exhaustive database inventory |
| [Local comparison](local-comparison.json) | Separate isolated local content corpus; never substitute its count for production |
| [Provider summary](provider-summary.json) | Selected saved GSC/GA4/Bing snapshots, source dates/scopes, lab/field observations and explicit gaps |
| [Indexed URL sample](indexed-url-sample.json) | Eight purposeful key URLs inspected through Google's indexed-version API; no live crawl/indexing request |
| [Prompt portfolio](prompt-portfolio.json) | Three exact unbranded civic questions, target pages for observer analysis and fact-check rubrics |
| [AI observations](ai-trials.json) | Two ChatGPT attempts, one completed answer with a partial factual audit; Copilot access limitation |
| [Retrieval observations](web-retrieval-trials.json) | Three prompts × two separate web-tool requests; returned URLs, not consumer SERP ranks or AI citations |
| [Trial worksheet](trial-worksheet.csv) | Comparable run identifiers, dates, sample units, outcomes and accuracy availability |
| [Metric worksheet](metric-worksheet.csv) | Selected aggregate values, periods and interpretation limits |

The exact CSV can be read without installing another tool:

```bash
bun -e 'process.stdout.write(Bun.gunzipSync(await Bun.file("docs/measurement/2026-11-01/expected-public-urls.csv.gz").bytes()))' > /tmp/civpulse-expected-urls.csv
```

The inventory was fetched on November 1 at 23:01 UTC: sitemap-0 has 45,000 entries,
sitemap-1 has 9,097. The index and both shards returned HTTP 200. There are no
sitemap paths excluded by the current code's noindex policy. This checks listed
paths against that policy; it does not audit every deployed page's HTML, HTTP
headers, canonical or access gate. Public URLs came from production, not private
viewer records. Raw analytics paths/query strings, account emails, other owned
websites, tokens, HTP job UUIDs and private inspection links are omitted.

## Search, analytics and performance

- **Google:** `sc-domain:civpulse.org`, saved permission `siteOwner`; selected
  Search Console web report filters hostname `www.civpulse.org`. Requested window:
  October 4–31, provider timezone America/Los_Angeles; fetched November 1 at 22:37
  UTC. Summary reports **0 clicks and 0 impressions**, with empty query/page rows.
  Latest observed date is October 30, and only six daily rows are returned. This
  is not a fully fresh, complete inventory of queries or all search surfaces.
  Anonymized queries are excluded; the provider does not guarantee completeness.
  CTR and average position are not meaningful without impressions. The supplied
  previous-period comparison is unavailable (`period_freshness_unconfirmed`).
- **Google UI:** the owned property's sitemap table showed **Success**, last read
  October 31, **35,388 discovered pages** for both the index and sitemap-0. Do not
  add those overlapping counts. The Page indexing report displayed “Processing
  data, please check again in a day or so”; indexed/not-indexed totals are unknown.
  The eight API inspections found one indexed homepage, three discovered-but-not-
  indexed URLs, and four unknown URLs. This is a selected sample, not a 1/8 site
  coverage estimate. Indexed inspections describe Google's saved version.
- **Bing:** the connected report selects verified **`https://civpulse.org/`**,
  rather than a www-filtered property. Its November 1 snapshot has two traffic rows:
  October 28 (0 impressions/clicks) and October 29 (5 impressions, 0 clicks).
  Three returned query rows on October 30 each have one impression and no clicks.
  Do not add query impressions to traffic totals, fill missing dates with zero,
  or infer a stable rank from those tiny query samples. Saved sitemap status is
  Success with 35,297 URLs, last crawled October 26. Empty page/crawl/issue arrays
  do not establish a clean full-site audit or an indexed count.
- **GA4:** configured property `560854378`, hostname-filtered October 4–31 report,
  fetched November 1 at 22:19 UTC: **20 active users, 87 sessions, 969 pageviews**.
  Channel sessions: Direct 79, Organic Search 6, Organic Social 2. Use the distinct
  user summary; do not sum daily users. Only 10 page rows were returned despite a
  reported rowCount of 330; raw query-bearing paths are not published. There is
  no session source/medium/referrer breakdown here, so **AI referrals are unknown**.
  Organic Search sessions are not equivalent to GSC clicks.
- **Performance:** CrUX PHONE and DESKTOP origin snapshots both report
  `insufficient_data`. Field Core Web Vitals are unavailable, not passing. One
  homepage Lighthouse lab observation per device reports performance 0.98 mobile
  and 0.99 desktop; LCP 902 ms / 245.5 ms, respectively. These are lab samples for
  one URL, not field results or a site-wide grade. No backlink dataset was available.

The live 54,097 URLs, Google's 35,388 discovered pages and Bing's 35,297 feed URLs
have different observation dates and meanings. Their differences are **not counts
of missing indexed pages**. The isolated local comparison is also a different
content database, not a deployment or production regression comparison.

## Prompt trials and accuracy

The portfolio covers election administration, property-tax office roles, and
districting/apportionment. Target Civic Pulse pages were not included in the exact
prompts. The available OpenAI web search tool was selected as a **retrieval**
platform; its underlying provider/model, cache, location and rank controls were not
exposed. Six separate requests returned 25/23/28 URLs per prompt in each repeat.
No Civic Pulse URL appeared in those returned sets. Same-session repeats may be
cached/dependent; this is not a global ranking, index coverage or citation metric.
No synthesized answer was produced by those tool requests, so answer accuracy is
not applicable to them.

ChatGPT web was observed in fresh **Temporary / Unpersonalized** chats, with the UI
model label **Instant** (version not exposed). P1's first attempt displayed a
response-load error. The repeat produced an answer. The worksheet excludes the
failed attempt from completed-answer/citation denominators; it is not an answer
with zero citations. Browser timing is retained at date precision, not invented
exact timestamps. No account or chat identifiers are published.

The completed P1 answer's three resolved source URLs are retained exactly. Its
selected official contact checks—website, street/suite, phone and weekday hours—
were supported by the [county contact page](https://www.maconbibb.us/board-of-elections/contact-us/)
and [official board site](https://www.maconbibb.us/board-of-elections/) read on the
baseline date. This is **4/4 selected checks, not 100% full-answer accuracy**.
Detailed statutory duties, email, ZIP/location context and all citation chips were
not fully audited. A PeachTracker citation label was visible but its Open control
did not resolve a URL in the observed UI. Thus citation enumeration is incomplete:
zero Civic Pulse URLs among resolved links is not a complete citation rate.
Copilot required sign-in, so no prompt was submitted there. P2/P3 consumer-AI
answers and broader independent repeats remain future observations, not fabricated
samples. One completed answer cannot establish recommendation or accuracy rates.

Keep four outcomes separate:

| Outcome | Definition | This baseline |
| --- | --- | --- |
| Referral | Measured visit/session attributed to a documented source/medium/referrer | Unknown; GA4 source dimensions missing |
| Mention | Civic Pulse named in visible answer text, possibly without a link | Not observed in the one completed P1 answer |
| Citation | A linked source supporting an answer claim | Resolved links recorded; full citation census incomplete |
| Recommendation | Explicit suggestion to use Civic Pulse, rather than merely listing a source | Not observed in the one completed P1 answer |

Search-result appearances have their own column; they are not AI citations.
Google's [AI features documentation](https://developers.google.com/search/docs/appearance/ai-features)
explains that ordinary SEO requirements apply and AI search traffic is included in
Search Console Web reporting. It does not supply a separate citation rate or
require a special AI file. A `site:` query or one answer is never a complete
visibility metric.

## Manual comparison cadence and priorities

1. **Next weekly check:** re-read the GSC processing state and sitemap table,
   including discovery of the second production shard. Repeat these same eight
   indexed inspections. Record provider observation dates, not just today's date.
   Do not diagnose missing content or submit indexing requests from this sample.
2. **Weekly comparable metrics:** choose one matched 28-day window ending at least
   three days earlier, confirm latest observed dates, retain property/hostname/
   search type/timezone and source freshness, and read one latest snapshot per
   selected source. Do not sum repeated snapshots or overlapping date windows.
   Record queries/pages, impressions/clicks, bounded-row limits and unknowns.
3. **Monthly prompt check:** keep these exact prompts and scoring rubric; run two
   fresh trials per selected available platform across different days. Record UI
   model label/version if exposed, mode, date, region if actually known, result
   type, all resolvable citation URLs and errors. Assess each material claim
   against dated official sources: supported / contradicted / unverified. Keep
   full-answer completeness distinct from selected fact checks. Do not silently
   replace prompts when comparing versions. Keep search retrieval and consumer-AI
   answer denominators separate; small repeats are descriptive, not guarantees.
4. **Evidence-led work:** first resolve coverage/freshness gaps. Then prioritize
   high-impression/low-CTR public pages only when meaningful query/page data exists,
   or content/source errors demonstrated in repeated factual audits. Check readable
   public context and internal links on important discovered/unknown pages before
   creating more pages. The current sample does not justify a ranking-loss claim
   or mass outreach. Consider human-reviewed outreach only when repeated evidence
   identifies a relevant public resource gap; log the hypothesis and measure later.
5. **Fill explicit gaps manually:** capture aggregate Page indexing totals once
   processed; obtain a safe GA4 source/medium view for AI referrals; finish P2/P3
   consumer-AI trials and unresolved citation audits; retain unavailable CrUX until
   the provider supplies data. No recurring automation, purchase, sitemap submission,
   provider rebinding or external messages were created by this task.

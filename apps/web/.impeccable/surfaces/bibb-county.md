# Bibb County community hub

- Target: `/counties/bibb/`, implemented in `src/pages/counties/bibb.astro`.
- Mode: **Operate** within the incumbent Civic Pulse system.
- User intent: build a community hub in code, retain the existing visual style, and include sourced Census demographics.
- Scope: a county pilot, not a new global identity or an approved design-system change. No incumbent `DESIGN.md` was present; this surface record does not establish one.

## Direction and composition

Use the shared `Layout.astro` shell, Civic Pulse brand, navigation, footer, and `Icon.astro` arrows. Preserve the cream canvas, forest ink, sage surfaces, rust interaction accent, Unna headings, and DM Sans body defined by `styles/global.css`. The county page references existing variables rather than introducing palette or font primitives.

The intro pairs an invitation to explore with task links. Section anchors lead to maps and places, demographics, government and people, elections, and events. The map area combines a compact map directory with a real commissioner district preview. Census figures use a six-measure definition list, a three-measure comparison chart, eight native expandable topic tables, and a source disclosure. The profile contains 59 measures with matching Georgia comparisons. Organization and people records use divided rows; elections and events occupy adjacent columns. Coverage and empty-state text describe the limits of this curated pilot.

Use public data and existing visibility-aware fetch paths. Static organization, people, election, and map metadata is assembled during prerendering; events and the real map preview initialize in the browser. Do not introduce SSR or expose private records to support this composition.

## Source provenance

`src/data/bibb-county.ts` owns explicit organization/map selection and the saved Census QuickFacts snapshot for Bibb County, Georgia, FIPS 13021. Inclusion is editorial rather than inferred from name matching.

Each Census figure links to its measure and displays its reference period. Georgia uses matching indicators and vintages. The source disclosure distinguishes 2025 population estimates, 2020–2024 ACS five-year estimates, 2020 Census geography/counts, and business datasets. Comparisons share a 0–100% scale and are not significance tests. The CSV is generated from the displayed snapshot and includes both sources and check dates. Values were checked against official county and state QuickFacts tables October 26, 2026; the snapshot does not update automatically. Update values, periods, and source-check disclosure together. Do not imply that these mixed periods describe a single year.

## Responsive behavior

At widths up to 760px, the intro, map area, organization rows, and elections/events columns stack into one column. The Census definition list retains two columns, with smaller figures; section navigation wraps and section headings place their source/directory links below the heading. Comparison charts stack below 1050px. Topic tables preserve three semantic columns, wrap long text, and use smaller type on mobile. Native disclosures work without JavaScript. The map preview reduces from 310px to 260px high. The shared shell continues to own global responsive navigation.

## Evidence and incumbent limits

Checked `PRODUCT.md`, `styles/global.css`, `layouts/Layout.astro`, `pages/counties/bibb.astro`, and `data/bibb-county.ts`. The implementation follows the product commitment to preserve Civic Pulse identity and source-map colors/icons. Surface styling extends the existing tokens and shared shell without changing them.

Pre-existing documentation limit: `PRODUCT.md` capabilities still concentrate on the approved map recreation rather than describing the broader county hub. Its durable visual and hosting commitments remain applicable; no product or global design file was changed in this documentation pass. Browser behavior and source verification are covered by the implementation's separate validation, not claimed by this code inspection.

Age detail uses 18 non-overlapping bands from the official CC-EST2025-AGESEX-13 file, with counts and derived shares; Georgia aggregates all 159 counties. Race and ethnicity explicitly identify overlapping categories. Poverty uses 2024 SAIPE for county and state, with 90% confidence intervals and eligible-population definitions. CSV includes those details and per-measure source URLs.

## Chart presentation

The demographic section now leads from headline figures into three accessible
chart tabs: Age, Race & ethnicity, and Poverty. Age uses paired horizontal bars
on a shared 0–10% scale. Race uses 0–100% paired bars; Hispanic origin is a
separate figure because it overlaps race. Poverty uses point estimates and
90% interval lines on a shared 0–50% scale. Forest and rust consistently identify
Bibb County and Georgia, with exact values and text labels alongside marks.
Tabs support arrows, Home, and End. Without JavaScript all chart sections remain
visible. Charts derive from the existing verified snapshot; topic tables and
CSV preserve all 59 measures and source definitions. Mobile stacks the race and
ethnicity regions and retains labeled age rows without horizontal scrolling.

# Open Exhibition validation

The Open Exhibition redesign uses a blue canvas, warm paper, lime selections,
and Anton/Barlow typography. Dark mode follows `prefers-color-scheme` without
persisting a separate preference. The approved composition is preserved in
`apps/web/.impeccable/mocks/exhibition-open.png`; the design system lives in
`apps/web/DESIGN.md` and its Impeccable sidecar.

## Browser coverage

Checked light and dark appearances at desktop (1440 px) and mobile (390 px):

- Home, Bibb County, people, organizations, elections, calendar, maps, records,
  legislation, records requests, documents, search, About, user/admin/AI guides,
  and signup.
- Representative election, organization, person, commissioner map, and event
  detail pages.
- Signed-in administration: organizations, people, offices, articles, maps,
  layers, calendars, meetings, elections, legislation, requests, users, links,
  and publish. Local test-account sign-in/sign-out was exercised; no production
  records or publish actions were submitted.
- Account and history at mobile width; the not-found page at desktop width.

Rendered text-contrast and page-overflow checks found and resolved the county
lime map card's dark-mode text, county quick-link hover color, chart tracks that
could blend into bars, and the election map attribution's dark-mode background.
The confirmation pass found no remaining visible-text contrast failures or
horizontal page overflow in those affected views. Visually hidden labels are
excluded from contrast conclusions. Data-defined map and calendar colors remain
unchanged. Browser error logs were empty after the final navigation checks.

The local Publish screen reports that it cannot reach the publishing service;
its layout was checked, but a deployment was not attempted. The local dataset
contains empty legislation/request states; this review does not
claim exhaustive coverage of every production record or third-party basemap.
The homepage's earlier comp fidelity gate passed at 86.25% at the approved
1536 × 1024 reference size.

## Commands

- `bun run check`: no errors, warnings, or hints.
- `bun run build`: 275 static pages generated against the local dataset.
- `bun test scripts`: 311 passed, 47 environment-dependent tests skipped, 0 failed.

For future palette edits, repeat browser checks for selected lime surfaces,
inverted panels, chart tracks, map controls/attribution, form states, and links in
both color schemes. Keep page overflow separate from intentional internal table
scrolling, and verify the browser preference changes the theme without reloading.

After integrating main’s county filter, rechecked the shared header, homepage,
election detail, and people directory in both themes and viewport sizes. County
selection persists across navigation, and Bibb remains the default. The picker
and status use canvas foreground colors to retain contrast.

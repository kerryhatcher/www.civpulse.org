---
{name: Civic Pulse — Open Exhibition,description: "An open civic exhibition with monumental type, clear topic labels, and readable public information.",colors: {blue: "#0838d7",lime: "#daf868",paper: "#f6f7f2",ink: "#111815",muted: "#485254",line: "#b8c1cd",control-line: "#758291",blue-rule: "#7594ef",blue-hover: "#1848e5",blue-deep: "#062baa",ink-hover: "#25312a",canvas: "#0838d7",on-canvas: "#f6f7f2",canvas-rule: "#7594ef",surface-soft: "#e5e9ef",surface-hover: "#e8edf9",map-caption: rgb(246 247 242 / 96%),panel: "#daf868",panel-rule: "#7d9144",selected-ink: "#111815",dark-canvas: "#090f20",dark-paper: "#141e30",dark-ink: "#f2f5ec",dark-muted: "#b6c2d5",dark-blue: "#a3b9ff",dark-blue-deep: "#c1ceff",dark-line: "#43516a",dark-control-line: "#71829c",dark-surface-soft: "#202d43",dark-surface-hover: "#293951",dark-map-caption: rgb(20 30 48 / 96%),dark-panel: "#222e1b",dark-panel-rule: "#66784c"},typography: {display: {fontFamily: "\"Anton\", sans-serif",fontSize: "clamp(100px,17.5vw,294px)",fontWeight: 400,lineHeight: 0.92,letterSpacing: "-0.04em"},headline: {fontFamily: "\"Anton\", sans-serif",fontSize: "clamp(40px,5.85vw,96px)",fontWeight: 400,lineHeight: 1.08,letterSpacing: "-0.025em"},title: {fontFamily: "\"Barlow Condensed\", sans-serif",fontSize: 44px,fontWeight: 600,lineHeight: 1.08},topic: {fontFamily: "\"Barlow\", sans-serif",fontSize: "clamp(28px,3vw,46px)",fontWeight: 700,lineHeight: 1.05,letterSpacing: "-0.04em"},body: {fontFamily: "\"Barlow\", sans-serif",fontSize: 16px,fontWeight: 400,lineHeight: 1.6},panel-body: {fontFamily: "\"Barlow\", sans-serif",fontSize: 26px,fontWeight: 400,lineHeight: 1.2},label: {fontFamily: "\"Barlow\", sans-serif",fontSize: 16px,fontWeight: 400},panel-label: {fontFamily: "\"Barlow\", sans-serif",fontSize: 17px,fontWeight: 600,lineHeight: 1.2,letterSpacing: .08em},date: {fontFamily: "\"Barlow Condensed\", sans-serif",fontSize: 38px,fontWeight: 600,lineHeight: 1.1,letterSpacing: "-.04em"},panel-action: {fontFamily: "\"Barlow Condensed\", sans-serif",fontSize: 27px,fontWeight: 600,lineHeight: 1.2}},rounded: {square: "0",search-inner: 3px,control: 6px},spacing: {compact: 8px,small: 12px,base: 16px,medium: 24px,large: 36px},components: {button-primary: {backgroundColor: "{colors.ink}",textColor: "{colors.paper}",rounded: "{rounded.control}",padding: 10px 16px},button-primary-hover: {backgroundColor: "{colors.blue}",textColor: "{colors.paper}"},button-secondary: {backgroundColor: "{colors.paper}",textColor: "{colors.ink}",rounded: "{rounded.control}",padding: 10px 14px},button-secondary-hover: {backgroundColor: "{colors.lime}"},input: {backgroundColor: "{colors.paper}",textColor: "{colors.ink}",rounded: "{rounded.control}",padding: 10px 12px},topic-selected: {backgroundColor: "{colors.lime}",textColor: "{colors.selected-ink}",rounded: "{rounded.control}",padding: 23px 14px},detail-panel: {backgroundColor: "{colors.panel}",textColor: "{colors.ink}",rounded: "{rounded.control}",padding: 30px 32px 6px},detail-panel-dark: {backgroundColor: "{colors.dark-panel}",textColor: "{colors.dark-ink}",rounded: "{rounded.control}",padding: 30px 32px 6px},button-primary-dark: {backgroundColor: "{colors.dark-ink}",textColor: "{colors.dark-paper}",rounded: "{rounded.control}",padding: 10px 16px},button-primary-dark-hover: {backgroundColor: "{colors.lime}",textColor: "{colors.selected-ink}"}}}
---

# Design System: Civic Pulse

## Overview

**Creative North Star: "Open Exhibition"**

Civic Pulse presents public information with the directness of exhibition signage: monumental condensed headings, a saturated ultramarine ground, and precise topic labels. Paper reading surfaces and lime selection surfaces keep dense civic information readable inside that expressive identity. The browser/system appearance preference automatically switches the canvas and reading surfaces to navy while retaining lime selection and pale reading text.

The name remains geographically expandable. Bibb County, Georgia appears as separate location context, without suggesting that other county hubs already exist. This document records implemented styles; it does not certify a finish-review verdict. Source authority is `src/styles/global.css`, `src/layouts/Layout.astro`, and the implemented homepage and search scripts. The approved composition and review screenshots provide visual context; source values take precedence.

**Key Characteristics:**

- Monumental Anton display typography with readable Barlow labels and prose.
- Ultramarine/light and navy/dark canvases, distinct reading surfaces, and acid-lime selected topics.
- Numbered, ruled topic navigation and compact date indexes.
- Flat surfaces, restrained rounding, and explicit keyboard focus.

## Colors

### Primary

**Ultramarine (`blue`)** is the shared canvas, interior page-title color, and primary-link hover color. **Blue hover** brightens unselected topic rows. **Blue rule** separates sections on the saturated canvas.

### Secondary

**Acid lime (`lime`)** identifies the selected topic and supplies focus contrast on the canvas. In light appearance, the detail panel shares its lime ground. In dark appearance, the panel becomes deep olive with pale body text and lime exhibit headings; the selected index row stays lime with fixed selected-ink text.

### Neutral

**Paper** carries reading surfaces and light text on blue or ink. **Ink** carries readable text on paper/lime and dark actions. **Muted** supports secondary text on paper; **line** separates interior content. **Control line** supplies stronger field boundaries: `#758291` against light paper (3.64:1) and `#71829c` against dark paper (4.27:1). Decorative rules retain their quieter line token. **Ink hover** is the homepage search-button hover state.

The canvas is separate from the interactive blue token: body backgrounds use `canvas`, while header/footer text uses fixed `on-canvas`, never the reading-surface `paper` token. `paper` and `ink` exchange light/dark reading roles. Existing CSS names remain compatibility aliases: `rust` follows blue; `sage` remains lime; `rust-dark` follows blue-deep. Focus is blue in light appearance and lime in dark appearance. The legacy `serif` name resolves to Barlow Condensed, not a serif face. Preserve these aliases while extending existing components.

**The Surface Contrast Rule.** Use on-canvas text on the canvas, ink text on reading surfaces, and fixed selected-ink text on lime; select the focus color for the surface underneath it.

### Automatic appearance

Light colors are the default. The `prefers-color-scheme: dark` media query reassigns the semantic CSS properties to the frontmatter’s dark colors; lime, selected-ink, and on-canvas remain fixed. Theme changes are immediate CSS responses, without a saved override or theme toggle. The document advertises `color-scheme: light dark` and supplies media-specific theme-color metadata for the light and dark canvases. Dark surface-soft, surface-hover, map-caption, panel, panel-rule, line, control-line, muted, and blue roles preserve the same component hierarchy. Sidecar ramps are palette-inspection aids, not additional shipped CSS values.

## Typography

Anton is the display face. Barlow is the reading and navigation face. Barlow Condensed supplies secondary headings, compact topic labels, and dates. Fonts are bundled through Fontsource; the layout loads Anton 400, Barlow Condensed 600, and Barlow 400/500/600/700.

The frontmatter captures the desktop masthead, detail headline, secondary section title, topic, body, panel-body, navigation label, numbered panel label, date, and panel-action roles. Desktop masthead lettering uses `scaleX(.88)` from the left center; at 800px and below the transform is removed, its size becomes `clamp(48px,21vw,176px)`, and line-height becomes 1.05. Desktop topics use Barlow 700, while mobile topics use Barlow Condensed 600 and `clamp(22px,6.9vw,27px)` below 480px. Interior page titles use Anton at `clamp(42px,5vw,76px)`. General headings use Barlow Condensed with a compact line height; paragraphs retain a more generous reading rhythm. Interior intro copy is limited to 70ch; prose is limited to 76ch.

**The Display and Reading Rule.** Reserve Anton for identity and major headings; use Barlow for explanatory copy and controls.

## Layout

The shared shell is centered with a maximum width of 1680px and 2.2% horizontal padding. At 480px and below, gutters become 16px. Interior pages use a paper main surface with `clamp(18px,3vw,48px)` horizontal padding.

The homepage masthead places identity and search in a 1.73:1 grid, while the topic workspace uses a 1.12:1 grid with a 22px gap. The masthead uses 18px top padding, and the detail surface uses 30px 32px 6px padding with a 622px minimum height at full desktop width. A compact ruled footer immediately follows the workspace; the homepage no longer renders a map carousel or separate guide area. Maps, local guide, and archive destinations remain accessible through topics and footer navigation. These are homepage composition values, not mandatory grids for every page. At 1100px, the masthead ratio becomes 1.5:1 and topic descriptions move beneath names. At 800px, masthead and detail stack, and the topic index becomes two `minmax(0,1fr)` columns so long labels cannot force overflow. Mobile labels use Barlow Condensed; descriptions disappear while all six destinations remain available. Below 480px, topic arrows disappear and search becomes more compact.

The shared browse menu uses three columns on desktop and one scrollable column at 650px and below. Footer content stacks at 800px. Preserve 44px minimum targets for ordinary controls and links; topic rows are larger.

## Elevation & Depth

The exhibition is flat: color fields, one-pixel rules, and whitespace establish hierarchy without card shadows. The browse menu overlays content through positioning and stacking order, with a lime lower edge. Existing inset calendar-range marks are state indicators, not a general raised-surface vocabulary.

Topic reveal uses a 200ms upward settle from 6px with `cubic-bezier(.16,1,.3,1)`. Reduced-motion removes that animation and smooth document scrolling. Mobile topic selection scrolls directly to the panel, without animated travel.

## Shapes

Selected topics, detail panels, and ordinary controls use the shared gentle control radius. Search has smaller inner corners inside its outer shell. Directory cards remain square. Rules, numbered labels, and inline SVG arrows are the repeated visual geometry; source map symbols retain their own domain-specific forms and colors.

## Components

**Actions.** Primary links use ink with paper text and turn blue on hover in light appearance. In dark appearance they use pale ink with dark paper text, then lime with selected-ink text on hover. Generic buttons use paper and turn lime on hover; dark hover explicitly uses selected-ink. The homepage detail action uses Barlow Condensed, 12px 30px padding, 27px type, and a 58px minimum height (23px type and 18px horizontal padding below 480px). Disabled buttons reduce opacity and stop advertising a pointer cursor.

**Fields and search.** Ordinary inputs and selects have paper fill, a control-line border, and a 44px minimum height; textareas share the stronger boundary token. Homepage search joins a borderless field and ink action inside a paper shell. Its desktop field uses 18px Barlow and the action uses 24px Barlow Condensed 600. Its field is 58px high, reduced to 50px below 480px. Focus uses a blue inset outline so it remains visible inside the pale shell. Search Clear resets the query, type, and page while preserving county context, then returns focus to the query field.

**Topic index.** Number, topic name, description, and SVG arrow form each desktop link. The selected link uses lime with fixed selected-ink and `aria-current="true"`. The visible numbered section label repeats the approved exhibit identifier in uppercase; this is a specific topic-navigation device, not a requirement to add decorative labels elsewhere. JavaScript hides other panels and focuses the selected section heading; without JavaScript all sections remain reachable by anchors. Location hashes and browser history preserve topic selection. The upcoming-date section stays adjacent to the selected detail.

**Navigation.** The interior masthead uses the compact Civic Pulse wordmark and lime dot. Homepage navigation keeps the county context separate. Header links expose hover/current state through a lime underline; the browse menu uses native details/summary, Escape dismissal, and focus return.

**Cards and records.** Paper directory cards use borders and square corners. Search results reuse this family, with readable type labels and visibility badges when returned for authorized users. People defaults to officials first, candidates next, then other people, alphabetically within each group and before pagination. Explicit alphabetical sorts remain available; Clear restores the civic-first default. Person images are optional and retain initials as a fallback. Loading, empty, and failure messages remain text rather than decorative illustrations.

**Dates and maps.** The homepage groups the fetched upcoming events by America/New_York calendar day, preserving every event link in each group. Each link’s accessible name includes its full formatted date/time. Visible metadata repeats time and time zone (or all-day status), organization/calendar, and venue so users can assess an event without opening it. A condensed date occupies a 136px column beside titles separated by a vertical rule; at 1100px the date column becomes 90px, then 75px below 480px. Date type changes from 38px to 31px below 480px. Maps remain a topic destination; source geographic colors and icons stay unchanged in either appearance. Leaflet popup, control, and attribution chrome adapts to dark reading surfaces. Attribution styling must retain enough selector specificity to override Leaflet’s stylesheet after it loads. Selecting a directory record moves keyboard focus into a labelled map-details region; closing it or pressing Escape returns focus to the originating control, with directory search as a fallback if filtering removed that control. Passive URL-driven popup opens do not steal focus.

**Interior information order.** Calendar filters are grouped in a disclosure before the dates; subscription and download tools sit after the month grid and before the event list in their own disclosure. Election pages expose Dates, Results & turnout, and Ballot jump links. A lime summary surface near the top highlights county-scoped turnout, with honest loading, empty, and failure states; dates and full turnout/map sections precede the long ballot list. Summary and charts share one runtime snapshot and never sum overlapping source tables.

## Do's and Don'ts

- Do keep geographic context separate from the Civic Pulse name.
- Do pair monumental display headings with readable Barlow body copy.
- Do use lime for selected topics and preserve fixed dark text on that lime surface.
- Do distinguish visible control boundaries from decorative separators.
- Do preserve visible keyboard focus, reduced-motion behavior, and automatic system appearance.
- Do preserve source map colors, icons, historical records, and version notes.
- Don't turn every reading surface into a floating or heavily rounded card.
- Don't imply geographic coverage or civic capabilities that are not available.
- Don't expose hidden data to achieve a visual composition; static Astro and visibility-aware reads remain binding.

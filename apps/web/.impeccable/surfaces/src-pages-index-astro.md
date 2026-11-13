---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/layouts/Layout.astro","src/styles/global.css"]
---

# Civic Exhibition homepage

Mode: Operate. Audience: residents looking for people, organizations, elections, dates, places, and public records. Initial content is Bibb County; the brand must accommodate expansion. Preserve static Astro, visibility controls, live data hooks and all existing destinations. User chose Civic Exhibition after rejecting two generic hands and requesting distinctive, unexpected design.

## Direction contract

THESIS: A public-information exhibition with expandable topic labels rather than a marketing hero and card grid.

OWN-WORLD: Saturated ultramarine, bone-white typography, acid-lime selected panels, precise rules and restrained black actions. Strongly condensed masthead contrasts with readable civic labels.

STORY: Residents immediately recognize the civic topics, open a section and follow a record; universal search stays visible.

FIRST VIEWPORT: User selected Open Exhibition. A monumental single-line Civic Pulse masthead spans the top left, with search beside it. Six numbered topic rows occupy the left column; the selected row and right detail panel use acid lime. Real election dates and public events fill the initial panel. Mobile stacks the masthead, search, two-column topic index, and detail panel. The compact footer closes the first viewport. Maps and local guide destinations remain available through topic panels and footer links. Events sharing an Eastern calendar date are grouped without removing individual links.

FORM: Contemporary exhibition label system; grounded candidate five, seed 829d07e0, reroll two. User chose this direction explicitly. Signature interaction: accessible topic expansion, preserving adjacent labels; reduced-motion uses instant state changes.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Content corrections
Generated descriptions suggesting property datasets or direct public-record submission must be replaced with accurate descriptions of the existing directories and records-request tracking. The election panel is date-aware and uses actual public election data. Location context must not imply other counties are already available.

## System appearance

The user requested a dark version that follows browser host settings. Use prefers-color-scheme: dark with navy canvas and reading surfaces, pale text, lime selection and exhibit headings. Theme changes are immediate and do not persist an override. Preserve source map symbology.

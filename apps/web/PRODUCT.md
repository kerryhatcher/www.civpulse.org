# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Civic Pulse helps residents find people, organizations, elections, community events, maps, and public records. Initial coverage centers on Bibb County, Georgia; the Civic Pulse identity accommodates later geographic expansion.

## Capabilities and Constraints

The approved map recreation includes 17 presets and 24 reusable layers, with source colors and icons, layer controls, searchable places, and feature details. Data is stored in PostGIS and read through visibility-aware RPCs. The frontend is static Astro hosted as Cloudflare Workers assets. Admin edits require a rebuild for static metadata. Existing public, unlisted, and private access rules remain binding.

## Brand Commitments

The user approved the Open Exhibition redesign: monumental condensed typography, ultramarine surfaces, paper reading areas, lime selected topics, and a numbered civic topic index. Follow the browser/system appearance preference automatically, with a dark navy variation of the same exhibition system. Keep location context separate from the expandable Civic Pulse name. Preserve source maps' colors, icons, historical records, and data-version notes. Use Impeccable for design work.

## Evidence on Hand

The live maps and downloadable GeoJSON at https://www.civpulse.org/maps/ and https://www.civpulse.org/data/ are the recreation reference. Repository architecture and backend documentation define the implementation constraints.

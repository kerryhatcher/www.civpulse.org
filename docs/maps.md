# Hosted geometry loading

Viewers and homepage previews fetch stored features through `get_layer_geojson_page`
in ordered batches of 50, with at most two follow-up requests per layer at once.
The RPC applies the same map/layer visibility gate as the full-document RPC and
returns `numberMatched` so clients can assemble every feature without an extra
empty request. This keeps large district boundaries within hosted query timeouts.
The original full-document RPC remains available for existing consumers.


# Recreated maps

The map explorer at `/maps/` recreates the 17 public presets and 24 reusable
layers captured from www.civpulse.org on October 22, 2026. It contains 1,345
features. A preset is an ordinary map with all available layers linked and only
its initial selection marked `visible_by_default`. Other maps may link fewer
layers. The viewer only offers layers returned by `get_map_layers`, so private
layers and geometry continue to use the containing-map access gate.

## Importing the snapshots

Apply migrations, then run:

```sh
bun --env-file=apps/web/.env scripts/import-maps.mjs
bun run build
```

The importer signs in with the local test administrator on localhost. Against a
hosted project it requires both `MAP_IMPORT_ALLOW_HOSTED=1` and an existing admin
access token in `MAP_IMPORT_ACCESS_TOKEN`; it never uses a service-role key.
Verify the destination `PUBLIC_SUPABASE_URL` before running a hosted import.
The script checks every gzip snapshot's SHA-256 and feature count before any
writes. Import markers in `presentation.snapshotId` / `view_options.snapshotId`
make repeat runs preserve later administrator edits, visibility and geometry.
Unrelated maps with colliding slugs are rejected before writes. Individual layer
imports and map/link saves are atomic. If a later import fails, fix its cause and
rerun; previously completed imports are retained. No automatic source refresh is
configured.

`scripts/data/maps/manifest.json` records source URLs, counts, hashes, original
styles, preset selections, and repairs. Compressed GeoJSON stays under
`scripts/data/maps/`, outside public assets and prerendered HTML. Original marker
assets are in `apps/web/public/maps/icons/`.

The original elementary attendance dataset has two ring self-intersections:
Hartley (`school-zones-elementary:5`) and Porter (`school-zones-elementary:10`).
Its original gzip and hash are retained. The separate import copy uses PostGIS
`ST_CollectionExtract(ST_MakeValid(geometry), 3)` and marks these features with
`webGeometryRepaired` and a `geometryNote`. No features are removed or simplified.
Other source properties and feature IDs are preserved, with `_sourceCategory`
and `_markerKey` added for exact source styling. Event markers are snapshots of
the original organization's icon with the venue's calendar-color segments.

## Presentation and styles

`layers.presentation` is an object, edited in **Layer presentation** in the
Layers admin. Supported settings:

- `key`: URL layer key, such as `polling-places`.
- `group`: layer-control group label.
- `titleProperty`, `titleSuffix`: feature properties used for its visible name.
- `searchFields`: property names searched in the place directory, including
  arrays and nested event titles.
- `popupFields`: ordered `{property, label, format}` entries; format is `text`,
  `url`, `email`, or `phone`. Imported text is rendered as text, never HTML.
- `renderer`: `fields` (default), `events`, `polling`, or `precincts`. The latter
  two cross-link records through their `pollingid` when both layers are linked.
- `attribution`, `sourceUrl`, `note`: provenance, source link and explanatory text.

The existing `layers.style` and per-map `map_layers.style` remain JSON objects.
The RPC merges the layer default with the partial map override. Old uniform
styles and sorted `categorizeBy` / `palette` behavior remain supported. **Icons &
exact colors** exposes these additions:

```json
{
  "categoryTarget": "fill",
  "categoryStyles": { "1": { "fillColor": "#2166ac" } },
  "colorProperty": "",
  "iconBy": "county",
  "icons": {
    "Bibb County": {
      "url": "/maps/icons/libraries/library-bibb.svg",
      "size": [36, 44],
      "anchor": [18, 42],
      "popupAnchor": [0, -38]
    }
  }
}
```

`categoryStyles` keys are exact values of `categorizeBy`; values are partial
styles. `categoryTarget` is `both` (the old behavior), `fill`, or `stroke` for
palette/property coloring. `colorProperty` reads a validated hex color from a
feature, such as GTFS `route_color`. `icon` is a uniform marker definition;
`iconBy` / `icons` select one by property value. Local asset and HTTP(S) URLs are
accepted; executable schemes are rejected. Category styles do not require a
24-color palette: explicit assignments preserve all district colors when
filtering or editing the data.

`maps.view_options` supports `center: [latitude, longitude]`, `zoom`,
`basemapVisible`, `fitBounds`, `note`, and `downloads: [{label, url, detail}]`. Edit it in
**Map view & downloads**. A configured center or zoom is honored unless `fitBounds` is true; imported presets set it true to match the source’s automatic fit. The map's Layers picker controls membership; **Visible
when this map opens** controls the initial selection. Map metadata and ordered
links save together through admin-only `save_map`.

## Viewer behavior

The explorer and standalone public/shared viewers use one renderer, also used
by admin previews. Panes are assigned by link order before data downloads, so
stacking does not depend on which layer finishes first. Snapshot maps place
polygons below routes below points. Layers load on demand, with retry on partial
failures. The searchable directory renders 60 results at a time and can show more.

URLs preserve `map`, comma-separated `layers` keys, `basemap=0`, and an optional
legacy `event` ID that opens its venue popup. The root explorer lists public
presets only; signed-in discovery of hidden maps remains in map search and UUID
viewers. Static metadata changes still require a rebuild/deploy. Data and layer
access remain runtime RPC calls; no SSR adapter is introduced.

Source periods are preserved: attendance zones are labeled 2025–26, legislative
boundaries use their 2026/120th Congress vintage, and the bus schedule covers
June 7–October 31, 2026. These labels do not imply live schedules or current
address-level voting/enrollment assignments.

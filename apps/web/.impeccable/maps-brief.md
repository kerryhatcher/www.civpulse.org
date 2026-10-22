# Maps surface

Mode: Operate. Approved recreation of the incumbent map workspace, not a rebrand.

The first viewport puts map choice and grouped layers beside a generous interactive map. Preserve the cream, forest, sage and rust tokens, Unna headings and DM Sans controls from global.css. Source colors are geographic data, not brand decoration. On mobile, settings precede the map in a collapsible panel; the directory follows the map on every device.

Primary tasks: choose a preset, combine layers, inspect a place, and share that view. Signature interaction: selecting a directory result opens its map popup and centers the feature; polling places and precincts cross-link. Layer toggles update the URL without losing the current extent. Use Leaflet's existing pan/zoom with reduced-motion support; no decorative entrances.

States: initial loading; no published maps; no selected layers; no search matches; partial layer failure with retry; basemap failure; private-map sign-in gate. Keep visible geographic content usable when another layer fails. Long event lists scroll inside bounded popups. Directory pages bound DOM growth at 60 results.

Verification: desktop and mobile in one inspection pass, one correction pass at most; anonymous and signed-in access checks; no console errors. Preserve static build architecture and runtime RPC visibility gates.

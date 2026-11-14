// Prepare MCP save_postgis_layer inputs from the reviewed Bibb County snapshot.
// bun scripts/prepare-bibb-alpr.mjs > /tmp/bibb-alpr-layers.json
import { fileURLToPath } from 'node:url';
const read = name => Bun.file(fileURLToPath(new URL(`./data/deflock/${name}-2026-10-23.geojson`, import.meta.url))).json();
const data = await read('bibb-cameras');
const boundary = await read('bibb-boundary');
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
if (boundary.features.length !== 1 || boundary.features[0].properties.GEOID !== '13021') throw new Error('Expected Bibb County, GA');
const geometry = boundary.features[0].geometry;
const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
const ids = new Set();
for (const f of data.features) {
  const p = f.geometry.coordinates;
  if (f.geometry.type !== 'Point' || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw new Error('Invalid WGS84 point');
  if (!polygons.some(poly => inRing(p, poly[0]) && !poly.slice(1).some(hole => inRing(p, hole)))) throw new Error('Camera outside Bibb County');
  const id = `${f.properties.osmType}/${f.properties.osmId}`;
  if (ids.has(id)) throw new Error('Duplicate OSM feature');
  ids.add(id);
}
const brands = ['Flock Safety', 'Genetec', 'Motorola Solutions'];
if (data.features.some(f => !brands.includes(f.properties.brand))) throw new Error('Review new manufacturer before importing');
const layers = brands.map((brand, index) => {
  const features = data.features.filter(f => f.properties.brand === brand).map(f => ({
    ...f, id: `${f.properties.osmType}/${f.properties.osmId}`,
    properties: { ...f.properties, cameraName: `${brand} · OSM ${f.properties.osmId}`, sourceUrl: `https://www.openstreetmap.org/${f.properties.osmType}/${f.properties.osmId}` },
  }));
  const color = ['#b45309', '#0f766e', '#6d28d9'][index];
  const layer = {
    name: `Bibb ALPR — ${brand}`,
    description: `${features.length} reported ${brand} camera location${features.length === 1 ? '' : 's'} in Bibb County, Georgia. Snapshot retrieved October 23, 2026.`,
    visibility: 'public',
    style: { color, fillColor: color, radius: 6, weight: 1, fillOpacity: 0.85 },
    presentation: {
      key: `bibb-alpr-${brand.toLowerCase().replaceAll(' ', '-')}`, group: 'ALPR camera manufacturers',
      snapshotId: `bibb-alpr-2026-10-23-${index}`, titleProperty: 'cameraName',
      searchFields: ['brand', 'operator', 'osmId', 'mountType', 'surveillanceZone'],
      popupFields: [['brand', 'Manufacturer'], ['operator', 'Reported operator'], ['direction', 'Direction (degrees)'], ['directions', 'Reported directions'], ['mountType', 'Mount'], ['surveillanceZone', 'Surveillance zone'], ['osmTimestamp', 'OSM last edited'], ['osmId', 'OSM ID']].map(([property, label]) => ({ property, label })),
      attribution: '© OpenStreetMap contributors · FlockHopper / deflock-data',
      sourceUrl: 'https://github.com/flockhopper3/deflock-data',
      note: 'Community-reported ALPR locations, not a verified inventory or proof that a camera is currently operating. Daily GeoJSON snapshot retrieved 2026-10-23; no automatic refresh.',
    },
    geojson: { type: 'FeatureCollection', features },
  };
  if (!features.length || features.length > 10000 || JSON.stringify(layer.geojson).length > 10 * 1024 * 1024) throw new Error('Invalid layer size');
  return layer;
});
console.log(JSON.stringify(layers));

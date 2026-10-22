#!/usr/bin/env bun
// Recreate the approved legacy maps from the checked-in, hashed snapshots.
// Run: bun --env-file=apps/web/.env scripts/import-maps.mjs
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const folder = new URL('./data/maps/', import.meta.url);
const manifest = await Bun.file(fileURLToPath(new URL('manifest.json', folder))).json();
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
const local = ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
if (!local && process.env.MAP_IMPORT_ALLOW_HOSTED !== '1') throw new Error('Hosted imports require MAP_IMPORT_ALLOW_HOSTED=1 and MAP_IMPORT_ACCESS_TOKEN for an existing admin.');
let token = process.env.MAP_IMPORT_ACCESS_TOKEN;
if (!token && local) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.TEST_USER_EMAIL ?? 'test@civpulse.org', password: process.env.TEST_USER_PASSWORD ?? 'civicpulse-test-123' }) });
  const auth = await response.json();
  if (!response.ok || !auth.access_token) throw new Error('Local admin sign-in failed. Run bun run db:seed-user.');
  token = auth.access_token;
}
if (!token) throw new Error('Set MAP_IMPORT_ACCESS_TOKEN to an existing administrator’s access token.');
async function request(path, body) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? `HTTP ${response.status}`);
  return result;
}
if (!await request('rpc/is_admin', {})) throw new Error('Admin access required.');
// Validate the entire bundle before any writes; never re-fetch mutable source URLs.
const datasets = new Map();
for (const layer of manifest.layers) {
  const compressed = new Uint8Array(await Bun.file(fileURLToPath(new URL(layer.file, folder))).arrayBuffer());
  const raw = new TextDecoder().decode(Bun.gunzipSync(compressed));
  if (createHash('sha256').update(raw).digest('hex') !== layer.sha256) throw new Error(`Snapshot hash mismatch: ${layer.key}`);
  const data = JSON.parse(raw);
  if (data.type !== 'FeatureCollection' || data.features.length !== layer.features) throw new Error(`Snapshot feature mismatch: ${layer.key}`);
  datasets.set(layer.id, data);
}
let createdLayers = 0, createdMaps = 0;
const existingLayers = await request('layers?select=id,presentation');
const existingMaps = await request('maps?select=id,slug,view_options');
for (const map of manifest.maps) {
  const collision = existingMaps.find(row => row.slug === map.slug && row.view_options?.snapshotId !== map.id);
  if (collision) throw new Error('Map slug already belongs to unrelated content: ' + map.slug);
}
for (const layer of manifest.layers) {
  const existing = existingLayers.find(row => row.presentation?.snapshotId === layer.id);
  if (existing) { layer.importedId = existing.id; continue; }
  layer.importedId = await request('rpc/save_postgis_layer', {
    p_layer: { name: layer.name, description: layer.description, visibility: 'public', style: layer.style, presentation: { ...layer.presentation, snapshotId: layer.id } },
    p_geojson: datasets.get(layer.id),
  });
  createdLayers++;
}
for (const map of manifest.maps) {
  if (existingMaps.some(row => row.view_options?.snapshotId === map.id)) continue;
  // Polygons below routes below points, independent of network completion order.
  const rank = layer => ['transit-routes'].includes(layer.key) ? 1 : ['Point', 'MultiPoint'].includes(datasets.get(layer.id).features[0]?.geometry?.type) ? 2 : 0;
  const ordered = [...manifest.layers].sort((a, b) => rank(a) - rank(b));
  await request('rpc/save_map', { p_map: { id: null, name: map.name, slug: map.slug, description: map.description, base_map: 'osm', visibility: 'public', view_options: { ...map.view_options, snapshotId: map.id } }, p_layers: ordered.map(layer => ({ layer_id: layer.importedId, visible_by_default: map.layers.includes(layer.key) })) });
  createdMaps++;
}
console.log(`Imported ${createdMaps} maps and ${createdLayers} layers from ${manifest.captured}. Snapshots contain ${manifest.layers.reduce((n, layer) => n + layer.features, 0)} features.`);

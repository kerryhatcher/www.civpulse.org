import type { SupabaseClient } from '@supabase/supabase-js';
import type { LayerConfig } from './layers';
import { MAP_COLUMNS, type MapConfig } from './maps';
import { getBuildSupabase } from './supabase-build';

export interface PublicMapManifest { layers: LayerConfig[]; requiresAccessCheck: boolean }
interface StaticAsset { path: string; body: string }

async function asset(kind: string, id: string, value: unknown): Promise<StaticAsset> {
  const body = JSON.stringify(value);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { path: `${kind}/${id}-${hash}.json`, body };
}

/** One bounded, anon-only export per build, shared by every public map route. */
export async function loadMapBuildData(client: SupabaseClient) {
  const maps: MapConfig[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('maps').select(MAP_COLUMNS)
      .eq('visibility', 'public').order('id').range(offset, offset + 499);
    if (error) throw new Error(`Map snapshot failed: ${error.message}`);
    const page = (data ?? []) as unknown as MapConfig[];
    maps.push(...page.filter(map => map.visibility === 'public'));
    if (page.length < 500) break;
  }
  maps.sort((a, b) => a.name.localeCompare(b.name));
  const assets: StaticAsset[] = [];
  const geometry = new Map<string, string>();
  for (const map of maps) {
    const { data, error } = await client.rpc('get_map_layers', { p_map_id: map.id });
    if (error) throw new Error(`Map layers snapshot failed (${map.id}): ${error.message}`);
    const readable = (data ?? []) as LayerConfig[];
    const layers: LayerConfig[] = [];
    for (const layer of readable.filter(layer => layer.visibility === 'public')) {
      if (!geometry.has(layer.id)) {
        // Public external GeoJSON sources already use static HTTP files. Keep their
        // URLs; stored PostGIS geometry is the part that needs a build export.
        if (layer.source_type !== 'postgis') continue;
        const features: GeoJSON.Feature[] = [];
        let total: number | undefined;
        let pageSize = 10;
        for (let offset = 0; total === undefined || offset < total;) {
          const { data: page, error } = await client.rpc('get_layer_geojson_page', {
            p_layer_id: layer.id, p_map_id: map.id, p_offset: offset, p_limit: pageSize,
          });
          if (error) throw new Error(`Map geometry snapshot failed (${layer.id}): ${error.message}`);
          const collection = page as GeoJSON.FeatureCollection & { numberMatched: number };
          if (!collection || !Array.isArray(collection.features) || !Number.isInteger(collection.numberMatched)
            || collection.numberMatched < 0 || (total !== undefined && collection.numberMatched !== total)) {
            throw new Error(`Map geometry changed or returned invalid data (${layer.id}); retry the build.`);
          }
          total = collection.numberMatched;
          features.push(...collection.features);
          if (features.length > total || (!collection.features.length && offset < total)) {
            throw new Error(`Incomplete map geometry snapshot (${layer.id})`);
          }
          offset += collection.features.length;
          pageSize = JSON.stringify(collection.features).length <= 100_000 ? 100 : 10;
        }
        const file = await asset('layers', layer.id, { type: 'FeatureCollection', features });
        assets.push(file);
        geometry.set(layer.id, `/map-data/${file.path}`);
      }
      layers.push({ ...layer, source_type: 'geojson', source_url: geometry.get(layer.id)! });
    }
    // External sources need no RPC conversion, but still must be explicitly public.
    layers.push(...readable.filter(layer => layer.visibility === 'public' && layer.source_type !== 'postgis'));
    layers.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const file = await asset('maps', map.id, {
      layers, requiresAccessCheck: readable.some(layer => layer.visibility !== 'public'),
    } satisfies PublicMapManifest);
    assets.push(file);
    map.public_layers_url = `/map-data/${file.path}`;
  }
  return { maps, assets };
}

let snapshot: ReturnType<typeof loadMapBuildData> | undefined;
let refreshAfter = 0;
export function getMapBuildData() {
  const client = getBuildSupabase();
  if (!client) return Promise.resolve({ maps: [] as MapConfig[], assets: [] as StaticAsset[] });
  if (import.meta.env.DEV && Date.now() >= refreshAfter) {
    snapshot = undefined;
    refreshAfter = Date.now() + 30_000;
  }
  return snapshot ??= loadMapBuildData(client);
}

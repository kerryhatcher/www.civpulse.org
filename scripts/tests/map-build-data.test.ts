import { expect, test } from 'bun:test';
import { loadMapBuildData } from '../../apps/web/src/lib/map-build-data';

type Client = Parameters<typeof loadMapBuildData>[0];
function fixture(failure?: 'maps' | 'layers' | 'geometry' | 'truncated') {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const client = {
    from() {
      const q = { select: () => q, eq: () => q, order: () => q,
        range: async () => ({ data: [
          { id: 'map-a', name: 'A', visibility: 'public' },
          { id: 'map-b', name: 'B', visibility: 'public' },
          { id: 'SECRET-MAP', name: 'SECRET-MAP', visibility: 'unlisted' },
        ], error: failure === 'maps' ? { message: 'maps failed' } : null }),
      };
      return q;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === 'get_map_layers') return { data: [
        { id: 'shared', name: 'Public', visibility: 'public', source_type: 'postgis', position: 1, style: { color: args.p_map_id } },
        { id: 'SECRET-LAYER', name: 'SECRET-LAYER', visibility: 'unlisted', source_type: 'postgis' },
        { id: 'PRIVATE-LAYER', name: 'PRIVATE-LAYER', visibility: 'private', source_type: 'postgis' },
        { id: 'external', name: 'External', visibility: 'public', source_type: 'geojson', source_url: 'https://example.org/public.json', position: 0 },
      ], error: failure === 'layers' ? { message: 'layers failed' } : null };
      const offset = args.p_offset as number, limit = args.p_limit as number;
      return { data: { type: 'FeatureCollection', numberMatched: 211,
        features: failure === 'truncated' && offset ? [] : Array.from({ length: Math.min(limit, 211 - offset) }, (_, i) => ({
          type: 'Feature', id: i + offset, geometry: { type: 'Point', coordinates: [-83, 32] }, properties: { name: `Point ${i + offset}` },
        })),
      }, error: failure === 'geometry' ? { message: 'geometry failed' } : null };
    },
  } as unknown as Client;
  return { client, calls };
}

const readExternal = async () => ({ type: 'FeatureCollection', features: [] });
test('exports only public records, deduplicates paginated geometry, and captures external sources once', async () => {
  const { client, calls } = fixture();
  let externalReads = 0;
  const { maps, assets, evidence } = await loadMapBuildData(client, async () => { externalReads++; return readExternal(); });
  expect(maps).toHaveLength(2);
  expect(assets).toHaveLength(4);
  expect(externalReads).toBe(1);
  expect(JSON.stringify({ maps, assets })).not.toMatch(/SECRET|PRIVATE/);
  const manifests = assets.filter(a => a.path.startsWith('maps/')).map(a => JSON.parse(a.body));
  expect(manifests.map(m => m.requiresAccessCheck)).toEqual([true, true]);
  expect(manifests[0].layers[0].source_url).toStartWith('/map-data/layers/external-');
  expect(manifests[0].layers[0].presentation.sourceUrl).toBe('https://example.org/public.json');
  expect(manifests[0].layers[1].source_url).toBe(manifests[1].layers[1].source_url);
  expect(manifests.map(m => m.layers[1].style.color)).toEqual(['map-a', 'map-b']);
  const geometry = JSON.parse(assets.find(a => a.path.startsWith('layers/shared-'))!.body);
  expect(geometry.features.map((f: { id: number }) => f.id)).toEqual(Array.from({ length: 211 }, (_, i) => i));
  expect(calls.filter(c => c.name === 'get_layer_geojson_page').map(c => c.args?.p_offset)).toEqual([0, 10, 110, 210]);
  expect(calls.some(c => c.args?.p_layer_id !== 'shared' && c.name === 'get_layer_geojson_page')).toBe(false);
  expect(evidence.get('map-a')![1].rows.map(row => row.title)).toEqual(geometry.features.map((f: GeoJSON.Feature) => f.properties?.name));
  expect((await loadMapBuildData(fixture().client, readExternal)).assets).toEqual(assets);
});

for (const failure of ['maps', 'layers', 'geometry', 'truncated'] as const) {
  test(`fails the snapshot on ${failure} instead of publishing partial data`, async () => {
    await expect(loadMapBuildData(fixture(failure).client, readExternal)).rejects.toThrow();
  });
}

test('external source failure or malformed data stops publication', async () => {
  await expect(loadMapBuildData(fixture().client, async () => { throw Error('offline'); })).rejects.toThrow('offline');
  await expect(loadMapBuildData(fixture().client, async () => ({ type: 'GeometryCollection', geometries: [] }))).rejects.toThrow('Invalid public GeoJSON');
});

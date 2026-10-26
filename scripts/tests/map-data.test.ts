import { expect, test } from 'bun:test';
import { fetchMapLayers } from '../../apps/web/src/lib/map-data';
import type { MapConfig } from '../../apps/web/src/lib/maps';

test('public anonymous maps and previews use static data; live access gates control restricted and signed-in views', async () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0, rpcs = 0, signedIn = false, restricted = false;
  const published = { id: 'layer', visibility: 'public', source_type: 'geojson', source_url: '/map-data/layers/public.json' };
  globalThis.fetch = (async () => {
    fetches++;
    return Response.json({ layers: [published], requiresAccessCheck: restricted });
  }) as typeof fetch;
  const config = { id: 'map', visibility: 'public', public_layers_url: '/map-data/maps/public.json' } as MapConfig;
  let live = { id: 'layer', visibility: 'public', source_type: 'postgis', source_url: null };
  const client = {
    auth: { getSession: async () => ({ data: { session: signedIn ? {} : null } }) },
    rpc: async () => { rpcs++; return { data: [live], error: null }; },
  } as unknown as NonNullable<Parameters<typeof fetchMapLayers>[2]>;
  try {
    expect(await fetchMapLayers(config, false, client)).toEqual([published]);
    expect(rpcs).toBe(0);
    signedIn = true;
    expect((await fetchMapLayers(config, false, client))[0].source_url).toBe(published.source_url);
    expect(rpcs).toBe(1);
    live = { ...live, visibility: 'private' };
    expect((await fetchMapLayers(config, false, client))[0].source_type).toBe('postgis');
    expect(rpcs).toBe(2);
    const before = fetches;
    for (const visibility of ['private', 'unlisted'] as const) {
      expect(await fetchMapLayers({ ...config, visibility }, false, client)).toEqual([live]);
    }
    expect(fetches).toBe(before);
    expect(rpcs).toBe(4);
    signedIn = false; restricted = true;
    await fetchMapLayers(config, false, client);
    expect(rpcs).toBe(5);
    expect(await fetchMapLayers(config, true, client)).toEqual([published]);
    expect(rpcs).toBe(5);
    globalThis.fetch = (async () => new Response('missing', { status: 404 })) as typeof fetch;
    await expect(fetchMapLayers(config, false, client)).rejects.toThrow('HTTP 404');
    expect(rpcs).toBe(5);
  } finally { globalThis.fetch = originalFetch; }
});

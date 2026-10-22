import { beforeEach, describe, expect, mock, test } from 'bun:test';

const datasets = new Map<string, GeoJSON.Feature[]>();
const requests: { id: string; offset: number; limit: number }[] = [];
let active = 0, maximumActive = 0;
let failCode: string | null = null;
mock.module('../../apps/web/src/lib/supabase', () => ({
  getSupabase: () => ({ rpc: async (_name: string, args: Record<string, any>) => {
    active++; maximumActive = Math.max(active, maximumActive);
    try {
      await new Promise(resolve => setTimeout(resolve, 1));
      requests.push({id:args.p_layer_id,offset:args.p_offset,limit:args.p_limit});
      if (failCode) { const code = failCode; failCode = null; return {data:null,error:{code,message:'Request failed'}}; }
      const features = datasets.get(args.p_layer_id)!;
      return {data:{type:'FeatureCollection',numberMatched:features.length,
        features:features.slice(args.p_offset,args.p_offset+args.p_limit)},error:null};
    } finally { active--; }
  } }),
}));
const { fetchLayerGeoJSON } = await import('../../apps/web/src/lib/layers');
const makeFeatures = (count: number, dense = false): GeoJSON.Feature[] => Array.from({length:count}, (_,id) => ({
  type:'Feature',id,properties:{name:`Place ${id}`,...(dense?{detail:'x'.repeat(12_000)}:{})},
  geometry:{type:'Point',coordinates:[-83,32]},
}));
const load = (id: string) => fetchLayerGeoJSON({id,source_type:'postgis'} as Parameters<typeof fetchLayerGeoJSON>[0], 'map');
beforeEach(() => { datasets.clear(); requests.length = 0; maximumActive = 0; failCode = null; });
describe('hosted geometry loading', () => {
  test('compact and dense pages preserve every feature in source order', async () => {
    for (const dense of [false,true]) {
      const id = String(dense); const features = makeFeatures(121,dense); datasets.set(id,features);
      const result = await load(id) as GeoJSON.FeatureCollection;
      expect(result.features).toEqual(features);
      expect(new Set(result.features.map(f=>f.id)).size).toBe(121);
      expect(requests.filter(r=>r.id===id).map(r=>r.limit)).toEqual(dense ? Array(13).fill(10) : [10,100,100]);
    }
  });
  test('simultaneous previews share a two-request budget', async () => {
    const ids = Array.from({length:8},(_,i)=>String(i));
    ids.forEach(id=>datasets.set(id,makeFeatures(201)));
    const results = await Promise.all(ids.map(load));
    expect(maximumActive).toBe(2);
    expect(results.every(r=>(r as GeoJSON.FeatureCollection).features.length===201)).toBe(true);
  });
  test('a query timeout retries; an access denial fails immediately', async () => {
    datasets.set('test',makeFeatures(8)); failCode = '57014';
    expect((await load('test') as GeoJSON.FeatureCollection).features.length).toBe(8);
    expect(requests.length).toBe(2);
    failCode = '42501';
    await expect(load('test')).rejects.toThrow('Request failed');
    expect(requests.length).toBe(3);
  });
});

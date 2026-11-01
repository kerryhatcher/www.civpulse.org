import { expect, test } from 'bun:test';
import { fetchMapLayers } from '../../apps/web/src/lib/map-data';
import type { MapConfig } from '../../apps/web/src/lib/maps';
import type { LayerConfig } from '../../apps/web/src/lib/layers';

test('authorized snapshot layers retain published metadata without restoring omitted or restricted rows', async () => {
  const originalFetch=globalThis.fetch;
  const published:LayerConfig={id:'layer',visibility:'public',source_type:'geojson',source_url:'/map-data/layers/published.json',
    name:'Published district',description:'Published description',presentation:{titleProperty:'name',attribution:'Published source',note:'Published note'},
    style:{color:'#112233'},position:2,visible_by_default:true};
  const edited:LayerConfig={...published,source_type:'postgis',source_url:null,name:'Edited district',description:'Edited description',
    presentation:{titleProperty:'new_name',attribution:'Edited source',note:'Edited note'},style:{color:'#445566'},position:9,visible_by_default:false};
  const config={id:'map',visibility:'public',public_layers_url:'/map-data/maps/published.json'} as MapConfig;
  let signedIn=false,live:LayerConfig[]=[edited],error:null|{message:string}=null,rpcs=0;
  const client={auth:{getSession:async()=>({data:{session:signedIn?{}:null}})},
    rpc:async()=>{rpcs++;return {data:live,error};}} as unknown as NonNullable<Parameters<typeof fetchMapLayers>[2]>;
  globalThis.fetch=(async()=>Response.json({requiresAccessCheck:true,layers:[published,{...published,id:'omitted'}]})) as typeof fetch;
  try{
    for(const session of [false,true]){
      signedIn=session;
      expect(await fetchMapLayers(config,false,client)).toEqual([published]);
      expect(live).toEqual([edited]);
      for(const visibility of ['private','unlisted'] as const){
        live=[{...edited,visibility}];
        expect(await fetchMapLayers(config,false,client)).toEqual(live);
      }
      live=[];expect(await fetchMapLayers(config,false,client)).toEqual([]);
      live=[{...edited,id:'new-public'}];expect(await fetchMapLayers(config,false,client)).toEqual(live);
      live=[edited];
    }
    expect(rpcs).toBe(10);
    error={message:'access failed'};
    await expect(fetchMapLayers(config,false,client)).rejects.toThrow('access failed');
  }finally{globalThis.fetch=originalFetch;}
});

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

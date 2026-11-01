import {expect,test} from 'bun:test';
import {MAX_MAP_SOURCE_BYTES,readPublicGeoJSON} from '../../apps/web/src/lib/map-build-source';

test('public source reader resolves protocol-relative HTTPS and bounds streamed bytes before parsing',async()=>{
  const original=globalThis.fetch;let requested='',cancelled=false;
  try{
    globalThis.fetch=(async(input)=>{requested=String(input);return Response.json({type:'FeatureCollection',features:[]});}) as typeof fetch;
    expect(await readPublicGeoJSON('//source.test/data.json')).toEqual({type:'FeatureCollection',features:[]});
    expect(requested).toBe('https://source.test/data.json');
    await expect(readPublicGeoJSON('/\\attacker.test/data.json')).rejects.toThrow('Invalid local map source');
    globalThis.fetch=(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_MAP_SOURCE_BYTES));controller.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}}))) as typeof fetch;
    await expect(readPublicGeoJSON('https://source.test/large.json')).rejects.toThrow('10 MB');expect(cancelled).toBe(true);
    globalThis.fetch=(async()=>new Response(null)) as typeof fetch;
    await expect(readPublicGeoJSON('https://source.test/empty.json')).rejects.toThrow('no data');
    globalThis.fetch=(async()=>new Response('bad json')) as typeof fetch;
    await expect(readPublicGeoJSON('https://source.test/bad.json')).rejects.toThrow();
  }finally{globalThis.fetch=original;}
});

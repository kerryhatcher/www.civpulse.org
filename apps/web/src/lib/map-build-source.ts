import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
export const MAX_MAP_SOURCE_BYTES=10*1024*1024;

/** Capture external public data once, rather than letting HTML and Leaflet read
 * different revisions. Local URLs resolve only inside Astro's public directory. */
export async function readPublicGeoJSON(source: string): Promise<unknown> {
  if (/^\/(?!\/)/.test(source)) {
    if(new URL(source,'https://www.civpulse.org').origin!=='https://www.civpulse.org')throw new Error('Invalid local map source');
    const root = resolve(process.cwd(), 'public');
    const path = resolve(root, `.${decodeURIComponent(new URL(source, 'https://www.civpulse.org').pathname)}`);
    if (!path.startsWith(root + sep)) throw new Error('Invalid local map source');
    return JSON.parse(await readFile(path, 'utf8'));
  }
  const url = new URL(source.startsWith('//') ? `https:${source}` : source);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Map source must use HTTP(S)');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Map source failed: HTTP ${response.status}`);
  const reader=response.body?.getReader();
  if(!reader)throw new Error('Map source returned no data');
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>MAX_MAP_SOURCE_BYTES){await reader.cancel();throw new Error('Map source exceeds 10 MB limit');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  return JSON.parse(await new Blob(chunks as BlobPart[]).text());
}


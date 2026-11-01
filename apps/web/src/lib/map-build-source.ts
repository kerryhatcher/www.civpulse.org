import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/** Capture external public data once, rather than letting HTML and Leaflet read
 * different revisions. Local URLs resolve only inside Astro's public directory. */
export async function readPublicGeoJSON(source: string): Promise<unknown> {
  if (/^\/(?!\/)/.test(source)) {
    const root = resolve(process.cwd(), 'public');
    const path = resolve(root, `.${decodeURIComponent(new URL(source, 'https://www.civpulse.org').pathname)}`);
    if (!path.startsWith(root + sep)) throw new Error('Invalid local map source');
    return JSON.parse(await readFile(path, 'utf8'));
  }
  const url = new URL(source);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Map source must use HTTP(S)');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Map source failed: HTTP ${response.status}`);
  return response.json();
}


import type { SupabaseClient } from '@supabase/supabase-js';
import type { LegislativeRow } from '../lib/legislation';
import { browseStaticBills, type BillOptions, type LegislationDirectory } from '../lib/legislation-directory';

const cache = new Map<string,Promise<unknown>>();
async function asset(url: string): Promise<unknown> {
  if (!/^\/directory-data\/legislation\/[a-z0-9-]+\.json$/.test(url)) throw new Error('Invalid legislation directory URL');
  let request = cache.get(url);
  if (!request) {
    request = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Published legislation unavailable (${response.status}). Reload to try again.`);
      return response.json();
    })();
    cache.set(url,request);
    request.catch(() => {if (cache.get(url) === request) cache.delete(url);});
  }
  return request;
}
export async function readLegislationDirectory(url: string | undefined, client: SupabaseClient): Promise<LegislationDirectory | null> {
  const {data:{session},error} = await client.auth.getSession();
  if (error) throw error;
  if (session) return null;
  if (!url) throw new Error('Missing published legislation directory');
  const data = await asset(url) as LegislationDirectory;
  if (data?.version !== 1 || !Array.isArray(data.terms) || !Array.isArray(data.sessions) || !Array.isArray(data.bills) || !Array.isArray(data.initial?.rows)) throw new Error('Invalid legislation directory');
  return data;
}
export async function readStaticBills(directory: LegislationDirectory, options: BillOptions) {
  if (!(options.query || options.term || options.jurisdiction || options.state || options.offset || options.sort && options.sort !== 'newest')) return directory.initial;
  const terms = new Set(directory.terms.filter(term => (!options.term || term.id === options.term) && (!options.jurisdiction || term.jurisdiction === options.jurisdiction) && (!options.state || term.jurisdiction === 'state' && term.state_name === options.state)).map(term => term.id));
  const selected = directory.bills.filter(shard => terms.has(shard.term));
  const chunks: LegislativeRow[][] = [];
  let next = 0;
  // Bound downloads when searching all terms, rather than opening dozens at once.
  await Promise.all(Array.from({length:Math.min(3,selected.length)},async () => {
    while (next < selected.length) {
      const index = next++, shard = selected[index];
      const rows = await asset(shard.url) as LegislativeRow[];
      if (!Array.isArray(rows) || rows.length !== shard.count || rows.some(row => row.visibility !== 'public' || row.term_id !== shard.term)) throw new Error('Invalid legislation term snapshot');
      chunks[index] = rows;
    }
  }));
  return browseStaticBills(chunks.flat(),options);
}

import { getBuildSupabase } from './supabase-build';
import { readPublicLegislationTable } from './legislation-build-data';
import { browseStaticBills, directoryRow, type LegislationDirectory } from './legislation-directory';

export async function loadLegislationDirectoryAssets() {
  const client = getBuildSupabase();
  const [terms,sessions,bills] = client ? await Promise.all(['legislative_terms','legislative_sessions','bills'].map(table => readPublicLegislationTable(client,table))) : [[],[],[]];
  const termMap = new Map(terms.map(term => [term.id,term]));
  const publicBills = bills.map(row => {
    const term = termMap.get(String(row.term_id));
    if (!term) throw new Error('Missing public legislative term');
    return directoryRow({...row,links:{...row.links,record:`/records/bills/${row.id}/`},jurisdiction:term.jurisdiction,state_name:term.state_name});
  });
  const assets: {path:string;body:string}[] = [];
  async function add(key:string,value:unknown) {
    const body = JSON.stringify(value);
    if (new TextEncoder().encode(body).length > 20 * 1024 * 1024) throw new Error('Legislation directory asset exceeds safe static size');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))),b => b.toString(16).padStart(2,'0')).join('');
    const path = `legislation/${key}-${hash}.json`;
    assets.push({path,body});
    return `/directory-data/${path}`;
  }
  const shards: LegislationDirectory['bills'] = [];
  // Scope downloads to a selected term; initial browsing needs only 25 cards.
  for (const term of terms) {
    const rows = publicBills.filter(row => row.term_id === term.id);
    for (let offset=0;offset<rows.length;offset+=500) {
      const page=rows.slice(offset,offset+500);
      shards.push({term:term.id,count:page.length,url:await add(`${term.id}-${offset}`,page)});
    }
  }
  const manifest: LegislationDirectory = {version:1,terms:terms.map(directoryRow),sessions:sessions.map(row=>directoryRow({...row,links:{...row.links,record:`/records/sessions/${row.id}/`}})),initial:browseStaticBills(publicBills),bills:shards};
  const url = await add('manifest',manifest);
  return {assets,url};
}
let snapshot: ReturnType<typeof loadLegislationDirectoryAssets> | undefined;
let refreshAfter = 0;
export function getLegislationDirectoryAssets() {
  if (import.meta.env.DEV && Date.now() >= refreshAfter) {snapshot=undefined;refreshAfter=Date.now()+30_000;}
  return snapshot ??= loadLegislationDirectoryAssets();
}

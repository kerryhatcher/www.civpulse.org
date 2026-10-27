import type {SupabaseClient} from '@supabase/supabase-js';
import type {LegislativeRow} from './legislation';
import {readPublicLegislationTable} from './legislation-build-data';
import {assembleLegislationDetails,detailChildren,detailTables} from './legislation-details';
import {getBuildSupabase} from './supabase-build';

export async function loadPublicLegislationDetails(client:SupabaseClient) {
  const tables=[...new Set([...detailTables,...Object.values(detailChildren).flat()])].filter(table=>table!=='legislative_event_links');
  const rows=await Promise.all(tables.map(table=>readPublicLegislationTable(client,table)));
  // Event links are not in the 500-row export allowlist. Keep the existing
  // anonymous discovery RPC with no direct-ID/session/bill/vote context.
  const links:LegislativeRow[]=[], seen=new Set<string>();let total:number|undefined;
  for(let offset=0;;offset+=100) {
    const {data,error}=await client.rpc('browse_legislation',{p_table:'legislative_event_links',p_offset:offset,p_limit:100});
    if(error)throw new Error(`Public legislative calendar links failed: ${error.message}`);
    if(!data || !Array.isArray(data.rows) || !Number.isSafeInteger(data.total) || data.total<0 || data.total>100000 || total!==undefined && total!==data.total || data.rows.length!==Math.min(100,data.total-offset))throw new Error('Incomplete legislative calendar link export');
    total=data.total;
    for(const row of data.rows) {
      if(row.visibility!=='public' || typeof row.id!=='string' || !/^[0-9a-f-]{36}$/i.test(row.id) || seen.has(row.id))throw new Error('Invalid public legislative calendar link');
      links.push(row);seen.add(row.id);
    }
    if(links.length===total)break;
  }
  return assembleLegislationDetails(new Map([...tables.map((table,index)=>[table,rows[index]] as const),['legislative_event_links',links]]));
}
let snapshot:ReturnType<typeof loadPublicLegislationDetails>|undefined;
let refreshAfter=0;
export function getPublicLegislationDetails() {
  const client=getBuildSupabase();if(!client)return Promise.resolve(new Map());
  if(import.meta.env.DEV && Date.now()>=refreshAfter){snapshot=undefined;refreshAfter=Date.now()+30000;}
  return snapshot??=loadPublicLegislationDetails(client);
}

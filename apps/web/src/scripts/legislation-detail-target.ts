import type {SupabaseClient} from '@supabase/supabase-js';
import {detailTables,detailKind,type DetailTable} from '../lib/legislation-details';
import {recordHref} from '../lib/public-records';
const indexes=new Map<string,Promise<Set<string>>>();
/** Only published IDs redirect. Missing assets fail closed; unknown IDs continue
 * to the existing direct reader, whose RPC enforces unlisted/private access. */
export async function publicLegislationTarget(client:SupabaseClient,url:string|undefined,table:DetailTable,id:string,live=false):Promise<string|null> {
  const {data:{session},error}=await client.auth.getSession();if(error)throw error;
  if(session||live)return null;
  if(!detailTables.includes(table)||!url?.startsWith(`/directory-data/legislation/details-index-${table}-`)||!/^\/directory-data\/legislation\/details-index-[a-z_-]+-[a-f0-9]{64}\.json$/.test(url))throw new Error('Missing public legislation index');
  let request=indexes.get(url);
  if(!request) {
    request=(async()=>{
      const response=await fetch(url);if(!response.ok)throw new Error('Published legislation index unavailable. Reload to try again.');
      const ids=await response.json();
      if(!Array.isArray(ids)||ids.some(value=>typeof value!=='string'||!/^[a-f0-9-]{36}$/i.test(value)))throw new Error('Invalid public legislation index');
      return new Set<string>(ids);
    })();
    indexes.set(url,request);request.catch(()=>{if(indexes.get(url)===request)indexes.delete(url);});
  }
  return (await request).has(id.toLowerCase())?recordHref(detailKind(table),id.toLowerCase()):null;
}

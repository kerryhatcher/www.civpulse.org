import type {SupabaseClient} from '@supabase/supabase-js';
import type {RequestDetail} from './records-requests';
import {publicRequestDetail,type PublicRequestDetail} from './request-snapshot';
import {getBuildSupabase} from './supabase-build';
const reads=new WeakMap<SupabaseClient,{promise:Promise<PublicRequestDetail[]>;expires:number}>();
export function readPublicRequests(client:SupabaseClient) {
 const cached=reads.get(client);if(cached&&!(import.meta.env?.DEV&&Date.now()>=cached.expires))return cached.promise;
 const promise=loadPublicRequests(client);reads.set(client,{promise,expires:Date.now()+30000});
 promise.catch(()=>{if(reads.get(client)?.promise===promise)reads.delete(client);});return promise;
}
export async function loadPublicRequests(client:SupabaseClient):Promise<PublicRequestDetail[]> {
 const discovered:{id:string;visibility:string;updated_at:string}[]=[],seen=new Set<string>();
 for(let offset=0;;offset+=25) {
  const {data,error}=await client.rpc('search_records_requests',{p_managed:false,p_offset:offset});
  if(error)throw new Error(`Public request discovery failed: ${error.message}`);
  if(!Array.isArray(data)||data.length>25||offset>100000)throw new Error('Invalid public request discovery');
  for(const row of data) {
   if(row.visibility!=='public'||typeof row.id!=='string'||!/^[a-f0-9-]{36}$/i.test(row.id)||seen.has(row.id))throw new Error('Non-public or repeated request discovery');
   discovered.push(row);seen.add(row.id);
  }
  if(data.length<25)break;
 }
 const details:PublicRequestDetail[]=[];let next=0;
 await Promise.all(Array.from({length:Math.min(3,discovered.length)},async()=>{
  while(next<discovered.length) {
   const index=next++,r=discovered[index];
   const {data,error}=await client.rpc('get_records_request',{p_id:r.id});
   if(error)throw new Error(`Public request detail failed: ${error.message}`);
   if(!data||data.request?.id!==r.id||new Date(data.request.updated_at).getTime()!==new Date(r.updated_at).getTime())throw new Error('Public request changed during export');
   details[index]=publicRequestDetail(data as RequestDetail);
  }
 }));
 return details;
}
export function getPublicRequests() {const client=getBuildSupabase();return client?readPublicRequests(client):Promise.resolve([]);}

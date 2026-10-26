import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventRecord } from './calendars';
import type { CalendarManifest, PublicEventSnapshot } from './calendar-snapshot';

const cache=new Map<string,Promise<unknown>>();
export async function readCalendarAsset<T>(url:string):Promise<T> {
  let request=cache.get(url);
  if(!request) {
    request=(async()=>{
      const response=await fetch(url);
      if(!response.ok) throw new Error(`Published calendar unavailable (HTTP ${response.status}). Reload to try again.`);
      return response.json();
    })();
    cache.set(url,request);
    request.catch(()=>{if(cache.get(url)===request) cache.delete(url);});
  }
  return request as Promise<T>;
}
export async function readPublicCalendar(url:string,client:SupabaseClient):Promise<CalendarManifest|null> {
  const {data:{session},error}=await client.auth.getSession();
  if(error) throw error;
  return session ? null : readCalendarAsset<CalendarManifest>(url);
}
export async function readCalendarMonth(manifest:CalendarManifest,month:string):Promise<EventRecord[]> {
  const url=manifest.months[month];
  return url ? readCalendarAsset<EventRecord[]>(url) : [];
}
/** A public entry with a failed asset is an error, never a live RPC fallback.
 * IDs outside the public index retain their existing gated UUID reader. */
export async function readPublicEvent(id:string,urls:{event?:string;index?:string},client:SupabaseClient):Promise<PublicEventSnapshot|null> {
  const {data:{session},error}=await client.auth.getSession();
  if(error) throw error;
  if(session) return null;
  let url=urls.event;
  if(!url && urls.index) { const index=await readCalendarAsset<Record<string,string>>(urls.index); if(Object.hasOwn(index,id)) url=index[id]; }
  if(!url) return null;
  const records=await readCalendarAsset<Record<string,PublicEventSnapshot>>(url);
  const snapshot=Object.hasOwn(records,id) ? records[id] : undefined;
  if(!snapshot || snapshot.detail.event?.id!==id || snapshot.detail.status!=='ok') throw new Error('Invalid published event');
  return snapshot;
}

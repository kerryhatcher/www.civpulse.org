import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarRef, EventRecord } from './calendars';
import type { MeetingRecord } from './meetings';
import { getBuildSupabase } from './supabase-build';
import { fetchPublicPeople } from './people';
import { isPublicEvent, publicEvent, publicMeeting, type PublicCalendarSnapshot } from './calendar-snapshot';

export async function loadPublicCalendarData(client: SupabaseClient, publicPeople: Set<string>): Promise<PublicCalendarSnapshot> {
  const [calendars,pages]=await Promise.all([
    (async()=>{
      const rows:CalendarRef[]=[],seen=new Set<string>();
      for(let offset=0;;offset+=500) {
        const {data,error}=await client.rpc('list_calendars',{p_organization_id:null}).order('id').range(offset,offset+499);
        if(error) throw new Error(`Calendar build failed: ${error.message}`);
        if(!Array.isArray(data)||data.length>500) throw new Error("Invalid calendar build page");
        const page=data as CalendarRef[];
        for(const row of page) {if(seen.has(row.id)) throw new Error("Repeated calendar in build");seen.add(row.id);if(row.visibility==='public')rows.push(row);}
        if(page.length<500) return rows;
      }
    })(),
    (async()=>{
      const rows:{event:EventRecord;meeting:MeetingRecord|null}[]=[],seen=new Set<string>();
      for(let offset=0;;offset+=500) {
        const {data,error}=await client.rpc('export_public_calendar_page',{p_offset:offset});
        if(error) throw new Error(`Calendar event build failed: ${error.message}`);
        if(!Array.isArray(data)||data.length>500) throw new Error("Invalid calendar event build page");
        const page=data as typeof rows;
        for(const row of page) {if(seen.has(row.event.id)) throw new Error("Repeated event in build");seen.add(row.event.id);rows.push(row);}
        if(page.length<500) return rows;
      }
    })(),
  ]);
  calendars.sort((a,b)=>a.organization_name.localeCompare(b.organization_name)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const publicRows=pages.filter(row=>isPublicEvent(row.event));
  const events=publicRows.map(row=>publicEvent(row.event));
  const calendarIds=new Set(calendars.map(calendar=>calendar.id));
  const eventIds=new Set(events.map(event=>event.id));
  if(events.some(event=>!calendarIds.has(event.calendar_id))) throw new Error('Missing public event calendar');
  const meetings=new Map<string,MeetingRecord>();
  for(const row of publicRows) {
    if(!row.meeting) continue;
    if(!eventIds.has(row.event.id) || row.meeting.event?.id!==row.event.id) throw new Error('Meeting export parent does not match public events');
    meetings.set(row.event.id,publicMeeting(row.meeting,publicPeople));
  }
  if(events.some(event=>event.is_meeting && !meetings.has(event.id))) throw new Error('Missing public meeting export');
  return {calendars,events,meetings};
}
let snapshot:Promise<PublicCalendarSnapshot>|undefined;
let refreshAfter=0;
export function getPublicCalendarData():Promise<PublicCalendarSnapshot> {
  const client=getBuildSupabase();
  if(!client) return Promise.resolve({calendars:[],events:[],meetings:new Map()});
  if(import.meta.env.DEV && Date.now()>=refreshAfter) {snapshot=undefined;refreshAfter=Date.now()+30_000;}
  return snapshot??=fetchPublicPeople().then(people=>loadPublicCalendarData(client,new Set(people.map(person=>person.id))));
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarRef, EventRecord } from './calendars';
import type { MeetingRecord } from './meetings';
import { getBuildSupabase } from './supabase-build';
import { fetchPublicPeople } from './people';
import { isPublicEvent, publicEvent, publicMeeting, type PublicCalendarSnapshot } from './calendar-snapshot';

export async function loadPublicCalendarData(client: SupabaseClient, publicPeople: Set<string>): Promise<PublicCalendarSnapshot> {
  const [calendars,pages]=await Promise.all([
    (async()=>{
      const rows:CalendarRef[]=[];
      for(let offset=0;;offset+=500) {
        const {data,error}=await client.rpc('list_calendars',{p_organization_id:null}).order('id').range(offset,offset+499);
        if(error) throw new Error(`Calendar build failed: ${error.message}`);
        const page=(data??[]) as CalendarRef[];rows.push(...page.filter(calendar=>calendar.visibility==='public'));
        if(page.length<500) return rows;
      }
    })(),
    (async()=>{
      const rows:{event:EventRecord;meeting:MeetingRecord|null}[]=[];
      for(let offset=0;;offset+=500) {
        const {data,error}=await client.rpc('export_public_calendar_page',{p_offset:offset});
        if(error) throw new Error(`Calendar event build failed: ${error.message}`);
        const page=(data??[]) as typeof rows;rows.push(...page);
        if(page.length<500) return rows;
      }
    })(),
  ]);
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

import type { CalendarRef, EventRecord } from './calendars';
import type { MeetingRecord } from './meetings';
import { dayBoundary, dayKey, monthWindow, occursOn, shiftDay } from './calendar-display';

export interface EventViewResponse {
  status?: string;
  event?: Pick<EventRecord,'id'|'title'|'description'|'starts_at'|'ends_at'|'all_day'|'location'|'url'> & { is_meeting: boolean };
  calendar?: { id: string; name: string };
  organization?: { id: string; name: string; slug: string };
  election?: { id: string; slug: string; name: string; visibility: string } | null;
}
export interface PublicEventSnapshot { detail: EventViewResponse; meeting?: MeetingRecord }
export interface PublicCalendarSnapshot { calendars: CalendarRef[]; events: EventRecord[]; meetings: Map<string,MeetingRecord> }
export interface CalendarManifest { calendars: CalendarRef[]; months: Record<string,string> }

export function isPublicEvent(event: EventRecord): boolean {
  return event.visibility === 'public' && event.calendar_visibility === 'public'
    && (!event.election_id || event.election_visibility === 'public');
}
/** Explicit projection prevents future database columns from entering static files. */
export function publicEvent(event: EventRecord): EventRecord {
  const {id,is_meeting,title,category,updated_at,description,starts_at,ends_at,all_day,location,url,visibility,
    calendar_id,calendar_name,calendar_slug,calendar_visibility,organization_id,organization_name,organization_slug,
    election_id,election_date_kind,election_name,election_slug,election_visibility} = event;
  return {id,is_meeting,title,category,updated_at,description,starts_at,ends_at,all_day,location,url,visibility,
    calendar_id,calendar_name,calendar_slug,calendar_visibility,organization_id,organization_name,organization_slug,
    election_id,election_date_kind,election_name,election_slug,election_visibility};
}
export function eventResponse(event: EventRecord): EventViewResponse {
  const {id,title,description,starts_at,ends_at,all_day,location,url} = event;
  return {status:'ok',event:{id,title,description,starts_at,ends_at,all_day,location,url,is_meeting:!!event.is_meeting},
    calendar:{id:event.calendar_id,name:event.calendar_name},
    organization:{id:event.organization_id,name:event.organization_name,slug:event.organization_slug},
    election:event.election_id ? {id:event.election_id,name:event.election_name!,slug:event.election_slug!,visibility:'public'} : null};
}
export function publicMeeting(meeting: MeetingRecord, publicPeople: Set<string>): MeetingRecord {
  const event = meeting.event;
  if (meeting.status !== 'ok' || !event) throw new Error('Missing public meeting record');
  return {status:'ok',event:{id:event.id,title:event.title,meeting_notes:event.meeting_notes,
    meeting_transcript:event.meeting_transcript,meeting_video_url:event.meeting_video_url,
    meeting_video_start_seconds:event.meeting_video_start_seconds},
    attendance:(meeting.attendance??[]).filter(person=>publicPeople.has(person.person_id)).map(({person_id,full_name,slug,status,note})=>({person_id,full_name,slug,status,note})),
    votes:(meeting.votes??[]).map(({id,subject,description,outcome,choices})=>({id,subject,description,outcome,choices:choices.filter(person=>publicPeople.has(person.person_id)).map(({person_id,full_name,choice})=>({person_id,full_name,choice}))})),
    attachments:(meeting.attachments??[]).map(({id,file_name,storage_path,mime_type,size_bytes})=>({id,file_name,storage_path,mime_type,size_bytes}))};
}
export function eventsForMonth(events: EventRecord[], month: string): EventRecord[] {
  const range=monthWindow(month);
  return events.filter(event=>Array.from({length:range.days},(_,index)=>shiftDay(range.start,index)).some(day=>occursOn(event,day)));
}
/** A spanning event is included in each occupied month; midnight ends are exclusive. */
export function calendarMonths(events: EventRecord[]): Map<string,EventRecord[]> {
  const months=new Map<string,EventRecord[]>();
  for (const event of events) {
    const start=Date.parse(event.starts_at);
    const end=Math.max(start,event.ends_at ? Date.parse(event.ends_at)-1 : start);
    const last=dayKey(new Date(end)).slice(0,7);
    let month=dayKey(event.starts_at).slice(0,7);
    while (month<=last) {
      const rows=months.get(month)??[]; rows.push(event); months.set(month,rows);
      month=monthWindow(month).end.slice(0,7);
    }
  }
  return months;
}
export function upcomingEvents(events: EventRecord[], today=dayKey(new Date()), limit=4): EventRecord[] {
  return events.filter(event=>Date.parse(event.starts_at)>=Date.parse(dayBoundary(today)))
    .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id)).slice(0,limit);
}

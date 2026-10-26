import {expect,test} from 'bun:test';
import {calendarMonths,eventsForMonth,isPublicEvent,publicEvent,publicMeeting,upcomingEvents} from '../../apps/web/src/lib/calendar-snapshot';
import {loadPublicCalendarData} from '../../apps/web/src/lib/calendar-build-data';
import {buildCalendarAssets} from '../../apps/web/src/lib/calendar-assets';
import {readPublicCalendar,readCalendarMonth,readPublicEvent,readCalendarAsset} from '../../apps/web/src/lib/calendar-data';
import type {CalendarRef,EventRecord} from '../../apps/web/src/lib/calendars';
import type {MeetingRecord} from '../../apps/web/src/lib/meetings';

const event=(id='event'):EventRecord=>({id,title:'Community meeting',description:'Public description',starts_at:'2026-10-31T22:00:00Z',ends_at:'2026-11-02T05:00:00Z',all_day:true,location:'Library',url:null,visibility:'public',calendar_id:'calendar',calendar_name:'Community',calendar_slug:'community',calendar_visibility:'public',organization_id:'org',organization_name:'Library',organization_slug:'library',election_id:null,election_date_kind:null,election_name:null,election_slug:null,election_visibility:null});
const calendar:CalendarRef={id:'calendar',slug:'community',name:'Community',description:null,visibility:'public',organization_id:'org',organization_name:'Library',organization_slug:'library'};
const meeting:MeetingRecord={status:'ok',event:{id:'event',title:'Community meeting',meeting_notes:'Public minutes',meeting_transcript:'Public transcript',meeting_video_url:null,meeting_video_start_seconds:null},attendance:[{person_id:'public',full_name:'Public member',slug:'public',status:'present',note:null},{person_id:'hidden',full_name:'Secret member',slug:'hidden',status:'absent',note:'Secret note'}],votes:[{id:'vote',subject:'Public motion',description:null,outcome:'passed',choices:[{person_id:'hidden',full_name:'Secret member',choice:'yes'},{person_id:'public',full_name:'Public member',choice:'yes'}]}]};

test('month shards retain spanning/DST events and exclusive ends; upcoming selections follow the current day',()=>{
 const rows=[event(),{...event('instant'),starts_at:'2026-11-02T05:00:00Z',ends_at:null,all_day:false}];
 const months=calendarMonths(rows);
 expect([...months.keys()]).toEqual(['2026-10','2026-11']);
 expect(months.get('2026-10')).toHaveLength(1);expect(months.get('2026-11')).toHaveLength(2);
 expect(eventsForMonth(rows,'2026-12')).toEqual([]);
 expect(upcomingEvents(rows,'2026-11-02').map(row=>row.id)).toEqual(['instant']);
 expect(upcomingEvents(rows,'2026-11-03')).toEqual([]);
 const exclusive={...event(),ends_at:'2026-11-01T04:00:00Z'};
 expect([...calendarMonths([exclusive]).keys()]).toEqual(['2026-10']);
});

test('public projections exclude hidden parents/participants and unexpected database fields',()=>{
 expect(isPublicEvent(event())).toBe(true);
 for(const key of ['visibility','calendar_visibility','election_visibility']) expect(isPublicEvent({...event(),[key]:'unlisted',election_id:'election'})).toBe(false);
 const clean=publicEvent({...event(),meeting_transcript:'not listing data',internal:'private'} as EventRecord);
 expect(clean).not.toHaveProperty('meeting_transcript');expect(clean).not.toHaveProperty('internal');
 const snapshot=publicMeeting(meeting,new Set(['public']));
 expect(snapshot.attendance).toHaveLength(1);expect(snapshot.votes![0].choices).toHaveLength(1);
 expect(JSON.stringify(snapshot)).not.toContain('Secret');expect(JSON.stringify(snapshot)).not.toContain('hidden');
});

test('build export pages calendars/events/meetings with three bounded streams and aborts failed pages',async()=>{
 const calls:{name:string;offset:number}[]=[];let active=0,max=0,fail=false;
 const client={rpc:(name:string,args:Record<string,unknown>)=>{
   const run=async(offset:number,size:number)=>{
    calls.push({name,offset});active++;max=Math.max(max,active);await Bun.sleep(1);active--;
    const total=name==='list_calendars'?501:1001;
    const data=Array.from({length:Math.min(size,Math.max(0,total-offset))},(_,i)=>{
     const id=String(offset+i);
     return name==='list_calendars'?{...calendar,id}:name==='browse_calendar_events'?{...event(id),calendar_id:'0',is_meeting:true}:{id,meeting:{...meeting,event:{...meeting.event,id}}};
    });
    return {data,error:fail&&offset>=500?{message:'offline'}:null};
   };
   if(name==='list_calendars') return {order:()=>({range:(start:number,end:number)=>run(start,end-start+1)})};
   return run(Number(args.p_offset),name==='export_public_calendar_meetings'?100:500);
 }} as unknown as Parameters<typeof loadPublicCalendarData>[0];
 const data=await loadPublicCalendarData(client,new Set(['public']));
 expect(data.events).toHaveLength(1001);expect(data.calendars).toHaveLength(501);expect(data.meetings.size).toBe(1001);expect(max).toBeLessThanOrEqual(3);
 expect(calls.filter(call=>call.name==='browse_calendar_events').map(call=>call.offset)).toEqual([0,500,1000]);
 expect(JSON.stringify([...data.meetings.values()])).not.toContain('Secret');
 fail=true;await expect(loadPublicCalendarData(client,new Set())).rejects.toThrow('offline');
});

test('asset generation shares monthly data and hashes while keeping meeting text out of listings',async()=>{
 const record={...event(),is_meeting:true};
 const assets=await buildCalendarAssets({events:[record],calendars:[calendar],meetings:new Map([['event',publicMeeting(meeting,new Set(['public']))]])});
 expect(assets.get('calendar')!.body).not.toContain('Public transcript');
 expect(assets.get('months/2026-10')!.body).not.toContain('Public transcript');
 expect(assets.get('events/event')!.body).toContain('Public transcript');
 const again=await buildCalendarAssets({events:[record],calendars:[calendar],meetings:new Map([['event',publicMeeting(meeting,new Set(['public']))]])});
 expect(again.get('events/event')!.path).toBe(assets.get('events/event')!.path);
});

test('anonymous static reads cache assets; signed-in and nonpublic UUID readers retain live gates; failures never conceal missing public files',async()=>{
 const before=globalThis.fetch;const urls:string[]=[];let signedIn=false,fail=false;
 const client={auth:{getSession:async()=>({data:{session:signedIn?{}:null},error:null})}} as unknown as Parameters<typeof readPublicCalendar>[1];
 globalThis.fetch=(async(input)=>{
  const url=String(input);urls.push(url);
  if(fail) return new Response('missing',{status:404});
  if(url==='/calendar-index') return Response.json({calendars:[calendar],months:{'2026-10':'/month'}});
  if(url==='/event-index') return Response.json({event:'/event'});
  if(url==='/event') return Response.json({detail:{status:'ok',event:event()}});
  return Response.json([event()]);
 }) as typeof fetch;
 try {
  const manifest=await readPublicCalendar('/calendar-index',client);expect(manifest!.calendars).toHaveLength(1);
  await readPublicCalendar('/calendar-index',client);expect(urls).toEqual(['/calendar-index']);
  expect(await readCalendarMonth(manifest!,'2027-01')).toEqual([]);
  expect(await readCalendarMonth(manifest!,'2026-10')).toHaveLength(1);
  expect(await readPublicEvent('hidden',{index:'/event-index'},client)).toBe(null);
  expect((await readPublicEvent('event',{index:'/event-index'},client))!.detail.event!.id).toBe('event');
  signedIn=true;expect(await readPublicCalendar('/calendar-index',client)).toBe(null);expect(await readPublicEvent('event',{event:'/event'},client)).toBe(null);
  signedIn=false;fail=true;await expect(readPublicEvent('event',{event:'/missing-event'},client)).rejects.toThrow('404');
  fail=false;expect(await readCalendarAsset('/missing-event')).toHaveLength(1);
 } finally {globalThis.fetch=before;}
});

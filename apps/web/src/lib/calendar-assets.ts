import { getPublicCalendarData } from './calendar-build-data';
import { calendarMonths, eventResponse, upcomingEvents, type CalendarManifest, type PublicCalendarSnapshot, type PublicEventSnapshot } from './calendar-snapshot';

export async function buildCalendarAssets(snapshot: PublicCalendarSnapshot) {
  const assets=new Map<string,{path:string;body:string}>();
  async function add(key:string,value:unknown) {
    const body=JSON.stringify(value);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))),byte=>byte.toString(16).padStart(2,'0')).join('');
    const asset={path:`${key}-${hash}.json`,body}; assets.set(key,asset);
    return `/calendar-data/${asset.path}`;
  }
  const months:Record<string,string>={};
  for(const [month,events] of [...calendarMonths(snapshot.events)].sort(([a],[b])=>a.localeCompare(b))) months[month]=await add(`months/${month}`,events);
  const eventIndex:Record<string,string>={};
  for(const event of snapshot.events) {
    const value:PublicEventSnapshot={detail:eventResponse(event)};
    if(event.is_meeting) value.meeting=snapshot.meetings.get(event.id)!;
    eventIndex[event.id]=await add(`events/${event.id}`,value);
  }
  await add('event-index',eventIndex);
  await add('calendar',{calendars:snapshot.calendars,months} satisfies CalendarManifest);
  // Keep all published future events; the browser selects today's next four.
  await add('home',upcomingEvents(snapshot.events,undefined,Number.MAX_SAFE_INTEGER));
  return assets;
}
let assets:ReturnType<typeof buildCalendarAssets>|undefined;
let refreshAfter=0;
export function getCalendarAssets() {
  if(import.meta.env.DEV && Date.now()>=refreshAfter) {assets=undefined;refreshAfter=Date.now()+30_000;}
  return assets??=getPublicCalendarData().then(buildCalendarAssets);
}
export async function calendarAssetUrl(key:string) {
  const asset=(await getCalendarAssets()).get(key);
  if(!asset) throw new Error(`Missing calendar asset: ${key}`);
  return `/calendar-data/${asset.path}`;
}

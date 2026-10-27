import { civicDate } from '../lib/election-callout';
import {readCalendarAsset} from '../lib/calendar-data';
import {isPublicEvent,upcomingEvents} from '../lib/calendar-snapshot';
import { eventViewHref, formatEventWhen, type EventRecord } from '../lib/calendars';
import { getSupabase } from '../lib/supabase';

const VISIBILITY_LABELS: Record<EventRecord['visibility'], string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

function renderHomeDay(events: EventRecord[]): HTMLElement {
  const event = events[0]!;
  const item = document.createElement('li');
  item.className = 'home-event';

  const when = document.createElement('time');
  when.className = 'home-event-when';
  when.dateTime = civicDate(new Date(event.starts_at));
  when.textContent = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', timeZone: 'America/New_York',
  }).format(new Date(event.starts_at));

  item.append(when);

  const entries = document.createElement('div');
  entries.className = 'home-day-events';
  for (const event of events) {
  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = eventViewHref(event.id,isPublicEvent(event));
  link.textContent = event.title;
  link.setAttribute('aria-label', `${event.title}, ${formatEventWhen(event, 'America/New_York')}`);
  heading.append(link);
  entries.append(heading);

  if (event.visibility !== 'public') {
    const badge = document.createElement('span');
    badge.className = 'visibility-badge';
    badge.textContent = VISIBILITY_LABELS[event.visibility];
    entries.append(badge);
  }

  const meta = document.createElement('p');
  meta.className = 'home-event-meta';
  meta.textContent = [event.organization_name, event.calendar_name, event.location]
    .filter(Boolean)
    .join(' · ');
  entries.append(meta);
  }
  item.append(entries);

  return item;
}

/** Loads the next few upcoming events, honoring calendar/event visibility. */
export function initHomeEvents(): void {
  const list = document.querySelector<HTMLElement>('[data-home-events-list]');
  const status = document.querySelector<HTMLElement>('[data-home-events-status]');
  const empty = document.querySelector<HTMLElement>('[data-home-events-empty]');
  if (!list) return;

  void (async()=>{
    try {
      const client=getSupabase();
      const {data:{session},error:authError}=await client.auth.getSession();
      if(authError) throw authError;
      let events:EventRecord[];
      if(session) {
        const {data,error}=await client.rpc('search_events',{p_query:'',p_limit:4});
        if(error) throw error;
        events=(data??[]) as unknown as EventRecord[];
      } else {
        const url=list.dataset.homeEventsSnapshot;
        if(!url) throw new Error('Missing published upcoming events');
        events=upcomingEvents(await readCalendarAsset<EventRecord[]>(url));
      }
      const days = new Map<string, EventRecord[]>();
      for (const event of events) {
        const day = civicDate(new Date(event.starts_at));
        days.set(day, [...(days.get(day) ?? []), event]);
      }
      list.replaceChildren(...[...days.values()].map(renderHomeDay));
      list.hidden=events.length===0;
      if(status) status.hidden=true;
      if(empty) empty.hidden=events.length>0;
    } catch {
      if(status) status.textContent='Could not load upcoming events. Please reload to try again.';
    }
  })();
}

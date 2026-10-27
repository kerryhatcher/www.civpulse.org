import {readCalendarAsset} from '../lib/calendar-data';
import { filterCounty } from './county-filter';
import {isPublicEvent,upcomingEvents} from '../lib/calendar-snapshot';
import { eventViewHref, formatEventWhen, type EventRecord } from '../lib/calendars';
import { getSupabase } from '../lib/supabase';

const VISIBILITY_LABELS: Record<EventRecord['visibility'], string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

function renderHomeEvent(event: EventRecord): HTMLElement {
  const item = document.createElement('li');
  item.className = 'home-event';

  const when = document.createElement('p');
  when.className = 'home-event-when';
  when.textContent = formatEventWhen(event,'America/New_York');
  item.append(when);

  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = eventViewHref(event.id,isPublicEvent(event));
  link.textContent = event.title;
  heading.append(link);
  item.append(heading);

  if (event.visibility !== 'public') {
    const badge = document.createElement('span');
    badge.className = 'visibility-badge';
    badge.textContent = VISIBILITY_LABELS[event.visibility];
    item.append(badge);
  }

  const meta = document.createElement('p');
  meta.className = 'home-event-meta';
  meta.textContent = [event.organization_name, event.calendar_name, event.location]
    .filter(Boolean)
    .join(' · ');
  item.append(meta);

  return item;
}

/** Loads the next few upcoming events, honoring calendar/event visibility. */
export function initHomeEvents(): void {
  const list = document.querySelector<HTMLElement>('[data-home-events-list]');
  const status = document.querySelector<HTMLElement>('[data-home-events-status]');
  const empty = document.querySelector<HTMLElement>('[data-home-events-empty]');
  if (!list) return;
  const listEl = list;

  let revision = 0;
  async function load() {
    const current = ++revision;
    try {
      const client=getSupabase();
      const {data:{session},error:authError}=await client.auth.getSession();
      if(authError) throw authError;
      let events:EventRecord[];
      if(session) {
        const {data,error}=await client.rpc('search_events',{p_query:'',p_limit:50});
        if(error) throw error;
        events=(data??[]) as unknown as EventRecord[];
      } else {
        const url=listEl.dataset.homeEventsSnapshot;
        if(!url) throw new Error('Missing published upcoming events');
        events=await readCalendarAsset<EventRecord[]>(url);
      }
      events=upcomingEvents(await filterCounty(events, 'event'));
      if (current !== revision) return;
      listEl.replaceChildren(...events.map(renderHomeEvent));
      listEl.hidden=events.length===0;
      if(status) status.hidden=true;
      if(empty) empty.hidden=events.length>0;
    } catch {
      if(status) status.textContent='Could not load upcoming events. Please reload to try again.';
    }
  }
  window.addEventListener('countychange', () => void load());
  void load();
}

import { getSupabase } from '../lib/supabase';
import { eventViewHref, formatEventWhen, type EventRecord } from '../lib/calendars';

/** Query only curated organizations; never label the global calendar as county-local. */
export function initCountyEvents(): void {
  const root = document.querySelector<HTMLElement>('[data-county-events]');
  const list = root?.querySelector<HTMLUListElement>('[data-county-events-list]');
  const status = root?.querySelector<HTMLElement>('[data-county-events-status]');
  if (!root || !list || !status) return;
  const eventList = list;
  const message = status;
  const ids = JSON.parse(root.dataset.organizationIds ?? '[]') as string[];
  void (async () => {
    try {
      const responses = await Promise.all(ids.map(id => getSupabase().rpc('search_events', {
        p_query: '', p_organization_id: id, p_limit: 4,
      })));
      if (responses.some(response => response.error)) throw new Error('Event request failed');
      const events = responses.flatMap(response => (response.data ?? []) as EventRecord[])
        .filter(event => event.visibility === 'public' && event.calendar_visibility === 'public'
          && (!event.election_id || event.election_visibility === 'public'))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 4);
      message.textContent = events.length ? '' : 'No upcoming public events are recorded for these organizations. Explore the full calendar for more events.';
      message.hidden = events.length > 0;
      eventList.replaceChildren(...events.map(event => {
        const li = document.createElement('li');
        const time = document.createElement('time');
        time.dateTime = event.starts_at;
        time.textContent = formatEventWhen(event, 'America/New_York');
        const heading = document.createElement('h3');
        const link = document.createElement('a');
        link.href = eventViewHref(event.id);
        link.textContent = event.title;
        heading.append(link);
        const meta = document.createElement('p');
        meta.textContent = [event.is_meeting ? 'Meeting' : null, event.organization_name, event.location].filter(Boolean).join(' · ');
        li.append(time, heading, meta);
        return li;
      }));
    } catch {
      message.hidden = false;
      message.textContent = 'Upcoming events could not be loaded. Open the community calendar to try again.';
    }
  })();
}

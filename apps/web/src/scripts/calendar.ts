import { calendarColor, dayBoundary, dayKey, groupEvents, monthWindow, occursOn, shiftDay, type CalendarEvent } from '../lib/calendar-display';
import {
  eventViewHref,
  formatEventWhen,
  type CalendarRef,
  type CalendarVisibility,
  type EventRecord,
} from '../lib/calendars';
import { getSupabase } from '../lib/supabase';
import { isCurrentUserAdmin } from './auth';

const VISIBILITY_LABELS: Record<CalendarVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

function renderEventCard(event: EventRecord): HTMLElement {
  const card = document.createElement('article');
  card.className = 'event-card';

  const when = document.createElement('p');
  when.className = 'event-when';
  when.textContent = formatEventWhen(event, 'America/New_York');
  card.append(when);

  const heading = document.createElement('h2');
  const link = document.createElement('a');
  link.href = eventViewHref(event.id);
  link.textContent = event.title;
  heading.append(link);
  card.append(heading);

  if (event.visibility !== 'public') {
    const badge = document.createElement('span');
    badge.className = 'visibility-badge';
    badge.textContent = VISIBILITY_LABELS[event.visibility];
    card.append(badge);
  }

  const meta = document.createElement('p');
  meta.className = 'event-meta';
  meta.textContent = `${event.organization_name} · ${event.calendar_name}`;
  card.append(meta);

  if (event.location) {
    const location = document.createElement('p');
    location.className = 'event-location';
    location.textContent = event.location;
    card.append(location);
  }

  if (event.description || event.url) {
    const details = document.createElement('details');
    details.className = 'event-details';
    const summary = document.createElement('summary'); summary.textContent = 'Event details';
    details.append(summary);
    if (event.description) {
      const description = document.createElement('p'); description.className = 'event-description';
      description.textContent = event.description; details.append(description);
    }
    if (event.url && /^https?:\/\//i.test(event.url)) {
      const source = document.createElement('a'); source.href = event.url; source.textContent = 'Organizer website';
      details.append(source);
    }
    card.append(details);
  }

  if (event.election_id) {
    const election = document.createElement('p');
    election.className = 'event-election';
    const link = document.createElement('a');
    link.href =
      event.election_visibility === 'public' && event.election_slug
        ? `/elections/${event.election_slug}/`
        : `/elections/view/?id=${event.election_id}`;
    link.textContent = event.election_name ?? 'Election';
    election.append('Part of ', link);
    card.append(election);
  }

  return card;
}

/** Month browsing uses the same event/calendar/election visibility rules as search. */
export function initCalendar(): void {
  const find = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const org = find<HTMLSelectElement>('[data-calendar-org]');
  const calendar = find<HTMLSelectElement>('[data-calendar-calendar]');
  const category = find<HTMLSelectElement>('[data-calendar-category]');
  const query = find<HTMLInputElement>('[data-calendar-search]');
  const colorBy = find<HTMLSelectElement>('[data-calendar-color]');
  const results = find<HTMLElement>('[data-calendar-results]');
  const status = find<HTMLElement>('[data-calendar-status]');
  const empty = find<HTMLElement>('[data-calendar-empty]');
  const grid = find<HTMLElement>('[data-calendar-grid]');
  const picker = find<HTMLElement>('[data-calendar-picker]');
  const monthLabel = find<HTMLElement>('[data-calendar-month]');
  const clearDay = find<HTMLButtonElement>('[data-calendar-clear-day]');
  if (!org || !results) return;
  const supabase = getSupabase();
  const params = new URLSearchParams(location.search);
  const today = dayKey(new Date());
  let month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month') ?? '') ? params.get('month')! : today.slice(0, 7);
  let view = params.get('view') === 'agenda' ? 'agenda' : 'month';
  let selectedDay: string | null = null;
  let calendars: CalendarRef[] = [];
  let events: CalendarEvent[] = [];
  let selected = new Set<string>();
  let requestId = 0;
  let timer: number | undefined;
  let loading = true;
  let failed = false;
  query.value = params.get('q') ?? '';
  colorBy.value = params.get('color') === 'organization' ? 'organization' : 'calendar';

  function color(id: string, organization: string): string { return calendarColor(colorBy.value === 'organization' ? organization : id); }
  function syncUrl(): void {
    const url = new URL(location.href);
    for (const key of ['calendar', 'calendars', 'month', 'view', 'q', 'organization', 'category', 'color', 'past']) url.searchParams.delete(key);
    url.searchParams.set('month', month);
    url.searchParams.set('view', view);
    if (selected.size !== calendars.length) url.searchParams.set('calendars', [...selected].join(','));
    if (query.value) url.searchParams.set('q', query.value);
    if (org.value) url.searchParams.set('organization', org.value);
    if (category.value) url.searchParams.set('category', category.value);
    if (colorBy.value !== 'calendar') url.searchParams.set('color', colorBy.value);
    history.replaceState(null, '', url);
  }
  function drawPicker(): void {
    const active = document.activeElement instanceof HTMLInputElement ? document.activeElement.dataset.calendarId : undefined;
    picker.replaceChildren();
    const groups = new Map<string, CalendarRef[]>();
    for (const item of calendars) {
      if (org.value && item.organization_id !== org.value) continue;
      const group = groups.get(item.organization_name) ?? [];
      group.push(item); groups.set(item.organization_name, group);
    }
    for (const [name, items] of groups) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend'); legend.textContent = name; fieldset.append(legend);
      for (const item of items) {
        const label = document.createElement('label'); label.className = 'calendar-check';
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected.has(item.id);
        input.dataset.calendarId = item.id;
        input.style.accentColor = color(item.id, item.organization_id);
        input.addEventListener('change', () => { input.checked ? selected.add(item.id) : selected.delete(item.id); calendar.value = ''; render(); });
        const text = document.createElement('span'); text.textContent = item.name + (item.visibility === 'public' ? '' : ` (${VISIBILITY_LABELS[item.visibility]})`);
        text.style.borderLeft = `4px solid ${color(item.id, item.organization_id)}`; text.style.paddingLeft = '8px';
        label.append(input, text); fieldset.append(label);
      }
      picker.append(fieldset);
    }
    if (active) picker.querySelector<HTMLInputElement>(`[data-calendar-id="${active}"]`)?.focus();
  }
  function calendarOptions(): void {
    const previous = calendar.value;
    calendar.replaceChildren(new Option('All calendars', ''));
    for (const item of calendars.filter(item => !org.value || item.organization_id === org.value)) calendar.append(new Option(item.name, item.id));
    calendar.value = [...calendar.options].some(option => option.value === previous) ? previous : '';
  }
  function filteredEvents(): CalendarEvent[] {
    const needle = query.value.trim().toLocaleLowerCase();
    return events.filter(event => event.memberships.some(item => selected.has(item.id) && (!org.value || item.organization_id === org.value))
      && (!category.value || event.categories.includes(category.value))
      && (!needle || [event.title, event.description, event.location, event.organization_name, ...event.memberships.map(item => item.name), ...event.categories].join(' ').toLocaleLowerCase().includes(needle)));
  }
  function render(): void {
    const activeDay = document.activeElement instanceof HTMLButtonElement ? document.activeElement.dataset.day : undefined;
    const window = monthWindow(month);
    monthLabel.textContent = new Date(`${window.start}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    grid.hidden = view !== 'month';
    document.querySelectorAll<HTMLButtonElement>('[data-calendar-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.calendarView === view)));
    const filtered = filteredEvents();
    grid.replaceChildren();
    for (const name of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      const label = document.createElement('div'); label.className = 'calendar-weekday'; label.textContent = name; grid.append(label);
    }
    for (let index = 0; index < window.weekday; index++) { const blank = document.createElement('div'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); }
    for (let date = 1; date <= window.days; date++) {
      const day = `${month}-${String(date).padStart(2, '0')}`;
      const matches = filtered.filter(event => occursOn(event, day));
      const button = document.createElement('button'); button.type = 'button'; button.className = 'calendar-day';
      button.dataset.day = day;
      button.setAttribute('aria-label', `${new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { dateStyle: 'full', timeZone: 'UTC' })}, ${matches.length} event${matches.length === 1 ? '' : 's'}`);
      button.setAttribute('aria-pressed', String(selectedDay === day));
      if (day === today) button.setAttribute('aria-current', 'date');
      const number = document.createElement('span'); number.textContent = String(date); button.append(number);
      const dots = document.createElement('span'); dots.className = 'calendar-dots'; dots.setAttribute('aria-hidden', 'true');
      const keys = new Map<string, string>();
      for (const event of matches) for (const item of event.memberships.filter(item => selected.has(item.id))) keys.set(colorBy.value === 'organization' ? item.organization_id : item.id, color(item.id, item.organization_id));
      for (const value of keys.values()) { const dot = document.createElement('i'); dot.style.backgroundColor = value; dots.append(dot); }
      button.append(dots);
      button.addEventListener('click', () => { selectedDay = selectedDay === day ? null : day; render(); });
      grid.append(button);
    }
    const visible = selectedDay ? filtered.filter(event => occursOn(event, selectedDay!)) : filtered;
    results.replaceChildren(...visible.map(event => {
      const card = renderEventCard(event);
      const memberships = event.memberships.filter(item => selected.has(item.id) && (!org.value || item.organization_id === org.value));
      card.style.borderLeft = `4px solid ${color(memberships[0].id, memberships[0].organization_id)}`;
      const meta = card.querySelector<HTMLElement>('.event-meta')!;
      meta.textContent = `${event.organization_name} · ${memberships.map(item => item.name).join(' · ')}`;
      const categories = event.categories.filter(name => !memberships.some(item => item.name === name));
      if (categories.length) meta.append(` · ${categories.join(', ')}`);
      return card;
    }));
    results.hidden = loading || failed || visible.length === 0;
    empty.hidden = loading || failed || visible.length > 0;
    status.textContent = loading ? 'Loading events…' : failed ? 'Could not load events. Please reload to try again.' : `${visible.length} event${visible.length === 1 ? '' : 's'}${selectedDay ? ` on ${selectedDay}` : ' this month'}`;
    clearDay.hidden = selectedDay === null;
    drawPicker();
    if (activeDay) grid.querySelector<HTMLButtonElement>(`[data-day="${activeDay}"]`)?.focus();
    syncUrl();
  }
  async function loadEvents(): Promise<void> {
    const id = ++requestId;
    loading = true; failed = false; events = []; render();
    const range = monthWindow(month);
    const rows: EventRecord[] = [];
    try {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.rpc('browse_calendar_events', { p_start: dayBoundary(range.start), p_end: dayBoundary(range.end), p_offset: offset });
        if (id !== requestId) return;
        if (error) throw error;
        const page = data as EventRecord[]; rows.push(...page);
        if (page.length < 500) break;
      }
      events = groupEvents(rows).filter(event => Array.from({length: range.days}, (_, index) => shiftDay(range.start, index)).some(day => occursOn(event, day)));
      const previous = category.value;
      category.replaceChildren(new Option('All categories', ''));
      for (const name of [...new Set(events.flatMap(event => event.categories))].sort()) category.append(new Option(name, name));
      if (previous && ![...category.options].some(option => option.value === previous)) category.append(new Option(previous, previous));
      category.value = previous;
    } catch { failed = true; }
    if (id === requestId) { loading = false; render(); }
  }
  function changeMonth(amount: number): void {
    const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount);
    month = date.toISOString().slice(0, 7); selectedDay = null; void loadEvents();
  }
  find('[data-calendar-prev]').addEventListener('click', () => changeMonth(-1));
  find('[data-calendar-next]').addEventListener('click', () => changeMonth(1));
  find('[data-calendar-today]').addEventListener('click', () => { month = dayKey(new Date()).slice(0, 7); selectedDay = null; void loadEvents(); });
  clearDay.addEventListener('click', () => { selectedDay = null; render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-calendar-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.calendarView!; selectedDay = null; render(); }));
  org.addEventListener('change', () => { calendarOptions(); selectedDay = null; render(); });
  calendar.addEventListener('change', () => {
    selected = new Set(calendars.filter(item => !calendar.value || item.id === calendar.value).map(item => item.id)); render();
  });
  category.addEventListener('change', () => { selectedDay = null; render(); });
  colorBy.addEventListener('change', render);
  query.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => { selectedDay = null; render(); }, 150); });
  find<HTMLFormElement>('[data-calendar-filters]').addEventListener('submit', event => { event.preventDefault(); render(); });
  for (const [selector, show] of [['[data-calendars-show]', true], ['[data-calendars-hide]', false]] as const) find(selector).addEventListener('click', () => {
    for (const item of calendars.filter(item => !org.value || item.organization_id === org.value)) show ? selected.add(item.id) : selected.delete(item.id);
    calendar.value = ''; render();
  });
  // Same-origin stable URL works on staging and follows the production domain at cutover.
  const feed = new URL('/events.ics', location.origin);
  find<HTMLAnchorElement>('[data-calendar-subscribe]').href = feed.href.replace(/^https?:/, 'webcal:');
  find<HTMLInputElement>('[data-calendar-feed]').value = feed.href;
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      find('[data-calendar-signed-in]').hidden = !session;
      const { data, error } = await supabase.rpc('list_calendars', { p_organization_id: null });
      if (error) throw error;
      calendars = data as CalendarRef[];
      selected = new Set(calendars.map(item => item.id));
      const ids = params.has('calendars') ? params.get('calendars')!.split(',') : params.get('calendar') ? [params.get('calendar')!] : null;
      if (ids) selected = new Set(ids.filter(id => calendars.some(item => item.id === id)));
      org.replaceChildren(new Option('All organizations', ''));
      for (const [id, name] of new Map(calendars.map(item => [item.organization_id, item.organization_name]))) org.append(new Option(name, id));
      org.value = params.get('organization') ?? '';
      calendarOptions();
      if (params.get('calendar')) calendar.value = params.get('calendar')!;
      if (params.get('category')) { const name = params.get('category')!; category.append(new Option(name, name)); category.value = name; }
      await loadEvents();
    } catch { loading = false; failed = true; render(); }
  })();
}

// --- Shared event viewer ------------------------------------------------

interface EventViewResponse {
  status?: string;
  event?: {
    id: string;
    title: string;
    description: string | null;
    starts_at: string;
    ends_at: string | null;
    all_day: boolean;
    location: string | null;
    url: string | null;
  };
  calendar?: { id: string; name: string };
  organization?: { id: string; name: string; slug: string };
  election?: { id: string; slug: string; name: string; visibility: string };
}

function eventIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/calendar\/e\/([0-9a-f-]{36})\/?$/i);
  return match ? match[1] : null;
}

function showViewerStatus(root: HTMLElement, text: string, signIn = false): void {
  root.replaceChildren();

  const message = document.createElement('p');
  message.textContent = text;
  root.append(message);

  if (signIn) {
    const link = document.createElement('a');
    link.className = 'button-link';
    link.href = `/signin/?next=${encodeURIComponent(
      window.location.pathname + window.location.search,
    )}`;
    link.textContent = 'Sign in';
    root.append(link);
  }

  root.hidden = false;
}

function fillEventView(response: EventViewResponse): void {
  const viewer = document.querySelector<HTMLElement>('[data-event-viewer]');
  const event = response.event;
  if (!viewer || !event) return;

  const setText = (selector: string, value: string | null | undefined): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value ?? '';
  };

  setText('[data-event-title]', event.title);
  setText('[data-event-when]', formatEventWhen(event));
  setText(
    '[data-event-meta]',
    [response.organization?.name, response.calendar?.name].filter(Boolean).join(' · '),
  );

  const location = document.querySelector<HTMLElement>('[data-event-location]');
  if (location) {
    location.textContent = event.location ?? '';
    location.hidden = !event.location;
  }

  const description = document.querySelector<HTMLElement>('[data-event-description]');
  if (description) {
    description.textContent = event.description ?? '';
    description.hidden = !event.description;
  }

  const link = document.querySelector<HTMLElement>('[data-event-link]');
  const url = document.querySelector<HTMLAnchorElement>('[data-event-url]');
  if (link && url && event.url) {
    url.href = event.url;
    link.hidden = false;
  }

  const election = document.querySelector<HTMLElement>('[data-event-election]');
  if (election) {
    const linked = response.election;
    if (linked) {
      election.replaceChildren('Part of ');
      const electionLink = document.createElement('a');
      electionLink.href =
        linked.visibility === 'public'
          ? `/elections/${linked.slug}/`
          : `/elections/view/?id=${linked.id}`;
      electionLink.textContent = linked.name;
      election.append(electionLink);
      election.hidden = false;
    } else {
      election.hidden = true;
    }
  }

  viewer.hidden = false;
}

/** Viewer for any event uuid (public, unlisted, or private). */
export async function initEventViewFromUrl(): Promise<void> {
  const viewer = document.querySelector<HTMLElement>('[data-event-viewer]');
  const status = document.querySelector<HTMLElement>('[data-event-viewer-status]');
  if (!viewer || !status) return;

  const id =
    eventIdFromPath(window.location.pathname) ?? new URLSearchParams(window.location.search).get('id');

  if (!id) {
    showViewerStatus(status, 'Event not found.');
    return;
  }

  const { data, error } = await getSupabase().rpc('get_event', { p_id: id });
  const response = data as EventViewResponse | null;

  if (error || !response || response.status === 'missing') {
    showViewerStatus(status, 'Event not found.');
    return;
  }

  if (response.status === 'private') {
    showViewerStatus(status, 'This event is private. Sign in to view it.', true);
    return;
  }

  status.hidden = true;
  fillEventView(response);

  if (response.event && (await isCurrentUserAdmin())) {
    const edit = document.querySelector<HTMLAnchorElement>('[data-event-edit-link]');
    if (edit) {
      edit.href = `/admin/calendars/?editEvent=${response.event.id}`;
      edit.hidden = false;
    }
  }
}

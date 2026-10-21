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
  when.textContent = formatEventWhen(event);
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

  if (event.description) {
    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = event.description;
    card.append(description);
  }

  return card;
}

/**
 * Public calendar browse/search. Organization and calendar filters both come
 * from the `list_calendars` RPC, so the list only ever contains content the
 * caller may see (public for anonymous, plus unlisted/private when signed in).
 */
export function initCalendar(): void {
  const form = document.querySelector<HTMLFormElement>('[data-calendar-filters]');
  const orgSelect = document.querySelector<HTMLSelectElement>('[data-calendar-org]');
  const calendarSelect = document.querySelector<HTMLSelectElement>('[data-calendar-calendar]');
  const searchInput = document.querySelector<HTMLInputElement>('[data-calendar-search]');
  const pastCheckbox = document.querySelector<HTMLInputElement>('[data-calendar-past]');
  const results = document.querySelector<HTMLElement>('[data-calendar-results]');
  const status = document.querySelector<HTMLElement>('[data-calendar-status]');
  const empty = document.querySelector<HTMLElement>('[data-calendar-empty]');
  const signedInNote = document.querySelector<HTMLElement>('[data-calendar-signed-in]');
  if (!orgSelect || !calendarSelect || !results) return;

  // Aliases keep the non-null types inside the nested helpers below.
  const orgSelectEl = orgSelect;
  const calendarSelectEl = calendarSelect;
  const resultsEl = results;

  const supabase = getSupabase();
  let calendars: CalendarRef[] = [];
  let signedIn = false;
  let timer: number | undefined;
  let requestId = 0;

  function setStatus(text: string, hidden = false): void {
    if (!status) return;
    status.textContent = text;
    status.hidden = hidden;
  }

  function selectedOrganization(): string {
    return orgSelectEl.value;
  }

  function renderOrganizationOptions(): void {
    const previous = orgSelectEl.value;
    const organizations = new Map<string, string>();
    for (const calendar of calendars) {
      if (!organizations.has(calendar.organization_id)) {
        organizations.set(calendar.organization_id, calendar.organization_name);
      }
    }

    const options = [...organizations.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }),
    );

    orgSelectEl.replaceChildren(new Option('All organizations', ''));
    for (const [id, name] of options) orgSelectEl.append(new Option(name, id));
    orgSelectEl.value = organizations.has(previous) ? previous : '';
  }

  function renderCalendarOptions(): void {
    const organizationId = selectedOrganization();
    const previous = calendarSelectEl.value;
    const visible = calendars.filter(
      (calendar) => !organizationId || calendar.organization_id === organizationId,
    );

    calendarSelectEl.replaceChildren(new Option('All calendars', ''));
    for (const calendar of visible) {
      const label =
        signedIn && calendar.visibility !== 'public'
          ? `${calendar.name} (${VISIBILITY_LABELS[calendar.visibility]})`
          : calendar.name;
      calendarSelectEl.append(new Option(label, calendar.id));
    }
    calendarSelectEl.value = visible.some((calendar) => calendar.id === previous) ? previous : '';
  }

  async function loadEvents(): Promise<void> {
    const id = ++requestId;
    setStatus('Loading events…');

    const { data, error } = await supabase.rpc('search_events', {
      p_query: searchInput?.value.trim() ?? '',
      p_organization_id: orgSelectEl.value || null,
      p_calendar_id: calendarSelectEl.value || null,
      p_include_past: Boolean(pastCheckbox?.checked),
      p_limit: 100,
    });

    if (id !== requestId) return;

    if (error) {
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
      if (empty) empty.hidden = true;
      setStatus(`Could not load events: ${error.message}`);
      return;
    }

    const events = (data ?? []) as unknown as EventRecord[];
    resultsEl.replaceChildren(...events.map(renderEventCard));
    resultsEl.hidden = events.length === 0;
    if (empty) empty.hidden = events.length > 0;
    setStatus(
      events.length > 0 ? `${events.length} event${events.length === 1 ? '' : 's'}` : '',
      events.length === 0,
    );
  }

  async function loadCalendars(): Promise<void> {
    const { data, error } = await supabase.rpc('list_calendars', { p_organization_id: null });

    if (error) {
      setStatus(`Could not load calendars: ${error.message}`);
      return;
    }

    calendars = (data ?? []) as unknown as CalendarRef[];
    renderOrganizationOptions();
    renderCalendarOptions();
    await loadEvents();
  }

  orgSelectEl.addEventListener('change', () => {
    renderCalendarOptions();
    void loadEvents();
  });
  calendarSelectEl.addEventListener('change', () => void loadEvents());
  pastCheckbox?.addEventListener('change', () => void loadEvents());

  searchInput?.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void loadEvents(), 200);
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    void loadEvents();
  });

  void supabase.auth.getSession().then(({ data: { session } }) => {
    signedIn = Boolean(session);
    if (signedIn && signedInNote) signedInNote.hidden = false;
    void loadCalendars();
  });
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

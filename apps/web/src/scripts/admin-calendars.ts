import {
  CALENDAR_COLUMNS,
  EVENT_COLUMNS,
  formatEventWhen,
  toDatetimeLocal,
  type CalendarRow,
  type CalendarVisibility,
  type EventRow,
} from '../lib/calendars';
import { getSupabase } from '../lib/supabase';

type MessageKind = 'info' | 'error' | 'success';

const VISIBILITY_LABELS: Record<CalendarVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function setMessage(
  root: Document | HTMLElement,
  selector: string,
  text: string,
  kind: MessageKind = 'info',
): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
  element.hidden = false;
}

export async function initCalendarAdmin(): Promise<void> {
  const gate = document.querySelector<HTMLElement>('[data-admin-gate]');
  const denied = document.querySelector<HTMLElement>('[data-admin-denied]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const calendarForm = document.querySelector<HTMLFormElement>('[data-calendar-form]');
  const eventForm = document.querySelector<HTMLFormElement>('[data-event-form]');
  const calendarList = document.querySelector<HTMLElement>('[data-calendar-list]');
  const eventList = document.querySelector<HTMLElement>('[data-event-list]');
  if (!panel || !calendarForm || !eventForm || !calendarList || !eventList) return;

  const calendarFormEl = calendarForm;
  const eventFormEl = eventForm;
  const calendarListEl = calendarList;
  const eventListEl = eventList;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('/signin/?next=/admin/calendars/');
    return;
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  gate?.remove();

  if (!adminRow) {
    if (denied) denied.hidden = false;
    return;
  }

  panel.hidden = false;

  // --- Element references ------------------------------------------------

  const calendarId = calendarFormEl.querySelector<HTMLInputElement>('input[name="id"]');
  const calendarOrg = calendarFormEl.querySelector<HTMLSelectElement>('select[name="organization_id"]');
  const calendarName = calendarFormEl.querySelector<HTMLInputElement>('input[name="name"]');
  const calendarSlug = calendarFormEl.querySelector<HTMLInputElement>('input[name="slug"]');
  const calendarVisibility = calendarFormEl.querySelector<HTMLSelectElement>(
    'select[name="visibility"]',
  );
  const calendarSubmit = calendarFormEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const calendarCancel = calendarFormEl.querySelector<HTMLButtonElement>('[data-calendar-cancel]');
  const calendarHeading = document.querySelector<HTMLElement>('[data-calendar-form-title]');

  const eventId = eventFormEl.querySelector<HTMLInputElement>('input[name="id"]');
  const eventCalendar = eventFormEl.querySelector<HTMLSelectElement>('select[name="calendar_id"]');
  const eventTitle = eventFormEl.querySelector<HTMLInputElement>('input[name="title"]');
  const eventStarts = eventFormEl.querySelector<HTMLInputElement>('input[name="starts_at"]');
  const eventEnds = eventFormEl.querySelector<HTMLInputElement>('input[name="ends_at"]');
  const eventAllDay = eventFormEl.querySelector<HTMLInputElement>('input[name="all_day"]');
  const eventVisibility = eventFormEl.querySelector<HTMLSelectElement>('select[name="visibility"]');
  const eventElection = eventFormEl.querySelector<HTMLSelectElement>('select[name="election_id"]');
  const eventDateKind = eventFormEl.querySelector<HTMLSelectElement>(
    'select[name="election_date_kind"]',
  );
  const eventSubmit = eventFormEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const eventCancel = eventFormEl.querySelector<HTMLButtonElement>('[data-event-cancel]');
  const eventHeading = document.querySelector<HTMLElement>('[data-event-form-title]');
  const eventFilter = document.querySelector<HTMLSelectElement>('[data-event-filter]');

  // --- State -------------------------------------------------------------

  let calendars: CalendarRow[] = [];
  let events: EventRow[] = [];
  const organizationNames = new Map<string, string>();
  const electionNames = new Map<string, string>();
  let slugTouched = false;

  // --- Lookups -----------------------------------------------------------

  async function loadOrganizations(): Promise<void> {
    const { data, error } = await supabase.from('organizations').select('id, name').order('name');

    if (error) {
      setMessage(calendarFormEl, '[data-calendar-message]', error.message, 'error');
      return;
    }

    const organizations = (data ?? []) as { id: string; name: string }[];
    organizationNames.clear();
    for (const org of organizations) organizationNames.set(org.id, org.name);

    calendarOrg?.replaceChildren(new Option('Select an organization…', ''));
    for (const org of organizations) calendarOrg?.append(new Option(org.name, org.id));
    if (organizations.length === 1 && calendarOrg && !calendarOrg.value) {
      calendarOrg.value = organizations[0].id;
    }
  }

  async function loadElections(): Promise<void> {
    const { data, error } = await supabase
      .from('elections')
      .select('id, name, election_date')
      .order('election_date', { ascending: false });

    if (error) return; // Non-fatal: events simply cannot be tagged to an election.

    const elections = (data ?? []) as { id: string; name: string; election_date: string }[];
    electionNames.clear();
    for (const election of elections) electionNames.set(election.id, election.name);

    eventElection?.replaceChildren(new Option('Not an election date', ''));
    for (const election of elections) {
      eventElection?.append(new Option(election.name, election.id));
    }
  }

  async function loadCalendars(): Promise<void> {
    const { data, error } = await supabase
      .from('calendars')
      .select(CALENDAR_COLUMNS)
      .order('name');

    if (error) {
      setMessage(calendarListEl, '[data-calendar-message]', error.message, 'error');
      return;
    }

    calendars = (data ?? []) as unknown as CalendarRow[];

    const calendarOptions: [string, string][] = calendars
      .map((calendar) => [
        calendar.id,
        `${calendar.name} — ${organizationNames.get(calendar.organization_id) ?? 'Organization'}`,
      ] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));

    eventCalendar?.replaceChildren(new Option('Select a calendar…', ''));
    eventFilter?.replaceChildren(new Option('All calendars', ''));
    for (const [id, label] of calendarOptions) {
      eventCalendar?.append(new Option(label, id));
      eventFilter?.append(new Option(label, id));
    }

    if (calendars.length === 1 && eventCalendar && !eventCalendar.value) {
      eventCalendar.value = calendars[0].id;
    }

    renderCalendarList();
  }

  async function loadEvents(): Promise<void> {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_COLUMNS)
      .order('starts_at', { ascending: false });

    if (error) {
      setMessage(eventListEl, '[data-event-message]', error.message, 'error');
      return;
    }

    events = (data ?? []) as unknown as EventRow[];
    renderEventList();
    renderCalendarList();
  }

  // --- Calendar list -----------------------------------------------------

  function calendarNameById(id: string): string {
    return calendars.find((calendar) => calendar.id === id)?.name ?? 'Unknown calendar';
  }

  function renderCalendarList(): void {
    if (calendars.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No calendars yet. Add the first one above.';
      calendarListEl.replaceChildren(empty);
      return;
    }

    calendarListEl.replaceChildren(
      ...calendars.map((calendar) => {
        const row = document.createElement('article');
        row.className = 'org-row';

        const info = document.createElement('div');
        info.className = 'org-row-info';
        const name = document.createElement('span');
        name.className = 'org-row-name';
        name.textContent = calendar.name;
        const meta = document.createElement('span');
        meta.className = 'org-row-meta';
        const count = events.filter((event) => event.calendar_id === calendar.id).length;
        meta.textContent = `${
          organizationNames.get(calendar.organization_id) ?? 'Organization'
        } · ${VISIBILITY_LABELS[calendar.visibility]} · ${count} event${count === 1 ? '' : 's'}`;
        info.append(name, meta);
        row.append(info);

        const actions = document.createElement('div');
        actions.className = 'org-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => startCalendarEdit(calendar));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => void removeCalendar(calendar));

        actions.append(edit, remove);
        row.append(actions);

        return row;
      }),
    );
  }

  function resetCalendarForm(): void {
    calendarFormEl.reset();
    if (calendarId) calendarId.value = '';
    slugTouched = false;
    if (calendarCancel) calendarCancel.hidden = true;
    if (calendarHeading) calendarHeading.textContent = 'Add a calendar';
    if (calendarSubmit) calendarSubmit.textContent = 'Create calendar';
    if (calendars.length === 1 && calendarOrg) calendarOrg.value = calendars[0].organization_id;
  }

  function startCalendarEdit(calendar: CalendarRow): void {
    if (!calendarId) return;
    calendarId.value = calendar.id;
    if (calendarOrg) calendarOrg.value = calendar.organization_id;
    if (calendarName) calendarName.value = calendar.name;
    if (calendarSlug) calendarSlug.value = calendar.slug;
    if (calendarVisibility) calendarVisibility.value = calendar.visibility;
    const description = calendarFormEl.querySelector<HTMLTextAreaElement>(
      'textarea[name="description"]',
    );
    if (description) description.value = calendar.description ?? '';
    slugTouched = true;
    if (calendarCancel) calendarCancel.hidden = false;
    if (calendarHeading) calendarHeading.textContent = `Editing ${calendar.name}`;
    if (calendarSubmit) calendarSubmit.textContent = 'Save changes';
    calendarFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removeCalendar(calendar: CalendarRow): Promise<void> {
    if (
      !window.confirm(
        `Delete calendar “${calendar.name}”? Its events are deleted too. This cannot be undone.`,
      )
    ) {
      return;
    }

    const { error } = await supabase.from('calendars').delete().eq('id', calendar.id);
    if (error) {
      setMessage(calendarListEl, '[data-calendar-message]', error.message, 'error');
      return;
    }

    setMessage(calendarListEl, '[data-calendar-message]', 'Calendar deleted.', 'success');
    await loadCalendars();
    await loadEvents();
  }

  async function saveCalendar(): Promise<void> {
    const values = new FormData(calendarFormEl);
    const id = String(values.get('id') ?? '');
    const name = String(values.get('name') ?? '').trim();
    const slug = String(values.get('slug') ?? '').trim() || slugify(name);
    const organizationId = String(values.get('organization_id') ?? '').trim();
    const visibilityValue = String(values.get('visibility') ?? 'public');
    const visibility = (
      ['public', 'unlisted', 'private'] as string[]
    ).includes(visibilityValue)
      ? (visibilityValue as CalendarVisibility)
      : 'public';

    if (!name || !slug || !organizationId) {
      setMessage(
        calendarFormEl,
        '[data-calendar-message]',
        'A name, valid slug, and organization are required.',
        'error',
      );
      return;
    }

    if (calendarSubmit) calendarSubmit.disabled = true;
    setMessage(calendarFormEl, '[data-calendar-message]', 'Saving…');

    try {
      const payload = {
        organization_id: organizationId,
        slug,
        name,
        description: textOrNull(values.get('description')),
        visibility,
      };

      const { error } = id
        ? await supabase.from('calendars').update(payload).eq('id', id)
        : await supabase.from('calendars').insert(payload);

      if (error) throw new Error(error.message);

      setMessage(
        calendarFormEl,
        '[data-calendar-message]',
        id ? 'Calendar updated.' : 'Calendar created.',
        'success',
      );
      resetCalendarForm();
      await loadCalendars();
    } catch (error) {
      setMessage(
        calendarFormEl,
        '[data-calendar-message]',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      if (calendarSubmit) calendarSubmit.disabled = false;
    }
  }

  // --- Event list --------------------------------------------------------

  function renderEventList(): void {
    const filter = eventFilter?.value ?? '';
    const visible = events.filter((event) => !filter || event.calendar_id === filter);

    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent =
        events.length === 0
          ? 'No events yet. Add the first one above.'
          : 'No events on that calendar.';
      eventListEl.replaceChildren(empty);
      return;
    }

    eventListEl.replaceChildren(
      ...visible.map((event) => {
        const row = document.createElement('article');
        row.className = 'org-row';

        const info = document.createElement('div');
        info.className = 'org-row-info';
        const title = document.createElement('span');
        title.className = 'org-row-name';
        title.textContent = event.title;
        const meta = document.createElement('span');
        meta.className = 'org-row-meta';
        const electionName = event.election_id ? electionNames.get(event.election_id) : null;
        meta.textContent = `${formatEventWhen(event)} · ${calendarNameById(
          event.calendar_id,
        )} · ${VISIBILITY_LABELS[event.visibility]}${electionName ? ` · ${electionName}` : ''}`;
        info.append(title, meta);
        row.append(info);

        const actions = document.createElement('div');
        actions.className = 'org-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => startEventEdit(event));

        if (event.is_meeting) {
          const meeting = document.createElement('a');
          meeting.href = `/admin/meetings/?event=${event.id}`;
          meeting.textContent = 'Meeting records';
          actions.append(meeting);
        }

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => void removeEvent(event));

        actions.append(edit, remove);
        row.append(actions);

        return row;
      }),
    );
  }

  function resetEventForm(): void {
    eventFormEl.reset();
    if (eventId) eventId.value = '';
    if (eventCancel) eventCancel.hidden = true;
    if (eventHeading) eventHeading.textContent = 'Add an event';
    if (eventSubmit) eventSubmit.textContent = 'Create event';
    if (events.length === 0 && calendars.length === 1 && eventCalendar) {
      eventCalendar.value = calendars[0].id;
    }
  }

  function startEventEdit(event: EventRow): void {
    if (!eventId) return;
    eventId.value = event.id;
    if (eventCalendar) eventCalendar.value = event.calendar_id;
    if (eventTitle) eventTitle.value = event.title;
    if (eventStarts) eventStarts.value = toDatetimeLocal(event.starts_at);
    if (eventEnds) eventEnds.value = toDatetimeLocal(event.ends_at);
    if (eventAllDay) eventAllDay.checked = event.all_day;
    const meeting = eventFormEl.querySelector<HTMLInputElement>('input[name="is_meeting"]');
    if (meeting) meeting.checked = event.is_meeting;
    if (eventVisibility) eventVisibility.value = event.visibility;
    if (eventElection) eventElection.value = event.election_id ?? '';
    if (eventDateKind) eventDateKind.value = event.election_date_kind ?? '';
    const location = eventFormEl.querySelector<HTMLInputElement>('input[name="location"]');
    const url = eventFormEl.querySelector<HTMLInputElement>('input[name="url"]');
    const description = eventFormEl.querySelector<HTMLTextAreaElement>(
      'textarea[name="description"]',
    );
    const category = eventFormEl.querySelector<HTMLInputElement>('input[name="category"]');
    if (category) category.value = event.category ?? '';
    if (location) location.value = event.location ?? '';
    if (url) url.value = event.url ?? '';
    if (description) description.value = event.description ?? '';
    if (eventCancel) eventCancel.hidden = false;
    if (eventHeading) eventHeading.textContent = `Editing ${event.title}`;
    if (eventSubmit) eventSubmit.textContent = 'Save changes';
    eventFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removeEvent(event: EventRow): Promise<void> {
    if (!window.confirm(`Delete event “${event.title}”? This cannot be undone.`)) return;

    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      setMessage(eventListEl, '[data-event-message]', error.message, 'error');
      return;
    }

    setMessage(eventListEl, '[data-event-message]', 'Event deleted.', 'success');
    await loadEvents();
  }

  async function saveEvent(): Promise<void> {
    const values = new FormData(eventFormEl);
    const id = String(values.get('id') ?? '');
    const title = String(values.get('title') ?? '').trim();
    const calendarId = String(values.get('calendar_id') ?? '').trim();
    const startsLocal = String(values.get('starts_at') ?? '').trim();
    const endsLocal = String(values.get('ends_at') ?? '').trim();
    const visibilityValue = String(values.get('visibility') ?? 'public');
    const visibility = (['public', 'unlisted', 'private'] as string[]).includes(visibilityValue)
      ? (visibilityValue as CalendarVisibility)
      : 'public';
    const electionId = String(values.get('election_id') ?? '').trim();
    const isMeeting = values.get('is_meeting') !== null;
    if (isMeeting && electionId) {
      setMessage(eventFormEl, '[data-event-message]', 'A meeting cannot also be an election key date.', 'error');
      return;
    }
    const electionDateKind = electionId
      ? String(values.get('election_date_kind') ?? '').trim()
      : '';

    if (!title || !calendarId || !startsLocal) {
      setMessage(
        eventFormEl,
        '[data-event-message]',
        'A title, calendar, and start time are required.',
        'error',
      );
      return;
    }

    const startsAt = new Date(startsLocal);
    const endsAt = endsLocal ? new Date(endsLocal) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      setMessage(eventFormEl, '[data-event-message]', 'Enter valid dates.', 'error');
      return;
    }

    if (eventSubmit) eventSubmit.disabled = true;
    setMessage(eventFormEl, '[data-event-message]', 'Saving…');

    try {
      const payload = {
        calendar_id: calendarId,
        title,
        description: textOrNull(values.get('description')),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        all_day: values.get('all_day') !== null,
        location: textOrNull(values.get('location')),
        category: textOrNull(values.get('category')),
        url: textOrNull(values.get('url')),
        visibility,
        election_id: electionId || null,
        election_date_kind: electionDateKind || null,
        is_meeting: isMeeting,
      };

      const { error } = id
        ? await supabase.from('events').update(payload).eq('id', id)
        : await supabase.from('events').insert(payload);

      if (error) throw new Error(error.message);

      setMessage(
        eventFormEl,
        '[data-event-message]',
        id ? 'Event updated.' : 'Event created.',
        'success',
      );
      resetEventForm();
      await loadEvents();
    } catch (error) {
      setMessage(
        eventFormEl,
        '[data-event-message]',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      if (eventSubmit) eventSubmit.disabled = false;
    }
  }

  // --- Wiring ------------------------------------------------------------

  calendarName?.addEventListener('input', () => {
    if (!calendarSlug || slugTouched || calendarId?.value) return;
    calendarSlug.value = slugify(calendarName.value);
  });
  calendarSlug?.addEventListener('input', () => {
    slugTouched = true;
  });

  calendarFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveCalendar();
  });
  eventFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveEvent();
  });

  calendarCancel?.addEventListener('click', resetCalendarForm);
  eventCancel?.addEventListener('click', resetEventForm);
  eventFilter?.addEventListener('change', renderEventList);

  await loadOrganizations();
  await loadElections();
  await loadCalendars();
  await loadEvents();

  const params = new URLSearchParams(window.location.search);
  const editDate = params.get('edit');
  const editEventId = params.get('editEvent');
  if (editEventId) {
    const match = events.find((event) => event.id === editEventId);
    if (match) startEventEdit(match);
  } else if (editDate) {
    const match = calendars.find((calendar) => calendar.id === editDate);
    if (match) startCalendarEdit(match);
  }
}

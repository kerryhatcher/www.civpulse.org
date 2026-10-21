export type CalendarVisibility = 'public' | 'unlisted' | 'private';

export interface CalendarRef {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CalendarVisibility;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
}

/** An event flattened with its calendar and organization, as returned by RPCs. */
export interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  url: string | null;
  visibility: CalendarVisibility;
  calendar_id: string;
  calendar_name: string;
  calendar_slug: string;
  calendar_visibility: CalendarVisibility;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
}

export interface CalendarRow {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CalendarVisibility;
}

export interface EventRow {
  id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  url: string | null;
  visibility: CalendarVisibility;
}

export const CALENDAR_COLUMNS = 'id, organization_id, slug, name, description, visibility';
export const EVENT_COLUMNS =
  'id, calendar_id, title, description, starts_at, ends_at, all_day, location, url, visibility';

/** The shared event viewer shell. Unlisted and private events are uuid-only. */
export function eventViewHref(id: string): string {
  return `/calendar/view/?id=${id}`;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Human-friendly date/time range for an event, in the visitor's timezone. */
export function formatEventWhen(event: {
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
}): string {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const date = (value: Date) => value.toLocaleDateString(undefined, DATE_FORMAT);
  const time = (value: Date) => value.toLocaleTimeString(undefined, TIME_FORMAT);

  if (event.all_day) {
    return end && !sameDay(start, end) ? `${date(start)} – ${date(end)}` : date(start);
  }

  if (end && sameDay(start, end)) {
    return `${date(start)} · ${time(start)} – ${time(end)}`;
  }

  if (end) {
    return `${date(start)} ${time(start)} – ${date(end)} ${time(end)}`;
  }

  return `${date(start)} · ${time(start)}`;
}

/** Convert a stored timestamptz into the value a `datetime-local` input expects. */
export function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

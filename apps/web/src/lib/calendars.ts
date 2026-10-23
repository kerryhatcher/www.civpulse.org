import type { ElectionDateKind, ElectionVisibility } from './elections';

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
  is_meeting?: boolean;
  title: string;
  category?: string | null;
  updated_at?: string;
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
  election_id: string | null;
  election_date_kind: ElectionDateKind | null;
  election_name: string | null;
  election_slug: string | null;
  election_visibility: ElectionVisibility | null;
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
  is_meeting: boolean;
  calendar_id: string;
  title: string;
  category?: string | null;
  updated_at?: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  url: string | null;
  visibility: CalendarVisibility;
  election_id: string | null;
  election_date_kind: ElectionDateKind | null;
}

export const CALENDAR_COLUMNS = 'id, organization_id, slug, name, description, visibility';
export const EVENT_COLUMNS =
  'id, calendar_id, title, description, starts_at, ends_at, all_day, location, url, visibility, election_id, election_date_kind, category, is_meeting';

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

function sameDay(a: Date, b: Date, timeZone?: string): boolean {
  return a.toLocaleDateString('en-CA', { timeZone }) === b.toLocaleDateString('en-CA', { timeZone });
}

/** Human-friendly date/time range for an event, in the visitor's timezone. */
export function formatEventWhen(event: {
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
}, timeZone?: string): string {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(
    new Date(event.ends_at).getTime() - (event.all_day && event.ends_at > event.starts_at ? 1 : 0),
  ) : null;
  const date = (value: Date) => value.toLocaleDateString(undefined, { ...DATE_FORMAT, timeZone });
  const time = (value: Date) => value.toLocaleTimeString(undefined, { ...TIME_FORMAT, timeZone });

  if (event.all_day) {
    return end && !sameDay(start, end, timeZone) ? `${date(start)} – ${date(end)}` : date(start);
  }

  if (end && sameDay(start, end, timeZone)) {
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

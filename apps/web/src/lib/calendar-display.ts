import type { EventRecord } from './calendars';

export const CALENDAR_ZONE = 'America/New_York';
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: CALENDAR_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export function dayKey(value: string | Date): string {
  const parts = dayFormatter.formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
/** Midnight in New York, including the UTC offset on either side of DST. */
export function dayBoundary(day: string): string {
  const early = `${day}T04:00:00Z`;
  return dayKey(early) === day ? early : `${day}T05:00:00Z`;
}
export function monthWindow(month: string): { start: string; end: string; days: number; weekday: number } {
  const first = new Date(`${month}-01T12:00:00Z`);
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1, 12));
  return { start: `${month}-01`, end: next.toISOString().slice(0, 10), days: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(), weekday: first.getUTCDay() };
}
export function occursOn(event: EventRecord, day: string): boolean {
  const start = new Date(event.starts_at).getTime();
  const end = event.ends_at ? new Date(event.ends_at).getTime() : start;
  return start < Date.parse(dayBoundary(shiftDay(day, 1))) && Math.max(start, end - 1) >= Date.parse(dayBoundary(day));
}
export interface CalendarEvent extends EventRecord {
  memberships: { id: string; name: string; organization_id: string; organization_name: string }[];
  categories: string[];
}
/** Collapse imported copies of the same occurrence without exposing hidden memberships. */
export function groupEvents(events: EventRecord[]): CalendarEvent[] {
  const grouped = new Map<string, CalendarEvent>();
  for (const event of events) {
    const key = JSON.stringify([event.organization_id, event.title, event.starts_at, event.ends_at, event.location, event.url || event.description]);
    let item = grouped.get(key);
    if (!item) {
      item = { ...event, memberships: [], categories: [] };
      grouped.set(key, item);
    }
    if (!item.memberships.some(calendar => calendar.id === event.calendar_id)) item.memberships.push({ id: event.calendar_id, name: event.calendar_name, organization_id: event.organization_id, organization_name: event.organization_name });
    if (event.category && !item.categories.includes(event.category)) item.categories.push(event.category);
    if ((event.updated_at ?? '') > (item.updated_at ?? '')) item.updated_at = event.updated_at;
  }
  return [...grouped.values()];
}
export function calendarColor(key: string): string {
  const palette = ['#99452b', '#236b70', '#62558e', '#4e6c32', '#a54c73', '#3868a0', '#876018', '#73524c'];
  let hash = 0;
  for (const character of key) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return palette[(hash >>> 0) % palette.length];
}

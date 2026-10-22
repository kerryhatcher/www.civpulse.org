import { dayKey, groupEvents, shiftDay } from './calendar-display';
import type { EventRecord } from './calendars';

const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const timestamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
/** RFC 5545 folds lines at 75 UTF-8 octets, without splitting code points. */
function fold(line: string): string {
  let output = '', length = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (length + size > 75) { output += '\r\n '; length = 1; }
    output += character; length += size;
  }
  return output;
}
export function calendarIcs(records: EventRecord[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Civic Pulse//Community Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Civic Pulse community calendar', 'X-WR-TIMEZONE:America/New_York', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const event of groupEvents(records)) {
    // Stable identity and revision timestamps let subscribers update existing events.
    lines.push('BEGIN:VEVENT', `UID:${event.id}@civpulse.org`, `DTSTAMP:${timestamp(event.updated_at ?? event.starts_at)}`, `LAST-MODIFIED:${timestamp(event.updated_at ?? event.starts_at)}`);
    if (event.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${dayKey(event.starts_at).replaceAll('-', '')}`);
      // Stored ends are exclusive, as required by iCalendar.
      if (event.ends_at && event.ends_at > event.starts_at) lines.push(`DTEND;VALUE=DATE:${shiftDay(dayKey(new Date(new Date(event.ends_at).getTime() - 1)), 1).replaceAll('-', '')}`);
    } else {
      lines.push(`DTSTART:${timestamp(event.starts_at)}`);
      if (event.ends_at) lines.push(`DTEND:${timestamp(event.ends_at)}`);
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.categories.length) lines.push(`CATEGORIES:${event.categories.map(escapeText).join(',')}`);
    lines.push(`URL:https://www.civpulse.org/calendar/view/?id=${event.id}`, 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

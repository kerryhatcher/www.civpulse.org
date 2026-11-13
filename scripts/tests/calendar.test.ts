import { describe, expect, test } from 'bun:test';
import { dayBoundary, dayKey, groupEvents, monthWindow, occursOn } from '../../apps/web/src/lib/calendar-display';
import { calendarIcs } from '../../apps/web/src/lib/calendar-ics';
import { eventSourceUrl, formatEventWhen, type EventRecord } from '../../apps/web/src/lib/calendars';

const event: EventRecord = {
  id: '11111111-1111-4111-8111-111111111111', title: 'Community meeting', description: null,
  starts_at: '2026-10-22T14:00:00Z', ends_at: '2026-10-22T15:00:00Z', all_day: false,
  location: 'Library', url: null, visibility: 'public', calendar_id: 'a', calendar_name: 'Adults', calendar_slug: 'adults',
  calendar_visibility: 'public', organization_id: 'org', organization_name: 'Library', organization_slug: 'library',
  election_id: null, election_date_kind: null, election_name: null, election_slug: null, election_visibility: null,
  updated_at: '2026-10-20T14:00:00Z', category: 'Community',
};

describe('New York calendar dates', () => {
  test('DST transition midnights use the offset at midnight', () => {
    expect(dayBoundary('2026-03-08')).toBe('2026-03-08T05:00:00Z');
    expect(dayBoundary('2026-03-09')).toBe('2026-03-09T04:00:00Z');
    expect(dayBoundary('2026-11-01')).toBe('2026-11-01T04:00:00Z');
    expect(dayBoundary('2026-11-02')).toBe('2026-11-02T05:00:00Z');
    expect(dayKey('2026-10-01T02:00:00Z')).toBe('2026-09-30');
  });
  test('leap years and month rollover', () => {
    expect(monthWindow('2028-02').days).toBe(29);
    expect(monthWindow('2026-12').end).toBe('2027-01-01');
  });
  test('spanning events appear on each occupied day, excluding midnight end', () => {
    const spanning = { ...event, starts_at: '2026-10-31T22:00:00Z', ends_at: '2026-11-02T05:00:00Z' };
    expect(occursOn(spanning, '2026-10-31')).toBe(true);
    expect(occursOn(spanning, '2026-11-01')).toBe(true);
    expect(occursOn(spanning, '2026-11-02')).toBe(false);
    expect(occursOn({ ...event, ends_at: null }, '2026-10-22')).toBe(true);
  });
});

test('shared occurrences collapse with both calendar labels; different times stay separate', () => {
  const grouped = groupEvents([event, { ...event, id: 'b', calendar_id: 'b', calendar_name: 'Teens', category: 'Family' }, { ...event, id: 'c', starts_at: '2026-10-23T14:00:00Z' }]);
  expect(grouped).toHaveLength(2);
  expect(grouped[0].memberships.map(item => item.name)).toEqual(['Adults', 'Teens']);
  expect(grouped[0].categories).toEqual(['Community', 'Family']);
});

describe('subscribable ICS', () => {
  test('updates preserve UID and change revision; format is CRLF and escaped', () => {
    const before = calendarIcs([event]);
    const after = calendarIcs([{ ...event, title: 'Updated, meeting;\nDetails', updated_at: '2026-10-21T14:00:00Z' }]);
    expect(before.match(/UID:.*\r\n/)![0]).toBe(after.match(/UID:.*\r\n/)![0]);
    expect(after).toContain('LAST-MODIFIED:20261021T140000Z');
    expect(after).toContain('SUMMARY:Updated\\, meeting\\;\\nDetails');
    expect(after).toContain('DTSTART:20261022T140000Z');
    expect(after).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
    expect(after.replaceAll('\r\n', '')).not.toContain('\n');
  });
  test('folding respects UTF-8 octets and does not corrupt Unicode', () => {
    const title = 'Café 🌎 '.repeat(30);
    const ics = calendarIcs([{ ...event, title }]);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replaceAll('\r\n ', '')).toContain(`SUMMARY:${title}`);
  });
  test('all-day dates remain dates, including exclusive ends', () => {
    const ics = calendarIcs([{ ...event, starts_at: '2026-10-22T04:00:00Z', ends_at: '2026-10-24T04:00:00Z', all_day: true }]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261022');
    expect(ics).toContain('DTEND;VALUE=DATE:20261024');
  });
});

test('displayed date ranges use the same timezone as the calendar grid', () => {
  const when = formatEventWhen({ ...event, starts_at: '2026-10-23T03:00:00Z', ends_at: '2026-10-23T06:00:00Z' }, 'America/New_York');
  expect(when).toContain('Oct 22');
  expect(when).toContain('Oct 23');
  const allDay = formatEventWhen({ ...event, starts_at: '2026-10-22T04:00:00Z', ends_at: '2026-10-24T04:00:00Z', all_day: true }, 'America/New_York');
  expect(allDay).toContain('Oct 23');
  expect(allDay).not.toContain('Oct 24');
});

test('shared occurrences link to the copy carrying the meeting record', () => {
  const grouped = groupEvents([event, {...event,id:'meeting-copy',calendar_id:'second',calendar_name:'Council',is_meeting:true}]);
  expect(grouped).toHaveLength(1);
  expect(grouped[0].id).toBe('meeting-copy');
  expect(grouped[0].is_meeting).toBe(true);
  expect(grouped[0].memberships.map(item=>item.id)).toEqual(['a','second']);
});

test("event sources reject executable and malformed URLs",()=>{
 expect(eventSourceUrl("javascript:alert(1)")).toBeNull();
 expect(eventSourceUrl("data:text/html,unsafe")).toBeNull();
 expect(eventSourceUrl("not a URL")).toBeNull();
 expect(eventSourceUrl("https://example.org/event")).toBe("https://example.org/event");
});

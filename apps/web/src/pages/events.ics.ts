import type { APIRoute } from 'astro';
import { getPublicCalendarData } from '../lib/calendar-build-data';
import { calendarIcs } from '../lib/calendar-ics';

export const GET: APIRoute = async () => {
  const {events} = await getPublicCalendarData();
  return new Response(calendarIcs(events), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};

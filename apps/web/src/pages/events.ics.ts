import type { APIRoute } from 'astro';
import { getBuildSupabase } from '../lib/supabase-build';
import { calendarIcs } from '../lib/calendar-ics';
import type { EventRecord } from '../lib/calendars';

export const GET: APIRoute = async () => {
  const supabase = getBuildSupabase();
  const events: EventRecord[] = [];
  if (supabase) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.rpc('browse_calendar_events', { p_public_only: true, p_offset: offset });
      // Do not publish a silently empty/truncated feed when the backend fails.
      if (error) throw new Error(`Calendar feed build failed: ${error.message}`);
      const page = data as EventRecord[];
      events.push(...page);
      if (page.length < 500) break;
    }
  }
  return new Response(calendarIcs(events), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};

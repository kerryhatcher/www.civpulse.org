import { getPublicCalendarData } from './calendar-build-data';
import { getBuildSupabase } from './supabase-build';
import { loadPublicRecords } from './public-record-build-data';
let snapshot: ReturnType<typeof loadPublicRecords> | undefined;
let refreshAfter = 0;
export function getPublicRecordSnapshot() {
  const client = getBuildSupabase();
  if (!client) return Promise.resolve([]);
  if (import.meta.env.DEV && Date.now() >= refreshAfter) { snapshot = undefined; refreshAfter = Date.now() + 30000; }
  return snapshot ??= getPublicCalendarData().then(calendar=>loadPublicRecords(client,calendar));
}

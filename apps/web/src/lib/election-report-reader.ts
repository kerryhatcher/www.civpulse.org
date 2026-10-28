import { getSupabase } from './supabase';
import type { ResultReport } from './election-results';
const cache = new Map<string, Promise<ResultReport[]>>();
/** Page-session cache shares the visibility-gated reports with the precinct map. */
export function readElectionReports(electionId: string, refresh = false): Promise<ResultReport[]> {
  if (refresh) cache.delete(electionId);
  let pending = cache.get(electionId);
  if (!pending) {
    pending = load(electionId).catch(error => { cache.delete(electionId); throw error; });
    cache.set(electionId, pending);
  }
  return pending;
}
async function load(electionId: string): Promise<ResultReport[]> {
  const rows: ResultReport[] = [], ids = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await getSupabase().rpc('get_election_results', {
      p_election_id: electionId, p_history: false, p_offset: offset, p_limit: 100,
    });
    if (error) throw error;
    if (data?.status !== 'ok' || !Array.isArray(data.reports)) throw Error('Election reports unavailable');
    for (const report of data.reports as ResultReport[]) {
      if (ids.has(report.id)) throw Error('Election reports changed while loading; retry');
      ids.add(report.id); rows.push(report);
    }
    if (data.reports.length < 100) return rows;
  }
}

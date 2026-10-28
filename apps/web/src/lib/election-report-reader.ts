import { getSupabase } from "./supabase";
import type { ResultReport } from "./election-results";
type ReportPage = { status: string; reports: ResultReport[] };
type ReadPage = (electionId: string, offset: number) => Promise<ReportPage>;
async function readPage(
  electionId: string,
  offset: number,
): Promise<ReportPage> {
  const { data, error } = await getSupabase().rpc("get_election_results", {
    p_election_id: electionId,
    p_history: false,
    p_offset: offset,
    p_limit: 100,
  });
  if (error) throw error;
  return data as ReportPage;
}
/** Each page session shares one cache between the ballot and the precinct map. */
export function createElectionReportReader(page: ReadPage = readPage) {
  const cache = new Map<string, Promise<ResultReport[]>>();
  async function load(electionId: string) {
    const rows: ResultReport[] = [],
      ids = new Set<string>();
    for (let offset = 0; ; offset += 100) {
      const data = await page(electionId, offset);
      if (data?.status !== "ok" || !Array.isArray(data.reports))
        throw Error("Election reports unavailable");
      for (const report of data.reports) {
        if (ids.has(report.id))
          throw Error("Election reports changed while loading; retry");
        ids.add(report.id);
        rows.push(report);
      }
      if (data.reports.length < 100) return rows;
    }
  }
  return function readElectionReports(
    electionId: string,
    refresh = false,
  ): Promise<ResultReport[]> {
    if (refresh) cache.delete(electionId);
    let pending = cache.get(electionId);
    if (!pending) {
      pending = load(electionId).catch((error) => {
        if (cache.get(electionId) === pending) cache.delete(electionId);
        throw error;
      });
      cache.set(electionId, pending);
    }
    return pending;
  };
}
export const readElectionReports = createElectionReportReader();

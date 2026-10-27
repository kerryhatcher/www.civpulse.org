import { GEORGIA_COUNTIES } from './county-scope';

export type TurnoutCell = { value: number | null; display: string };
export type TurnoutRow = {
  table: string;
  county_fips: string;
  county_label: string;
  ballot_style: string;
  source_title: string;
  as_of_label: string | null;
  measures: Record<string, TurnoutCell>;
};
export type TurnoutPage = {
  status: string;
  rows: TurnoutRow[];
  total: number;
  report: { id: string; captured_at: string; source_url: string };
};

/** Keep each county's overlapping source views separate, including All counties. */
export function turnoutByCounty(rows: TurnoutRow[], county: string) {
  const groups = new Map<string, { id: string; label: string; rows: TurnoutRow[] }>();
  for (const row of rows) {
    if (county !== 'all' && row.county_fips !== county) continue;
    let group = groups.get(row.county_fips);
    if (!group) {
      group = { id: row.county_fips, label: GEORGIA_COUNTIES.find(item => item.fips === row.county_fips)?.name ?? row.county_label, rows: [] };
      groups.set(row.county_fips, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Pin subsequent pages to the first report so live imports cannot mix snapshots. */
export async function readTurnoutSnapshot(
  read: (reportId: string | null, offset: number) => Promise<TurnoutPage>,
): Promise<TurnoutPage> {
  const first = await read(null, 0);
  if (first.status !== 'ok') return first;
  const rows = [...first.rows];
  while (rows.length < first.total) {
    const page = await read(first.report.id, rows.length);
    if (page.status !== 'ok' || page.report.id !== first.report.id || !page.rows.length) {
      throw new Error('Incomplete turnout snapshot');
    }
    rows.push(...page.rows);
  }
  return { ...first, rows };
}

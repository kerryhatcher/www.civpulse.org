import { GEORGIA_COUNTIES } from './county-scope';
import type { Counts, ResultReport } from './election-results';

/** One current county overview per exact ballot style. Never roll up overlapping reports. */
export function ballotResultReports(reports: ResultReport[], county: string): ResultReport[] {
  const name = GEORGIA_COUNTIES.find(c => c.fips === county)?.name;
  const current = new Map<string, ResultReport>();
  for (const report of reports) {
    const scope = report.scope;
    const countyName = scope.county.replace(/ County$/i, '');
    if (scope.unit_type !== 'county' || scope.unit !== 'all' || scope.counting_group !== 'all'
      || (county !== 'all' && countyName !== name)) continue;
    const key = JSON.stringify([scope.county, scope.ballot_style]);
    const previous = current.get(key);
    if (!previous || report.observed_at > previous.observed_at
      || (report.observed_at === previous.observed_at && report.id > previous.id)) current.set(key, report);
  }
  return [...current.values()].sort((a, b) => a.scope.county.localeCompare(b.scope.county) || a.scope.ballot_style.localeCompare(b.scope.ballot_style));
}
export function precinctReporting(counts: Counts): string {
  const reported = counts.precincts_reported, total = counts.precincts_total;
  if (reported == null || !Number.isSafeInteger(reported) || reported < 0) return 'Precincts reporting: not reported';
  if (total == null || !Number.isSafeInteger(total) || total <= 0 || reported > total) return `${reported.toLocaleString('en-US')} precincts reporting · total not reported`;
  return `${reported.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} precincts reporting (${(100 * reported / total).toLocaleString('en-US', { maximumFractionDigits: 1 })}%)`;
}
export function choicePercent(votes: number, total: number | null | undefined): string {
  return total != null && total > 0 && votes >= 0 && votes <= total
    ? `${(100 * votes / total).toFixed(2)}%` : 'Not reported';
}

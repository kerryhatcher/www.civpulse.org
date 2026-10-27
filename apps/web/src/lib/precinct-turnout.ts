import type { ResultReport } from './election-results';

/** Never use contest registration, county totals or overlapping voting methods. */
export function precinctTurnout(reports: ResultReport[], style: string): Map<string, ResultReport> {
  const selected = new Map<string, ResultReport>();
  for (const report of reports) {
    if (report.scope.county !== 'Bibb' || report.scope.unit_type !== 'precinct'
      || report.scope.counting_group !== 'all' || report.scope.ballot_style !== style) continue;
    const previous = selected.get(report.scope.unit);
    if (!previous || report.observed_at > previous.observed_at) selected.set(report.scope.unit, report);
  }
  return selected;
}
export function turnoutRate(report?: ResultReport): number | null {
  const counts = report?.snapshot.turnout;
  const numerator = counts?.voters ?? counts?.ballots;
  const registered = counts?.registered;
  if (numerator == null || registered == null || !Number.isSafeInteger(numerator)
    || !Number.isSafeInteger(registered) || numerator < 0 || registered <= 0 || numerator > registered) return null;
  return 100 * numerator / registered;
}
/** A fixed scale across elections; missing data has a separate gray fill. */
export function turnoutFill(rate: number | null): { fillColor: string; fillOpacity: number } {
  return rate === null ? { fillColor: '#b8bcb0', fillOpacity: 0.6 }
    : { fillColor: '#173e34', fillOpacity: 0.08 + 0.92 * Math.min(100, Math.max(0, rate)) / 100 };
}

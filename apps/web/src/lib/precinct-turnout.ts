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
/** Fixed percentage bands keep the legend comparable as new reports arrive. */
export const TURNOUT_BANDS = [
  { min: 0, label: 'Under 10%', color: '#fff3bd' },
  { min: 10, label: '10–<15%', color: '#c8df8a' },
  { min: 15, label: '15–<20%', color: '#82bd69' },
  { min: 20, label: '20–<25%', color: '#36935b' },
  { min: 25, label: '25–<30%', color: '#116340' },
  { min: 30, label: '30%+', color: '#083b2b' },
] as const;
export const TURNOUT_MISSING_COLOR = '#b8bcb0';

/** Opaque colors preserve separation between bands on any map background. */
export function turnoutFill(rate: number | null): { fillColor: string; fillOpacity: number } {
  if (rate === null || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { fillColor: TURNOUT_MISSING_COLOR, fillOpacity: 1 };
  }
  const band = [...TURNOUT_BANDS].reverse().find(band => rate >= band.min)!;
  return { fillColor: band.color, fillOpacity: 1 };
}

import { expect, test } from 'bun:test';
import { precinctTurnout, turnoutRate, turnoutFill } from '../../apps/web/src/lib/precinct-turnout';
import type { ResultReport } from '../../apps/web/src/lib/election-results';
function report(turnout: object, scope = {}, observed_at = '2026-10-26') {
  return { scope: { county: 'Bibb', unit_type: 'precinct', unit: 'EM1', counting_group: 'all', ballot_style: 'all', ...scope }, observed_at, snapshot: { turnout, contests: [] } } as unknown as ResultReport;
}
test('requires a matching precinct denominator and preserves true zero', () => {
  expect(turnoutRate(report({ voters: 25, ballots: 30, registered: 100 }))).toBe(25);
  expect(turnoutRate(report({ ballots: 50, registered: 100 }))).toBe(50);
  expect(turnoutRate(report({ voters: 0, ballots: 30, registered: 100 }))).toBe(0);
  for (const counts of [{}, { ballots: 25 }, { ballots: 0, registered: 0 }, { ballots: 101, registered: 100 }, { ballots: -1, registered: 100 }]) expect(turnoutRate(report(counts))).toBeNull();
});
test('selects latest exact scope without summing methods or ballot styles', () => {
  const latest = report({ ballots: 20, registered: 100 });
  const selected = precinctTurnout([
    report({ ballots: 10, registered: 100 }, {}, '2026-10-25'), latest,
    report({ ballots: 90, registered: 100 }, { unit_type: 'county' }),
    report({ ballots: 90, registered: 100 }, { counting_group: 'advance' }),
    report({ ballots: 90, registered: 100 }, { ballot_style: 'Republican' }),
    report({ ballots: 90, registered: 100 }, { county: 'Other' }),
  ], 'all');
  expect(selected.size).toBe(1); expect(selected.get('EM1')).toBe(latest);
});
test('uses fixed opacity scale and separate missing fill', () => {
  expect(turnoutFill(0).fillOpacity).toBe(0.08);
  expect(turnoutFill(50).fillOpacity).toBeCloseTo(0.54);
  expect(turnoutFill(100).fillOpacity).toBe(1);
  expect(turnoutFill(null).fillColor).not.toBe(turnoutFill(0).fillColor);
});

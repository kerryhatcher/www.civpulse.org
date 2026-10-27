import { expect, test } from 'bun:test';
import { precinctTurnout, turnoutRate, turnoutFill, TURNOUT_BANDS, TURNOUT_MISSING_COLOR } from '../../apps/web/src/lib/precinct-turnout';
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
test('uses explicit opaque percentage bands with exact lower boundaries', () => {
  for (let i = 0; i < TURNOUT_BANDS.length; i++) {
    const band = TURNOUT_BANDS[i];
    expect(turnoutFill(band.min)).toEqual({ fillColor: band.color, fillOpacity: 1 });
    if (i > 0) expect(turnoutFill(band.min - 0.001).fillColor).toBe(TURNOUT_BANDS[i - 1].color);
  }
  expect(new Set(TURNOUT_BANDS.map(band => band.color)).size).toBe(TURNOUT_BANDS.length);
  expect(turnoutFill(50)).toEqual(turnoutFill(30));
  expect(turnoutFill(100)).toEqual(turnoutFill(30));
});
test('missing values stay distinct from zero and reported low turnout', () => {
  for (const rate of [null, NaN, Infinity, -1, 101]) {
    expect(turnoutFill(rate)).toEqual({ fillColor: TURNOUT_MISSING_COLOR, fillOpacity: 1 });
  }
  expect(turnoutFill(0).fillColor).not.toBe(TURNOUT_MISSING_COLOR);
  expect(turnoutFill(9.94).fillColor).not.toBe(turnoutFill(12.16).fillColor);
  expect(turnoutFill(16).fillColor).not.toBe(turnoutFill(22).fillColor);
});

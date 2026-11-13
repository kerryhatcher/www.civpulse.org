import { expect, test } from 'bun:test';
import { readTurnoutSnapshot, turnoutByCounty, type TurnoutPage, type TurnoutRow } from '../../apps/web/src/lib/election-turnout';
const page = (id: string, total: number, rows: unknown[]) => ({ status: 'ok', report: { id }, total, rows }) as TurnoutPage;
test('pins subsequent pages and preserves missing and zero counts without aggregating', async () => {
  const calls: unknown[] = [];
  const rows = [{ measures: { accepted: { value: null, display: '—' } } }, { measures: { accepted: { value: 0, display: '0' } } }];
  const result = await readTurnoutSnapshot(async (id, offset) => {
    calls.push([id, offset]);
    return page('original', 2, [rows[offset]]);
  });
  expect(calls).toEqual([[null, 0], ['original', 1]]);
  expect(result.rows).toEqual(rows);
});
test('does not present truncated or mixed snapshots', async () => {
  for (const next of [page('other', 2, [{}]), page('original', 2, [])]) {
    await expect(readTurnoutSnapshot(async (_, offset) => offset === 0 ? page('original', 2, [{}]) : next)).rejects.toThrow('Incomplete turnout snapshot');
  }
});
test('empty and inaccessible elections do not request more pages', async () => {
  for (const status of ['empty', 'missing']) {
    let calls = 0;
    const result = await readTurnoutSnapshot(async () => { calls++; return { status, rows: [] } as unknown as TurnoutPage; });
    expect(result.status).toBe(status);
    expect(calls).toBe(1);
  }
});

test('site county selection keeps source views separate and never falls back to another county', () => {
  const row = (id: string, table: string, value: number | null): TurnoutRow => ({
    county_fips: id, county_label: id === '13021' ? 'BIBB' : 'JONES', table,
    ballot_style: 'Early In-Person', source_title: 'Test source', as_of_label: null,
    measures: { accepted: { value, display: value === null ? '—' : String(value) } },
  });
  const rows = [row('13169', 'turnout', null), row('13021', 'turnout', 0), row('13021', 'early', 12)];
  expect(turnoutByCounty(rows, '13021')).toEqual([{ id: '13021', label: 'Bibb', rows: [rows[1], rows[2]] }]);
  expect(turnoutByCounty(rows, '13169')).toEqual([{ id: '13169', label: 'Jones', rows: [rows[0]] }]);
  expect(turnoutByCounty(rows, '13051')).toEqual([]);
  expect(turnoutByCounty([], 'all')).toEqual([]);
  const all = turnoutByCounty(rows, 'all');
  expect(all.map(group => group.id)).toEqual(['13021', '13169']);
  expect(all[0].rows).toEqual([rows[1], rows[2]]);
  expect(all[1].rows[0].measures.accepted.value).toBeNull();
  expect(all[0].rows[0].measures.accepted.value).toBe(0);
});

test('summary preserves zero/missing counts and does not combine overlapping source tables', async () => {
  const { turnoutSummary } = await import('../../apps/web/src/lib/election-turnout');
  const row = (table: string, value: number | null): TurnoutRow => ({
    county_fips: '13021', county_label: 'BIBB', table, ballot_style: 'Early In-Person',
    source_title: 'Source', as_of_label: null, measures: { turnout: { value, display: String(value) } },
  });
  const snapshot: TurnoutPage = { status: 'ok', total: 2, report: { id: 'x', captured_at: '2026-10-27T00:00:00Z', source_url: 'https://example.org' }, rows: [row('turnout', 0), row('early', 500)] };
  expect(turnoutSummary(snapshot, '13021')).toContain('Early In-Person: 0 ballots');
  expect(turnoutSummary(snapshot, '13021')).not.toContain('500');
  snapshot.rows[0].measures.turnout.value = null;
  expect(turnoutSummary(snapshot, '13021')).toContain('Not reported');
  expect(turnoutSummary(snapshot, '13169')).toContain('No turnout is reported');
  expect(turnoutSummary(snapshot, 'all')).toContain('1 county');
  expect(turnoutSummary({ ...snapshot, rows: [] }, '13021')).toContain('No structured turnout');
});

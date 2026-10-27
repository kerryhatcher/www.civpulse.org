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

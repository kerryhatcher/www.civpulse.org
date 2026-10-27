import { expect, test } from 'bun:test';
import { readTurnoutSnapshot, type TurnoutPage } from '../../apps/web/src/lib/election-turnout';
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

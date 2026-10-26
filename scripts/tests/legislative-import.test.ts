import { expect, test } from 'bun:test';
import { parseLegislativeImport } from '../../apps/web/src/lib/legislative-import';
const row = (id: number) => ({ table: 'legislative_votes', data: { source_system: 'test', source_id: String(id) } });
test('imports split at the API limit and preserve parent-first order', () => {
  const rows = Array.from({length: 201}, (_, i) => row(i));
  const batches = parseLegislativeImport(JSON.stringify(rows));
  expect(batches.map(batch => batch.length)).toEqual([100, 100, 1]);
  expect(batches.flat()).toEqual(rows);
});
test('imports reject unsafe structure, missing provider identity and duplicate keys before saving', () => {
  for (const rows of [[], [row(1),row(1)], [{table: 'admins',data:{source_system:'x',source_id:'1'}}], [{table:'bills',data:{}}], [{...row(1),data:{...row(1).data,created_at:'today'}}]]) {
    expect(() => parseLegislativeImport(JSON.stringify(rows))).toThrow();
  }
});
test('batch sizes include UTF-8 bytes, brackets and separators without losing records', () => {
  const rows = [1, 2, 3].map(id => ({ ...row(id), data: { ...row(id).data, question: 'é'.repeat(475_000) } }));
  const batches = parseLegislativeImport(JSON.stringify(rows));
  expect(batches.map(batch => batch.length)).toEqual([1, 1, 1]);
  expect(batches.flat()).toEqual(rows);
  for (const batch of batches) expect(new TextEncoder().encode(JSON.stringify(batch)).length).toBeLessThanOrEqual(1_900_000);
  expect(() => parseLegislativeImport(JSON.stringify([{ ...row(1), data: { ...row(1).data, question: 'é'.repeat(950_000) } }]))).toThrow('API batch limit');
});

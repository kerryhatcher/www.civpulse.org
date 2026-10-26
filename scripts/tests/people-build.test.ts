import { expect, test } from 'bun:test';
import { fetchPublicAffiliationsByPerson } from '../../apps/web/src/lib/people';

test('profile build batches people and retains affiliations beyond one API page', async () => {
  const ids = Array.from({ length: 101 }, (_, index) => `person-${index}`);
  const calls: { ids: string[]; offset: number }[] = [];
  let active = 0;
  let maxActive = 0;
  const client = { from() {
    let selected: string[] = [];
    const query = {
      select() { return query; }, order() { return query; },
      in(_key: string, values: string[]) { selected = values; return query; },
      async range(offset: number) {
        calls.push({ ids: selected, offset });
        maxActive = Math.max(maxActive, ++active);
        await Promise.resolve(); active--;
        const count = selected.includes(ids[0]!) && offset === 0 ? 1000 : 1;
        return { error: null, data: Array.from({ length: count }, (_, index) => ({
          person_id: selected[0], role: 'Member',
          organization: { id: `org-${offset + index}`, name: offset ? 'Alpha' : 'Zebra', slug: 'org' },
        })) };
      },
    };
    return query;
  } };
  const grouped = await fetchPublicAffiliationsByPerson([...ids, ids[0]!], client as never);
  expect(calls.map(call => [call.ids.length, call.offset])).toEqual([[100, 0], [100, 1000], [1, 0]]);
  expect(maxActive).toBe(1);
  expect(grouped.get(ids[0]!)?.length).toBe(1001);
  expect(grouped.get(ids[0]!)?.[0]?.name).toBe('Alpha');
  expect(grouped.get(ids[1]!)).toEqual([]);
  expect(grouped.size).toBe(101);
});

test('profile build refuses to publish incomplete affiliations on API failure', async () => {
  const query = {
    select() { return query; }, in() { return query; }, order() { return query; },
    range: async () => ({ data: null, error: { message: 'statement timeout' } }),
  };
  await expect(fetchPublicAffiliationsByPerson(['person'], { from: () => query } as never))
    .rejects.toThrow('Could not build profile affiliations: statement timeout');
  expect((await fetchPublicAffiliationsByPerson(['person'], null)).get('person')).toEqual([]);
});

import { expect, test } from 'bun:test';
import { loadProfileBuildData } from '../../apps/web/src/lib/profile-build-data';

type Client = Parameters<typeof loadProfileBuildData>[0];

function fixtureClient(failPage = false) {
  const people = Array.from({ length: 1101 }, (_, i) => ({
    id: `person-${i}`, full_name: `Person ${i}`, visibility: i === 1100 ? 'private' : 'public',
  }));
  const affiliations = Array.from({ length: 1101 }, (_, i) => ({ person_id: `person-${i}`, organization_id: 'org', role: 'Member' }));
  const tables: Record<string, object[]> = { people, person_organizations: affiliations, organizations: [{ id: 'org', slug: 'org', name: 'Organization' }] };
  let active = 0, peak = 0, calls = 0;
  const client = {
    from(table: string) {
      let rows = tables[table];
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) {
          rows = rows.filter(row => (row as Record<string, unknown>)[column] === value);
          return query;
        },
        order() { return query; },
        async range(from: number, to: number) {
          calls++; peak = Math.max(peak, ++active);
          await new Promise(resolve => setTimeout(resolve, 1));
          active--;
          if (failPage && table === 'people' && from === 500) return { data: null, error: { message: 'backend unavailable' } };
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  } as unknown as Client;
  return { client, stats: () => ({ peak, calls }) };
}

test('profiles retain affiliations past the API row cap without publishing hidden people or request fan-out', async () => {
  const fixture = fixtureClient();
  const result = await loadProfileBuildData(fixture.client);
  expect(result.people).toHaveLength(1100);
  expect(result.byPerson.get('person-1099')).toEqual([{ id: 'org', slug: 'org', name: 'Organization', role: 'Member' }]);
  expect(result.byPerson.has('person-1100')).toBe(false);
  expect(result.byOrganization.get('org')).toHaveLength(1100);
  expect(fixture.stats()).toEqual({ peak: 3, calls: 7 });
});

test('a later-page backend failure rejects the snapshot instead of publishing partial profiles', async () => {
  const fixture = fixtureClient(true);
  await expect(loadProfileBuildData(fixture.client)).rejects.toThrow('backend unavailable');
});

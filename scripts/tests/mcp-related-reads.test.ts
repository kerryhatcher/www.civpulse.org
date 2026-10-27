import { expect, test } from 'bun:test';
import { registerCommonReadTools } from '../../apps/mcp/src/common-read-tools';
import { registerExtendedTools } from '../../apps/mcp/src/extended-tools';
import { registerOfficeTools } from '../../apps/mcp/src/office-tools';
import { RelatedReadCatalog, relatedReads, compactRelatedReadReplacement } from '../../apps/mcp/src/related-read-catalog';

const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const inputs: Record<keyof typeof relatedReads, Record<string, unknown>> = {
  get_map_layers: { map_id: id }, get_person_articles: { person_id: id },
  get_organization_articles: { organization_id: id }, get_person_candidacies: { person_id: id },
  list_person_organizations: { person_id: id }, list_contests: { election_id: id },
  list_ballot_questions: { election_id: id }, list_contest_candidates: { contest_id: id },
  get_contest_candidate: { contest_id: id, person_id: other }, list_map_layer_links: { map_id: id },
  get_organization_relationships: { organization_id: id }, list_article_people: { article_id: id },
  list_article_organizations: { article_id: id }, list_calendars: { organization_id: id },
  get_office_terms: { person_id: id, organization_id: other },
};
const adminReads = ['list_map_layer_links', 'list_article_people', 'list_article_organizations'];
function setup(compact: boolean, admin = false, status = 'ok', error?: string) {
  const handlers = new Map<string, any>(), schemas = new Map<string, any>(), calls: any[] = [];
  const server: any = { registerTool(name: string, schema: any, handler: any) { schemas.set(name, schema); handlers.set(name, handler); } };
  const rows = [{ id, position: 2, style: { color: 'red' }, role: 'Author', source_url: 'https://example.test/source' }];
  const envelope = { status, organizations: status === 'ok' ? rows : [], contests: status === 'ok' ? rows : [], ballot_questions: status === 'ok' ? rows : [], contest: status === 'ok' ? { candidates: [{ person: { id: other }, party: 'Independent', is_write_in: true }] } : null };
  const supabase: any = {
    rpc: async (name: string, args: any) => {
      calls.push([name, args]);
      return { data: name === 'is_admin' ? admin : ['get_person', 'get_election', 'mcp_get_record'].includes(name) ? envelope : status === 'ok' ? rows : [], error: name !== 'is_admin' && error ? { message: error } : null };
    },
    from: (table: string) => {
      calls.push(['from', table]);
      const q: any = {};
      for (const method of ['select', 'eq', 'order']) q[method] = (...args: any[]) => { calls.push([method, ...args]); return q; };
      q.then = (resolve: any) => Promise.resolve({ data: rows, error: error ? { message: error } : null }).then(resolve);
      return q;
    },
  };
  const related = compact ? new RelatedReadCatalog() : undefined;
  registerCommonReadTools(server, supabase, compact ? 'compact' : 'legacy', related);
  registerExtendedTools(server, supabase, { id }, undefined, related);
  registerOfficeTools(server, supabase, undefined, related);
  related?.register(server);
  return { calls, schemas, handlers, call: async (name: string, args: any) => handlers.get(name)(schemas.get(name).inputSchema.parse(args)) };
}
for (const [name, input] of Object.entries(inputs)) {
  test(`${name} retains handler, output envelope, status and caller access`, async () => {
    for (const admin of [false, true]) for (const status of ['ok', 'private', 'missing']) {
      const legacy = setup(false, admin, status), compact = setup(true, admin, status);
      const replacement = compactRelatedReadReplacement(name, input)!;
      const expected = await legacy.call(name, input);
      const actual = await compact.call(replacement.name, replacement.arguments);
      expect(actual).toEqual(expected);
      expect(compact.calls).toEqual(legacy.calls);
      if (!admin && adminReads.includes(name)) {
        expect(actual.isError).toBe(true);
        expect(compact.calls).toEqual([['is_admin', undefined]]);
      }
    }
  });
}
test('unfiltered calendars and office term selector combinations preserve exact arguments and failure behavior', async () => {
  for (const [name, args] of [
    ['list_calendars', {}], ['list_calendars', { organization_id: null }],
    ['get_office_terms', {}], ['get_office_terms', { person_id: id }],
    ['get_office_terms', { organization_id: id }], ['get_office_terms', { person_id: id, organization_id: other }],
  ] as const) {
    const a = setup(false), b = setup(true), target = compactRelatedReadReplacement(name, args)!;
    expect(await b.call(target.name, target.arguments)).toEqual(await a.call(name, args));
    expect(b.calls).toEqual(a.calls);
    if (name === 'get_office_terms' && !Object.keys(args).length) expect(b.calls).toHaveLength(0);
  }
});
test('invalid selectors, UUIDs, cross-relation keys and unsupported pagination fail before any query', async () => {
  const { call, calls } = setup(true);
  for (const request of [
    { relation: 'accounts', person_id: id }, { relation: 'person_articles', person_id: 'invalid' },
    { relation: 'person_articles', organization_id: id }, { relation: 'map_layers' },
    { relation: 'article_people', article_id: id, person_id: other },
    { relation: 'person_articles', person_id: id, offset: 1 },
    { relation: 'calendars', include_private: true },
    { relation: 'contest_candidate', contest_id: id },
    { relation: 'office_terms', person_id: id, limit: 1 },
  ]) await expect(call('read_related_records', { request })).rejects.toThrow();
  expect(calls).toHaveLength(0);
});
test('RPC and table failures remain tool errors; a singular missing candidate remains missing', async () => {
  for (const name of ['get_person_articles', 'list_article_people']) {
    const a = setup(false, true, 'ok', 'Read failed'), b = setup(true, true, 'ok', 'Read failed');
    const target = compactRelatedReadReplacement(name, inputs[name as keyof typeof inputs])!;
    const result = await b.call(target.name, target.arguments);
    expect(result).toEqual(await a.call(name, inputs[name as keyof typeof inputs]));
    expect(result.isError).toBe(true);
  }
  const b = setup(true), target = compactRelatedReadReplacement('get_contest_candidate', { contest_id: id, person_id: id })!;
  expect(JSON.parse((await b.call(target.name, target.arguments)).content[0].text)).toEqual({ status: 'missing' });
});
test('only planned related reads are replaced and the new tool has read-only annotations', () => {
  const { handlers, schemas } = setup(true);
  for (const name of Object.keys(relatedReads)) expect(handlers.has(name)).toBe(false);
  for (const name of ['get_layer_geojson', 'search_layer_features', 'search_users', 'get_person_meeting_votes', 'get_person_legislative_record', 'list_offices']) {
    expect(compactRelatedReadReplacement(name, {})).toBeUndefined();
  }
  expect(schemas.get('read_related_records').annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
});

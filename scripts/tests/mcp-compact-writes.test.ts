import { expect, test } from 'bun:test';
import { buildServer } from '../../apps/mcp/src/tools';
import { compactWriteReplacement, relationshipKinds, saveResources } from '../../apps/mcp/src/write-catalog';
import { Client } from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { InMemoryTransport } from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';

const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const geometry = { type: 'Point', coordinates: [-83.63, 32.83] };
const creates: Record<string, Record<string, unknown>> = {
  organization: { slug: 'organization', name: 'Organization' },
  calendar: { organization_id: id, slug: 'calendar', name: 'Calendar' },
  event: { calendar_id: id, title: 'Meeting', starts_at: '2026-10-26T12:00:00Z', is_meeting: true },
  person: { slug: 'person', full_name: 'Person' },
  election: { slug: 'election', name: 'Election', election_date: '2026-11-03' },
  map: { slug: 'map', name: 'Map' },
  layer: { name: 'Layer', source_url: 'https://example.test/data.geojson' },
  contest: { election_id: id, office: 'Mayor' },
  ballot_question: { election_id: id, title: 'Question', question_text: 'Should it pass?' },
  article: { title: 'Article', url: 'https://example.test/article', people: [{ person_id: id }], organizations: [] },
  layer_feature: { layer_id: id, geometry, feature_id: 'source-id' },
  office: { organization_id: id, name: '  Mayor  ' },
  office_term: { office_id: id, person_id: other, selection_method: 'elected', starts_on: '2021-01-01' },
};
const updates: Record<string, Record<string, unknown>> = {
  ...Object.fromEntries(saveResources.map(resource => [resource, { id, description: null }])),
  event: { id, meeting_video_start_seconds: 0, meeting_transcript: null },
  person: { id, phone: null },
  article: { id, published_on: null, people: [], organizations: [{ organization_id: id, role: 'publisher' }] },
  layer: { id, source_url: null, presentation: { popup: true } },
  layer_feature: { layer_id: id, id: '9007199254740993', feature_id: null, properties: { district: 4 } },
  office_term: { id, ends_on: null },
};
const relationships: Record<string, { create: Record<string, unknown>; update: Record<string, unknown>; delete: Record<string, unknown> }> = {
  map_layer: { create: { map_id: id, layer_id: other, position: 3 }, update: { map_id: id, layer_id: other, style: null, visible_by_default: false }, delete: { map_id: id, layer_id: other } },
  contest_candidate: { create: { contest_id: id, person_id: other, is_write_in: true }, update: { contest_id: id, person_id: other, party: null, status: 'won' }, delete: { contest_id: id, person_id: other } },
  person_organization: { create: { person_id: id, organization_id: other, role: 'Mayor' }, update: { person_id: id, organization_id: other, role: 'Former mayor' }, delete: { person_id: id, organization_id: other } },
  organization_relationship: { create: { organization_id: id, related_organization_id: other, relationship: 'Board', reverse_relationship: 'District' }, update: { id, related_organization_id: other, reverse_relationship: '  Updated district  ', source_url: null }, delete: { id } },
  article_person: { create: { article_id: id, person_id: other, role: 'author' }, update: { article_id: id, person_id: other, role: '  subject  ' }, delete: { article_id: id, person_id: other } },
  article_organization: { create: { article_id: id, organization_id: other, role: 'publisher' }, update: { article_id: id, organization_id: other, role: 'mention' }, delete: { article_id: id, organization_id: other } },
};
async function setup(catalog: 'legacy' | 'compact', admin = true, error?: string) {
  const calls: any[] = [];
  const supabase = {
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args]);
      return { data: name === 'is_admin' ? admin : name === 'mcp_save_layer_feature' ? '9007199254740993' : id, error: name !== 'is_admin' && error ? { message: error } : null };
    },
    from: (table: string) => {
      calls.push(['from', table]);
      const query: any = {};
      let values = {};
      for (const method of ['insert', 'update', 'delete', 'select', 'eq']) query[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        if (method === 'insert' || method === 'update') values = args[0] as object;
        return query;
      };
      query.single = async () => ({ data: { id, ...values }, error: error ? { message: error } : null });
      query.then = (resolve: any) => Promise.resolve({ data: [{ id }], error: error ? { message: error } : null }).then(resolve);
      return query;
    },
  };
  const server = buildServer(supabase as never, { id }, {}, undefined, catalog);
  const client = new Client({ name: 'compact-write-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  return { calls, client, close: async () => { await client.close(); await server.close(); } };
}
async function compare(name: string, input: Record<string, unknown>, admin: boolean, error?: string) {
  const legacy = await setup('legacy', admin, error), compact = await setup('compact', admin, error);
  try {
    const replacement = compactWriteReplacement(name, input)!;
    const a = await legacy.client.callTool({ name, arguments: input });
    const b = await compact.client.callTool(replacement);
    expect(b).toEqual(a);
    expect(Boolean(b.isError)).toBe(!admin || Boolean(error));
    expect(compact.calls).toEqual(legacy.calls);
    if (!admin) expect(compact.calls).toEqual([['is_admin', undefined]]);
    return compact.calls;
  } finally { await legacy.close(); await compact.close(); }
}
for (const resource of saveResources) {
  for (const operation of ['create', 'update'] as const) test(`${operation} ${resource} preserves payloads/returns and denies regular users`, async () => {
    const input = operation === 'create' ? creates[resource] : updates[resource];
    await compare(`${operation}_${resource}`, input, true);
    await compare(`${operation}_${resource}`, input, false);
  });
}
for (const relationship of relationshipKinds) {
  for (const operation of ['create', 'update', 'delete'] as const) test(`${operation} ${relationship} preserves keys/attributes and denies regular users`, async () => {
    await compare(`${operation}_${relationship}`, relationships[relationship][operation], true);
    await compare(`${operation}_${relationship}`, relationships[relationship][operation], false);
  });
}
test('omitted article association sets stay omitted; empty sets and null dates reach the atomic RPC unchanged', async () => {
  for (const input of [{ id, title: 'Title only' }, { id, people: [], published_on: null }]) {
    const calls = await compare('update_article', input, true);
    expect(calls.at(-1)).toEqual(['mcp_save_article', { p_article: 'title' in input ? { id, title: input.title } : { id, published_on: null }, p_people: 'people' in input ? [] : null, p_organizations: null }]);
  }
});
test('database errors stay errors and no-op updates never write', async () => {
  await compare('update_article', { id, title: 'Title' }, true, 'Transaction rolled back');
  await compare('update_person', { id, full_name: 'Name' }, true, 'Permission denied');
  const compact = await setup('compact');
  try {
    for (const resource of saveResources) {
      const keys = resource === 'layer_feature' ? { id: '1', layer_id: id } : { id };
      const result = await compact.client.callTool(compactWriteReplacement(`update_${resource}`, keys)!);
      expect(result.isError).toBe(true);
    }
    for (const relationship of relationshipKinds) {
      const result = await compact.client.callTool(compactWriteReplacement(`update_${relationship}`, relationships[relationship].delete)!);
      expect(result.isError).toBe(true);
    }
    expect(compact.calls.every(([name]) => name === 'is_admin')).toBe(true);
  } finally { await compact.close(); }
});
test('operation-specific schemas reject missing keys, extra fields and deletes in save tools before DB access', async () => {
  const compact = await setup('compact');
  try {
    const invalid = [
      { name: 'save_person', arguments: { request: { operation: 'create', full_name: 'Missing slug' } } },
      { name: 'save_person', arguments: { request: { operation: 'update', full_name: 'Missing ID' } } },
      { name: 'save_person', arguments: { request: { operation: 'delete', id } } },
      { name: 'save_person', arguments: { request: { operation: 'create', ...creates.person, id } } },
      { name: 'save_person', arguments: { request: { operation: 'update', id, admin: true } } },
      { name: 'save_layer', arguments: { request: { operation: 'update', id, geojson: {} } } },
      { name: 'save_office_term', arguments: { request: { operation: 'create', ...creates.office_term, starts_on: '2026-02-30' } } },
      { name: 'save_layer_feature', arguments: { request: { operation: 'update', id: 9007199254740993, layer_id: id, properties: {} } } },
      { name: 'save_relationship', arguments: { request: { relationship: 'person_organization', change: { operation: 'update', person_id: id, role: 'Mayor' } } } },
      { name: 'save_relationship', arguments: { request: { relationship: 'map_layer', change: { operation: 'delete', map_id: id, layer_id: other } } } },
      { name: 'delete_relationship', arguments: { request: { relationship: 'map_layer', map_id: id } } },
      { name: 'delete_relationship', arguments: { request: { relationship: 'organization_relationship', id, organization_id: other } } },
      { name: 'save_relationship', arguments: { request: { relationship: 'admins', change: { operation: 'create', user_id: id } } } },
    ];
    for (const input of invalid) expect((await compact.client.callTool(input)).isError).toBe(true);
    expect(compact.calls).toHaveLength(0);
  } finally { await compact.close(); }
});
test('only explicit aliases are replaced; save annotations do not promise retry-safe creation', async () => {
  expect(compactWriteReplacement('update_my_profile', {})).toBeUndefined();
  expect(compactWriteReplacement('delete_person', { id })).toBeUndefined();
  expect(compactWriteReplacement('save_postgis_layer', {})).toBeUndefined();
  const compact = await setup('compact');
  try {
    const tools = (await compact.client.listTools()).tools;
    for (const tool of tools.filter(x => x.name === 'save_relationship' || saveResources.some(r => x.name === `save_${r}`))) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: false });
    }
    expect(tools.find(x => x.name === 'delete_relationship')?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
    for (const resource of [...saveResources, ...relationshipKinds]) {
      expect(tools.some(x => x.name === `create_${resource}` || x.name === `update_${resource}`)).toBe(false);
    }
    expect(tools.some(x => x.name === 'delete_person')).toBe(true);
  } finally { await compact.close(); }
});

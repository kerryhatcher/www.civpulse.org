import { expect, test } from 'bun:test';
import { registerCommonReadTools, type ToolCatalog } from '../../apps/mcp/src/common-read-tools';
import { buildServer } from '../../apps/mcp/src/tools';
import { compactWriteReplacement } from '../../apps/mcp/src/write-catalog';
import { compactRelatedReadReplacement } from '../../apps/mcp/src/related-read-catalog';
import { Client } from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { InMemoryTransport } from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';

const id = '00000000-0000-4000-8000-000000000001';
function setup(catalog: ToolCatalog, status = 'ok', error: string | null = null) {
  const handlers = new Map<string, any>();
  const schemas = new Map<string, any>();
  const calls: any[] = [];
  registerCommonReadTools({ registerTool(name: string, schema: any, handler: any) {
    handlers.set(name, handler); schemas.set(name, schema);
  } } as never, { rpc: async (name: string, args: any) => {
    calls.push([name, args]);
    return { data: name === 'get_map_layers' ? [{ id, effective_style: { color: 'red' } }] : { status, source: name, args: Object.fromEntries(Object.entries(args).sort()), affiliations: [id], contests: [id] }, error: error ? { message: error } : null };
  } } as never, catalog);
  return { calls, schemas, call: async (name: string, args: any) => handlers.get(name)(schemas.get(name).inputSchema.parse(args)) };
}

const directories = { organization: 'organizations', person: 'people', map: 'maps', election: 'elections', event: 'events' };
for (const [type, plural] of Object.entries(directories)) {
  test(`directory ${type} preserves legacy defaults, limits, filters and response`, async () => {
    const legacy = setup('legacy'), compact = setup('compact');
    for (const args of [{}, { query: 'civic', limit: type === 'person' || type === 'organization' ? 50 : 100 },
      ...(type === 'event' ? [{ query: 'history', organization_id: id, calendar_id: id, include_past: true, limit: 10 }] : [])]) {
      expect(await compact.call('search_site', { ...args, mode: 'directory', type })).toEqual(await legacy.call(`search_${plural}`, args));
    }
    expect(compact.calls).toEqual(legacy.calls);
  });
}
const types = ['organization', 'person', 'election', 'contest', 'ballot_question', 'article', 'map', 'layer', 'calendar', 'event'];
for (const type of types) {
  test(`${type} getter preserves envelopes and hidden/missing states`, async () => {
    for (const status of ['ok', 'missing', 'private']) {
      const legacy = setup('legacy', status), compact = setup('compact', status);
      expect(await compact.call('get_civic_record', { type, id })).toEqual(await legacy.call(`get_${type}`, { id }));
      expect(compact.calls).toEqual(legacy.calls);
      if (type === 'map') expect(compact.calls.length).toBe(status === 'ok' ? 2 : 1);
    }
  });
}
test('site searches and five paginated aliases retain filters, defaults and results', async () => {
  const legacy = setup('legacy'), compact = setup('compact');
  for (const type of [undefined, ...types]) {
    const args = { query: 'needle', type, limit: 8, offset: 16 };
    expect(await compact.call('search_site', args)).toEqual(await legacy.call('search_site', args));
  }
  for (const type of ['calendar', 'layer', 'article', 'contest', 'ballot_question']) {
    const plural = type === 'ballot_question' ? 'ballot_questions' : `${type}s`;
    expect(await compact.call('search_site', { type, query: 'needle', offset: 10 })).toEqual(await legacy.call(`search_${plural}`, { query: 'needle', offset: 10 }));
  }
  expect(compact.calls).toEqual(legacy.calls);
});
test('invalid combinations fail without broadening or silently dropping filters', async () => {
  const { call, calls, schemas } = setup('compact');
  for (const args of [
    { organization_id: id }, { include_past: false },
    { mode: 'directory' }, { mode: 'directory', type: 'article' },
    { mode: 'directory', type: 'event', offset: 1 },
    { mode: 'directory', type: 'person', include_past: true },
    { mode: 'directory', type: 'organization', limit: 51 }, { query: 'x'.repeat(501) },
  ]) expect((await call('search_site', args)).isError).toBe(true);
  expect(() => schemas.get('get_civic_record').inputSchema.parse({ type: 'profiles', id })).toThrow();
  expect(() => schemas.get('get_civic_record').inputSchema.parse({ type: 'person', id: 'invalid' })).toThrow();
  expect(calls).toHaveLength(0);
});
test('database errors remain tool errors', async () => {
  const { call } = setup('compact', 'ok', 'Permission denied');
  expect((await call('get_civic_record', { type: 'person', id })).isError).toBe(true);
  expect((await call('search_site', {})).isError).toBe(true);
});
test('compact catalog replaces only planned reads/writes; all other schemas remain identical', async () => {
  async function catalog(mode: ToolCatalog) {
    const server = buildServer({} as never, { id }, {}, undefined, mode);
    const client = new Client({ name: 'catalog-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    try { await server.connect(a); await client.connect(b); return (await client.listTools()).tools; }
    finally { await client.close(); await server.close(); }
  }
  const legacy = await catalog('legacy'), compact = await catalog('compact');
  expect(legacy).toHaveLength(128);
  expect(compact).toHaveLength(66);
  const removed = new Set([...Object.values(directories).map(x => `search_${x}`), ...['calendars', 'layers', 'articles', 'contests', 'ballot_questions'].map(x => `search_${x}`), ...types.map(x => `get_${x}`)]);
  for (const tool of legacy) {
    if (removed.has(tool.name) || tool.name === 'search_site' || compactWriteReplacement(tool.name, {}) || compactRelatedReadReplacement(tool.name, {})) continue;
    expect(compact.find(x => x.name === tool.name)).toEqual(tool);
  }
  expect(compact.some(x => removed.has(x.name))).toBe(false);
  expect(compact.find(x => x.name === 'get_civic_record')?.annotations?.readOnlyHint).toBe(true);
});

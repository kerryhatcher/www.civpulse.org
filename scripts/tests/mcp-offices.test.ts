import { expect, test } from 'bun:test';
import { registerOfficeTools } from '../../apps/mcp/src/office-tools';

const id = '00000000-0000-4000-8000-000000000001';
function setup(admin = true) {
  const handlers = new Map<string, any>();
  const schemas = new Map<string, any>();
  const calls: any[] = [];
  const query: any = {};
  for (const method of ['select', 'order', 'eq', 'range', 'insert', 'update']) {
    query[method] = (...args: any[]) => { calls.push([method, ...args]); return query; };
  }
  query.single = async () => ({ data: { id }, error: null });
  query.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
  registerOfficeTools({ registerTool(name: string, schema: any, handler: any) {
    handlers.set(name, handler); schemas.set(name, schema);
  } } as never, {
    rpc: async (name: string, args: any) => {
      calls.push([name, args]); return { data: name === 'is_admin' ? admin : [], error: null };
    },
    from: (table: string) => { calls.push(['from', table]); return query; },
  } as never);
  return { calls, schemas, call: (name: string, args: any) => handlers.get(name)(schemas.get(name).inputSchema.parse(args)) };
}

test('office reads forward visibility filters and bound office pagination', async () => {
  const { call, calls } = setup(false);
  expect((await call('get_office_terms', {})).isError).toBe(true);
  expect(calls).toHaveLength(0);
  await call('get_office_terms', { person_id: id });
  expect(calls.at(-1)).toEqual(['get_office_terms', { p_person_id: id, p_organization_id: null }]);
  await call('list_offices', { organization_id: id, limit: 10, offset: 20 });
  expect(calls).toContainEqual(['eq', 'organization_id', id]);
  expect(calls.at(-1)).toEqual(['range', 20, 29]);
});

test('all office writes reject regular users before touching tables', async () => {
  const { call, calls } = setup(false);
  for (const [name, input] of [
    ['create_office', { organization_id: id, name: 'Mayor' }],
    ['update_office', { id, name: 'Mayor' }],
    ['create_office_term', { office_id: id, person_id: id, selection_method: 'elected', starts_on: '2021-01-01' }],
    ['update_office_term', { id, ends_on: '2024-12-31' }],
  ] as const) expect((await call(name, input)).isError).toBe(true);
  expect(calls.every(([name]) => name === 'is_admin')).toBe(true);
});

test('partial office-term corrections preserve omissions and allow explicit ongoing service', async () => {
  const { call, calls, schemas } = setup();
  await call('update_office_term', { id, ends_on: null });
  expect(calls).toContainEqual(['update', { ends_on: null }]);
  expect((await call('update_office_term', { id })).isError).toBe(true);
  const schema = schemas.get('create_office_term').inputSchema;
  const term = { office_id: id, person_id: id, selection_method: 'elected', starts_on: '2021-01-01' };
  expect(() => schema.parse({ ...term, starts_on: '2021-02-30' })).toThrow();
  expect(() => schema.parse({ ...term, source_url: 'file:///tmp/source' })).toThrow();
  expect(() => schema.parse({ ...term, selection_method: 'assumed' })).toThrow();
});

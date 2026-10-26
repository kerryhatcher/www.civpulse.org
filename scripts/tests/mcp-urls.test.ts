import { expect, test } from 'bun:test';
import { z } from '../../apps/mcp/node_modules/zod';
import { registerExtendedTools } from '../../apps/mcp/src/extended-tools';

function setup(admin = true) {
  const registrations = new Map<string, any>();
  const calls: any[] = [];
  registerExtendedTools({ registerTool(name: string, config: any, handler: any) {
    registrations.set(name, { schema: config.inputSchema, handler });
  } } as never, { rpc: async (name: string, args: any) => {
    calls.push([name, args]);
    return { data: name === 'is_admin' ? admin : '00000000-0000-4000-8000-000000000001', error: null };
  } } as never, { id: '00000000-0000-4000-8000-000000000002' });
  return { registrations, calls };
}

test('exported URL patterns accept full article URLs in strict connector validators', () => {
  const { registrations } = setup();
  for (const [name, field] of [
    ['create_article', 'url'], ['update_article', 'url'],
    ['create_layer', 'source_url'], ['update_layer', 'source_url'],
    ['create_ballot_question', 'source_url'], ['update_ballot_question', 'source_url'],
    ['create_organization_relationship', 'source_url'], ['update_organization_relationship', 'source_url'],
  ]) {
    const schema = registrations.get(name).schema.shape[field];
    const json = JSON.parse(JSON.stringify(z.toJSONSchema(schema)));
    const pattern = json.pattern ?? json.anyOf.find((item: any) => item.pattern).pattern;
    const regex = new RegExp(pattern);
    for (const url of [
      'https://maconmelody.com/bibb-school-board-acknowledges-5-5-million-budget-hole/',
      'https://www.41nbc.com/macon-water-authority-2027-rate-changes/',
      'http://example.test/story?meeting=1&board=2#coverage',
      'HTTPS://example.test/story',
    ]) {
      expect(schema.safeParse(url).success).toBe(true);
      // Reproduce hosts that require the regex match to consume the entire value.
      expect(regex.exec(url)?.[0]).toBe(url);
    }
    for (const url of ['ftp://example.test/story', 'javascript:alert(1)', 'https://', 'https://example.test/a b']) {
      expect(schema.safeParse(url).success).toBe(false);
    }
  }
});

test('article creation forwards the URL, dates and organization link atomically; admin checks remain enforced', async () => {
  const input = {
    title: 'Meeting coverage', url: 'https://example.test/meeting/',
    published_on: '2026-08-07', fetched_on: '2026-10-26',
    organizations: [{ organization_id: '00000000-0000-4000-8000-000000000003', role: 'subject' }],
  };
  const { registrations, calls } = setup();
  const tool = registrations.get('create_article');
  expect((await tool.handler(tool.schema.parse(input))).isError).not.toBe(true);
  expect(calls.at(-1)).toEqual(['mcp_save_article', {
    p_article: { title: input.title, url: input.url, published_on: input.published_on, fetched_on: input.fetched_on },
    p_people: null, p_organizations: input.organizations,
  }]);
  const denied = setup(false);
  const deniedTool = denied.registrations.get('create_article');
  expect((await deniedTool.handler(deniedTool.schema.parse(input))).isError).toBe(true);
  expect(denied.calls).toEqual([['is_admin', undefined]]);
});


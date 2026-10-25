import { afterEach, expect, spyOn, test } from 'bun:test';
import { normalizeTargetUrl, shortLinkUrl } from '../../apps/web/src/lib/short-links';
import worker from '../../apps/web/worker/index';

const credentialTarget = new URL('https://example.test/');
credentialTarget.username = 'qa-user';
credentialTarget.password = 'fixture';

afterEach(() => { fetchMock?.mockRestore(); consoleMock?.mockRestore(); });
let fetchMock: ReturnType<typeof spyOn> | undefined;
let consoleMock: ReturnType<typeof spyOn> | undefined;
const env = {
  PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', PUBLIC_SUPABASE_ANON_KEY: 'public-test-key',
  ASSETS: { fetch: async () => new Response('asset') },
};
const request = (path = '/l/abcd1234', method = 'GET') => worker.fetch(new Request(`https://www.civpulse.org${path}`, { method }), env as Env, {} as ExecutionContext);

test('normalizes domains and rejects unsafe destinations and loops', () => {
  expect(normalizeTargetUrl(' www.kerryhatcher.com ')).toBe('https://www.kerryhatcher.com/');
  expect(normalizeTargetUrl('https://example.com/a?q=1#details')).toBe('https://example.com/a?q=1#details');
  expect(() => normalizeTargetUrl('https://www.civpulse.org./l/abcd1234')).toThrow();
  expect(shortLinkUrl('https://www.civpulse.org', 'abcd1234')).toBe('https://www.civpulse.org/l/abcd1234');
  for (const input of ['javascript:alert(1)', 'data:text/html,test', credentialTarget.href, 'https://example.com/\nother', 'https://example.com\\@bad.test', 'https://www.civpulse.org/l/abcd1234', 'https://new.civpulse.org/%6c/abcd1234', 'http://localhost:8787/l/abcd1234', 'https://www.civpulse.org//l/abcd1234']) {
    expect(() => normalizeTargetUrl(input)).toThrow();
  }
});
test('returns an uncached 302 and counts GET but not HEAD', async () => {
  fetchMock = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json('https://www.kerryhatcher.com/'));
  const get = await request('/l/abcd1234?unused=yes');
  expect(get.status).toBe(302);
  expect(get.headers.get('location')).toBe('https://www.kerryhatcher.com/');
  expect(get.headers.get('cache-control')).toBe('no-store');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).p_count).toBe(true);
  const head = await request('/l/abcd1234/', 'HEAD');
  expect(head.status).toBe(302);
  expect(await head.text()).toBe('');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).p_count).toBe(false);
});
test('missing and paused links return 404, malformed paths and writes never resolve', async () => {
  fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(null));
  expect((await request()).status).toBe(404);
  for (const path of ['/l/nope', '/l/ABCD1234', '/l/abcd1234/extra', '/l/%61bcd1234']) expect((await request(path)).status).toBe(404);
  const post = await request('/l/abcd1234', 'POST');
  expect(post.status).toBe(405);
  expect(post.headers.get('allow')).toBe('GET, HEAD');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await (await request('/docs/users/')).text()).toBe('asset');
});
test('database errors and unsafe targets fail closed with 503', async () => {
  consoleMock = spyOn(console, 'error').mockImplementation(() => {});
  fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('failure', { status: 500 }));
  expect((await request()).status).toBe(503);
  fetchMock.mockResolvedValue(Response.json('javascript:alert(1)'));
  expect((await request()).status).toBe(503);
  fetchMock.mockRejectedValue(new Error('timeout'));
  const head = await request('/l/abcd1234', 'HEAD');
  expect(head.status).toBe(503);
  expect(await head.text()).toBe('');
});

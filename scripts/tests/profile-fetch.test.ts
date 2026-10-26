import { expect, test } from 'bun:test';
import { createProfileFetch } from '../../apps/web/src/lib/profile-fetch';

const api = 'https://api.example.test';
const read = `${api}/rest/v1/rpc/get_person_legislative_record`;
const noDelay = async () => {};

test('grouped profile history recovers from a temporary gateway failure anonymously', async () => {
  let calls = 0;
  const transport = createProfileFetch(api, (async () => {
    calls++;
    return new Response(null, { status: calls === 1 ? 503 : 200 });
  }) as typeof fetch, noDelay);
  expect((await transport(`${api}/rest/v1/rpc/get_person_legislative_bill_groups`, { method: 'POST' })).status).toBe(200);
  expect(calls).toBe(2);
});

test('profile transport retries transient reads with the same body and caller credentials', async () => {
  const calls: Request[] = [];
  const request = new Request(read, { method: 'POST', headers: { authorization: 'Bearer signed-in-test' }, body: '{"p_offset":20}' });
  const transport = createProfileFetch(api, (async (input: RequestInfo | URL) => {
    const req = input as Request;
    calls.push(req);
    if (calls.length === 1) throw new TypeError('Failed to fetch');
    if (calls.length === 2) return new Response(null, { status: 503 });
    return new Response('{"rows":[],"total":3342}');
  }) as typeof fetch, noDelay);
  expect((await transport(request)).status).toBe(200);
  expect(calls).toHaveLength(3);
  for (const req of calls) {
    expect(req.headers.get('authorization')).toBe('Bearer signed-in-test');
    expect(await req.text()).toBe('{"p_offset":20}');
  }
});

test('anonymous failures are bounded and authorization errors are never retried', async () => {
  let calls = 0;
  const failed = createProfileFetch(api, (async () => { calls++; throw new TypeError('offline'); }) as typeof fetch, noDelay);
  await expect(failed(read, { method: 'POST' })).rejects.toThrow('offline');
  expect(calls).toBe(3);
  for (const status of [400, 401, 403, 404, 429]) {
    calls = 0;
    const denied = createProfileFetch(api, (async () => { calls++; return new Response(null, { status }); }) as typeof fetch, noDelay);
    expect((await denied(read, { method: 'POST' })).status).toBe(status);
    expect(calls).toBe(1);
  }
});

test('auth, writes, foreign origins and aborted requests are not repeated', async () => {
  for (const url of [`${api}/auth/v1/token`, `${api}/rest/v1/rpc/import_legislation`, `${api}/rest/v1/people`, read.replace(api, 'https://other.test')]) {
    let calls = 0;
    const transport = createProfileFetch(api, (async () => { calls++; throw new TypeError('offline'); }) as typeof fetch, noDelay);
    await expect(transport(url, { method: 'POST' })).rejects.toThrow();
    expect(calls).toBe(1);
  }
  const controller = new AbortController();
  let calls = 0;
  const transport = createProfileFetch(api, (async () => { calls++; controller.abort(); throw new TypeError('offline'); }) as typeof fetch, noDelay);
  await expect(transport(read, { method: 'POST', signal: controller.signal })).rejects.toThrow();
  expect(calls).toBe(1);
});

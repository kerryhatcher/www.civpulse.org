import { afterEach, expect, test } from 'bun:test';
import worker from '../src/index';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
let stored: { key: string; bytes: Uint8Array } | undefined;
const env = {
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public',
  ALLOWED_ORIGINS: 'https://new.civpulse.org,https://www.civpulse.org',
  MEDIA: {
    put: async (key: string, bytes: Uint8Array) => { stored = { key, bytes }; },
    get: async () => null,
  },
} as unknown as Env;
const ctx = {} as ExecutionContext;
function upload(body: BodyInit = png, headers: Record<string, string> = {}) {
  return new Request('https://media.civpulse.org/upload?bucket=org-logos', {
    method: 'POST', body, headers: { Origin: 'https://new.civpulse.org', 'Content-Type': 'image/png', Authorization: 'Bearer token', ...headers },
  });
}
function auth(admin = true, valid = true) {
  globalThis.fetch = (async (url: string) => url.includes('/auth/')
    ? Response.json({ id: 'user' }, { status: valid ? 200 : 401 })
    : Response.json(admin)) as typeof fetch;
}
test('anonymous uploads are rejected', async () => {
  const req = upload(); req.headers.delete('Authorization');
  expect((await worker.fetch(req, env, ctx)).status).toBe(401);
});
test('invalid tokens are rejected', async () => { auth(true, false); expect((await worker.fetch(upload(), env, ctx)).status).toBe(401); });
test('signed-in non-admin cannot upload', async () => { auth(false); expect((await worker.fetch(upload(), env, ctx)).status).toBe(403); });
test('untrusted origins are rejected', async () => { expect((await worker.fetch(upload(png, { Origin: 'https://other.example' }), env, ctx)).status).toBe(403); });
test('both site domains support preflight', async () => {
  for (const origin of ['https://new.civpulse.org', 'https://www.civpulse.org']) {
    const res = await worker.fetch(new Request('https://media.civpulse.org/upload', { method: 'OPTIONS', headers: { Origin: origin } }), env, ctx);
    expect(res.status).toBe(204); expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  }
});
test('admin uploads create unique R2 paths and return public URLs', async () => {
  auth();
  const a = await worker.fetch(upload(), env, ctx);
  expect(a.status).toBe(201);
  expect((await a.json()).path).toMatch(/^https:\/\/media.civpulse.org\/org-logos\/[a-f0-9-]{36}\.png$/);
  const first = stored!.key;
  await worker.fetch(upload(), env, ctx); expect(stored!.key).not.toBe(first);
});
test('content sniffing rejects disguised HTML and SVG', async () => {
  auth();
  expect((await worker.fetch(upload('<html>'), env, ctx)).status).toBe(415);
  expect((await worker.fetch(upload('<svg/>', { 'Content-Type': 'image/svg+xml' }), env, ctx)).status).toBe(415);
});
test('actual body size is enforced without Content-Length', async () => {
  auth(); expect((await worker.fetch(upload(new Uint8Array(2 * 1024 * 1024 + 1)), env, ctx)).status).toBe(413);
});
test('missing images return 404 and writes to object URLs are rejected', async () => {
  expect((await worker.fetch(new Request('https://media.civpulse.org/org-logos/00000000-0000-0000-0000-000000000000.png'), env, ctx)).status).toBe(404);
  expect((await worker.fetch(new Request('https://media.civpulse.org/org-logos/file.png', { method: 'PUT' }), env, ctx)).status).toBe(405);
});

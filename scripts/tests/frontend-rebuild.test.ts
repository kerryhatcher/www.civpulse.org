import { expect, test } from 'bun:test';
import { handleRebuild, type RebuildEnv } from '../../supabase/functions/rebuild-frontend/handler';
const id = '11111111-1111-4111-8111-111111111111';
const lease = '22222222-2222-4222-8222-222222222222';
const env: RebuildEnv = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'secret',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_WORKER_TAG: 'b'.repeat(32),
  CLOUDFLARE_BUILDS_READ_TOKEN: 'read',
  CLOUDFLARE_DEPLOY_HOOK_URL: `https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/${id}` };
const state = { lease_id: lease, needs_rebuild: true, revision: '9007199254740993', build_id: null, build_revision: null };
const pending = { ...state, build_id: id, build_revision: state.revision };
const build = { build_uuid: id, trigger: { external_script_id: env.CLOUDFLARE_WORKER_TAG }, build_trigger_metadata: { branch: 'main' }, status: 'stopped', build_outcome: 'success' };
const cf = (result: any) => ({ success: true, result });
async function request(token = 'test-cron-token-with-at-least-32-characters', timestamp = Math.floor(Date.now()/1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`frontend-rebuild:${timestamp}`));
  const signature = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
  return new Request('https://edge.test', { method: 'POST', headers: { 'x-rebuild-timestamp': String(timestamp), 'x-rebuild-signature': signature } });
}
function fixture(responses: any[]) {
  const calls: { url: string; body?: any }[] = [];
  const fetcher = (async (url: any, init: any) => {
    calls.push({ url: String(url), body: init.body && JSON.parse(init.body) });
    // Release has a JSON null result, just like a void PostgREST RPC.
    if (String(url).endsWith('/verify_frontend_rebuild_signature')) return Response.json(true);
    if (String(url).endsWith('/release_frontend_rebuild')) return Response.json(null);
    if (!responses.length) throw Error('Unexpected fetch');
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (next instanceof Response) return next;
    return Response.json(next);
  }) as typeof fetch;
  return { calls, work: () => calls.filter(c=>!c.url.endsWith('/verify_frontend_rebuild_signature')), run: async () => handleRebuild(await request(), env, fetcher) };
}
test('rejects invalid signatures and user JWTs through the server-only verification RPC', async () => {
  for (const token of ['wrong-token', 'invalid', 'Bearer admin-jwt']) {
    const f = fixture([]);
    const res = await handleRebuild(await request(token), env, (async () => Response.json(false)) as typeof fetch);
    expect(res.status).toBe(401); expect(f.work()).toHaveLength(0);
  }
});
test('requires POST and configured service/Cloudflare secrets', async () => {
  expect((await handleRebuild(new Request('https://edge.test'), env)).status).toBe(405);
  expect((await handleRebuild(await request(), { ...env, SUPABASE_SERVICE_ROLE_KEY: '' })).status).toBe(503);
  expect((await handleRebuild(await request(), { ...env, CLOUDFLARE_DEPLOY_HOOK_URL: 'https://evil.test' })).status).toBe(503);
});
test('an overlapping invocation exits when the DB lease is occupied', async () => {
  const f = fixture([null]); expect((await f.run()).status).toBe(200); expect(f.work()).toHaveLength(1);
});
test('an idle flag calls only claim and release', async () => {
  const f = fixture([{ ...state, needs_rebuild: false }]); expect((await f.run()).status).toBe(200);
  expect(f.work()).toHaveLength(2); expect(f.work()[1].body).toEqual({ p_lease: lease });
});
test('requests and persists an exact build ID and bigint revision without waiting', async () => {
  const f = fixture([state, cf([]), cf({ build_uuid: id }), pending]);
  expect((await f.run()).status).toBe(202); expect(f.work()).toHaveLength(5);
  expect(f.work()[3].body).toEqual({ p_lease: lease, p_action: 'track', p_build_id: id, p_revision: state.revision });
});
test('reconciles a successful tracked deployment and clears its flag', async () => {
  const f = fixture([pending, cf(build), { ...state, needs_rebuild: false }]);
  const res = await f.run(); expect(await res.text()).toContain('pending flag cleared');
  expect(f.work()[2].body).toEqual({ p_lease: lease, p_action: 'succeeded', p_build_id: id });
});
test('newer edits survive acknowledgement and start a fresh build in the same hourly pass', async () => {
  const newer = { ...state, revision: '9007199254740994' };
  const f = fixture([pending, cf(build), newer, cf([]), cf({ build_uuid: id }), { ...newer, build_id: id, build_revision: newer.revision }]);
  expect((await f.run()).status).toBe(202);
  expect(f.work()[5].body.p_revision).toBe(newer.revision);
});
for (const status of ['queued', 'initializing', 'running']) test(`${status} tracked builds are retained without another hook call`, async () => {
  const f = fixture([pending, cf({ ...build, status })]); expect((await f.run()).status).toBe(200); expect(f.work()).toHaveLength(3);
});
for (const outcome of ['fail', 'cancelled', 'terminated', 'skipped']) test(`terminal ${outcome} is retired but stays dirty for retry`, async () => {
  const f = fixture([pending, cf({ ...build, build_outcome: outcome }), state]);
  expect((await f.run()).status).toBe(502);
  expect(f.work()[2].body.p_action).toBe('failed'); expect(f.work()).toHaveLength(4);
});
for (const changed of [{ status: 'unknown' }, { build_outcome: null }, { trigger: { external_script_id: 'other' } }, { build_trigger_metadata: { branch: 'feature' } }, { build_uuid: lease }]) test(`unknown or mismatched build never clears the flag: ${JSON.stringify(changed)}`, async () => {
  const f = fixture([pending, cf({ ...build, ...changed })]); expect((await f.run()).status).toBe(502); expect(f.work()).toHaveLength(3);
});
test('existing production build and hook deduplication never acknowledge an earlier snapshot', async () => {
  const f = fixture([state, cf([{ ...build, status: 'running' }])]);
  expect((await f.run()).status).toBe(200); expect(f.work()).toHaveLength(3);
  const reused = fixture([state, cf([]), cf({ build_uuid: id, already_exists: true })]);
  expect((await reused.run()).status).toBe(200); expect(reused.work()).toHaveLength(4);
});
test('unrelated builds do not block the production hook', async () => {
  const f = fixture([state, cf([{ ...build, status: 'running', build_trigger_metadata: { branch: 'feature' } }]), cf({ build_uuid: id }), pending]);
  expect((await f.run()).status).toBe(202);
});
test('ambiguous hook/track failures preserve pending state and release the lease', async () => {
  for (const responses of [[state, cf([]), Error('secret-hook')], [state, cf([]), cf({ build_uuid: id }), Error('secret-db')]]) {
    const f = fixture(responses); const res = await f.run(); expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret-'); expect(f.work().at(-1)?.body).toEqual({ p_lease: lease });
  }
});
test('invalid state, HTTP errors and invalid Cloudflare bodies fail closed', async () => {
  for (const responses of [[{ ...state, revision: 1 }], [state, new Response('secret', { status: 500 })], [state, { success: false, errors: ['secret'] }], [state, cf([]), cf({ build_uuid: 'invalid' })]]) {
    const f = fixture(responses); const res = await f.run(); expect(res.status).toBe(502); expect(await res.text()).not.toContain('secret');
  }
});

test('rejects expired, future and unsigned cron requests', async () => {
  for (const offset of [-600,600]) expect((await handleRebuild(await request(undefined,Math.floor(Date.now()/1000)+offset),env)).status).toBe(401);
  expect((await handleRebuild(new Request('https://edge.test',{method:'POST'}),env)).status).toBe(401);
});

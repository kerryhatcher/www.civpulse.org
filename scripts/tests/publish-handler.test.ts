import { describe, expect, test } from 'bun:test';
import { handlePublish, type PublishEnv } from '../../supabase/functions/publish/handler';

const id = '11111111-1111-4111-8111-111111111111';
const tag = 'a'.repeat(32);
const env: PublishEnv = {
  SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-key',
  CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_WORKER_TAG: tag,
  CLOUDFLARE_BUILDS_READ_TOKEN: 'read-token',
  CLOUDFLARE_DEPLOY_HOOK_URL: `https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/${id}`,
};
const build = (status = 'stopped', outcome: string | null = 'success', overrides = {}) => ({
  build_uuid: id, status, build_outcome: outcome, created_on: '2026-10-23T10:00:00Z',
  stopped_on: status === 'stopped' ? '2026-10-23T10:01:00Z' : null,
  trigger: { external_script_id: tag },
  build_trigger_metadata: { branch: 'main', commit_hash: 'c'.repeat(40), environment_variables: { SECRET: 'must-not-leak' } },
  ...overrides,
});
function request(body: unknown = { action: 'status' }, token: string | null = 'user-jwt', origin = 'https://www.civpulse.org') {
  return new Request('https://project.supabase.co/functions/v1/publish', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
type Options = { userStatus?: number; admin?: unknown; adminStatus?: number; builds?: ReturnType<typeof build>[]; detail?: ReturnType<typeof build>; hookStatus?: number; hookBody?: unknown; failHook?: boolean; failApi?: boolean };
function upstream(options: Options = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    calls.push({ url: path, init });
    if (path.endsWith('/auth/v1/user')) return Response.json({ id: 'user' }, { status: options.userStatus ?? 200 });
    if (path.endsWith('/rpc/is_admin')) return Response.json(options.admin ?? true, { status: options.adminStatus ?? 200 });
    if (path === env.CLOUDFLARE_DEPLOY_HOOK_URL) {
      if (options.failHook) throw new Error(`secret failure ${env.CLOUDFLARE_DEPLOY_HOOK_URL}`);
      return Response.json(options.hookBody ?? { success: true, result: { build_uuid: id } }, { status: options.hookStatus ?? 200 });
    }
    if (path.includes('/client/v4/accounts/')) {
      if (options.failApi) return Response.json({ success: false, errors: ['secret-failure'] }, { status: 403 });
      return Response.json({ success: true, result: path.includes('/workers/') ? options.builds ?? [] : options.detail ?? build() });
    }
    throw new Error(`Unexpected request ${path}`);
  }) as typeof fetch;
  return { fetcher, calls, hooks: () => calls.filter(call => call.url === env.CLOUDFLARE_DEPLOY_HOOK_URL) };
}

describe('publish access control', () => {
  test('preflight permits only trusted origins and needs no token', async () => {
    const mock = upstream();
    const response = await handlePublish(new Request('https://example.com', { method: 'OPTIONS', headers: { Origin: 'https://www.civpulse.org' } }), env, mock.fetcher);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://www.civpulse.org');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('apikey');
    expect(mock.calls).toHaveLength(0);
    expect((await handlePublish(request(undefined, 'jwt', 'https://evil.example'), env, mock.fetcher)).status).toBe(403);
  });
  test('local origins require an explicit override', async () => {
    const mock = upstream();
    expect((await handlePublish(request(undefined, 'jwt', 'http://localhost:4321'), env, mock.fetcher)).status).toBe(403);
    expect((await handlePublish(request(undefined, 'jwt', 'http://localhost:4321'), { ...env, PUBLISH_ALLOWED_ORIGINS: 'http://localhost:4321' }, mock.fetcher)).status).toBe(200);
  });
  test('anonymous and expired sessions cannot read status or publish', async () => {
    for (const action of ['status', 'publish']) {
      const mock = upstream({ userStatus: 401 });
      expect((await handlePublish(request({ action }, null), env, mock.fetcher)).status).toBe(401);
      expect(mock.calls).toHaveLength(0);
      expect((await handlePublish(request({ action }), env, mock.fetcher)).status).toBe(401);
      expect(mock.calls).toHaveLength(1);
      expect(mock.hooks()).toHaveLength(0);
    }
  });
  test('regular users are denied by the database allowlist on every action', async () => {
    const mock = upstream({ admin: false });
    for (const action of ['status', 'publish']) expect((await handlePublish(request({ action }), env, mock.fetcher)).status).toBe(403);
    expect(mock.calls.every(call => call.url.startsWith(env.SUPABASE_URL))).toBe(true);
    expect(mock.calls[1].init?.headers).toMatchObject({ Authorization: 'Bearer user-jwt', apikey: 'public-key' });
  });
  test('auth service and admin lookup failures fail closed', async () => {
    for (const options of [{ userStatus: 500 }, { adminStatus: 500 }, { admin: 'true' }]) {
      const mock = upstream(options);
      expect((await handlePublish(request({ action: 'publish' }), env, mock.fetcher)).ok).toBe(false);
      expect(mock.hooks()).toHaveLength(0);
    }
  });
  test('rejects malformed requests and methods before accessing Cloudflare', async () => {
    const mock = upstream();
    for (const body of [null, {}, { action: 'deploy' }, { action: 'status', buildId: '../../tokens' }, { action: 'status', buildId: 4 }]) {
      expect((await handlePublish(request(body), env, mock.fetcher)).status).toBe(400);
    }
    expect((await handlePublish(new Request('https://example.com'), env, mock.fetcher)).status).toBe(405);
    expect(mock.hooks()).toHaveLength(0);
  });
});

describe('publish deployment and status', () => {
  test('missing or invalid secrets never trigger a build or expose configuration', async () => {
    for (const overrides of [{ CLOUDFLARE_BUILDS_READ_TOKEN: undefined }, { CLOUDFLARE_DEPLOY_HOOK_URL: 'https://evil.example/hook' }, { CLOUDFLARE_ACCOUNT_ID: '../accounts' }]) {
      const mock = upstream();
      const response = await handlePublish(request({ action: 'publish' }), { ...env, ...overrides }, mock.fetcher);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain(env.CLOUDFLARE_DEPLOY_HOOK_URL!);
      expect(mock.hooks()).toHaveLength(0);
    }
  });
  test('empty history is idle, and latest production status is sanitized', async () => {
    const empty = upstream();
    expect((await (await handlePublish(request(), env, empty.fetcher)).json()).build).toBeNull();
    const mock = upstream({ builds: [build(), build('running', null, { trigger: { external_script_id: 'other' } }), build('running', null, { build_trigger_metadata: { branch: 'preview' } })] });
    const response = await handlePublish(request(), env, mock.fetcher);
    const body = await response.json();
    expect(body.build.state).toBe('succeeded');
    expect(body.build.id).toBe(id);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(JSON.stringify(body)).not.toContain('must-not-leak');
    expect(JSON.stringify(body)).not.toContain('read-token');
    expect(JSON.stringify(body)).not.toContain('deploy_hooks');
  });
  test('only a successful completed build confirms publication', async () => {
    for (const [status, outcome, expected] of [
      ['queued', null, 'queued'], ['initializing', null, 'initializing'], ['running', 'success', 'running'],
      ['stopped', 'success', 'succeeded'], ['stopped', 'fail', 'failed'], ['stopped', 'cancelled', 'canceled'],
      ['stopped', 'terminated', 'canceled'], ['stopped', 'skipped', 'skipped'], ['stopped', null, 'unknown'], ['new-status', 'success', 'unknown'],
    ]) {
      const mock = upstream({ detail: build(status!, outcome) });
      const result = await (await handlePublish(request({ action: 'status', buildId: id }), env, mock.fetcher)).json();
      expect(result.build.state).toBe(expected);
    }
  });
  test('arbitrary build IDs cannot reveal another Worker or branch', async () => {
    for (const detail of [build('stopped', 'success', { trigger: { external_script_id: 'other' } }), build('stopped', 'success', { build_trigger_metadata: { branch: 'preview' } })]) {
      const mock = upstream({ detail });
      expect((await handlePublish(request({ action: 'status', buildId: id }), env, mock.fetcher)).status).toBe(404);
    }
  });
  test('reuses an active production build without calling the hook', async () => {
    for (const status of ['queued', 'initializing', 'running']) {
      const mock = upstream({ builds: [build(status, null)] });
      const result = await (await handlePublish(request({ action: 'publish' }), env, mock.fetcher)).json();
      expect(result.alreadyExists).toBe(true);
      expect(result.build.state).toBe(status);
      expect(mock.hooks()).toHaveLength(0);
    }
  });
  test('a publish calls the fixed hook once and never overrides migration checks or branches', async () => {
    const mock = upstream({ builds: [build()] });
    const response = await handlePublish(request({ action: 'publish', branch: 'evil', command: 'skip-checks' }), env, mock.fetcher);
    expect(response.status).toBe(202);
    expect((await response.json()).build).toMatchObject({ id, state: 'queued' });
    expect(mock.hooks()).toHaveLength(1);
    expect(mock.hooks()[0].init?.method).toBe('POST');
    expect(mock.hooks()[0].init?.body).toBeUndefined();
    expect(mock.hooks()[0].init?.headers).toBeUndefined();
  });
  test('hook deduplication returns the existing build ID', async () => {
    const mock = upstream({ hookBody: { success: true, result: { build_uuid: id, already_exists: true } } });
    const result = await (await handlePublish(request({ action: 'publish' }), env, mock.fetcher)).json();
    expect(result.alreadyExists).toBe(true);
  });
  test('status failure prevents publication and upstream errors never leak', async () => {
    const mock = upstream({ failApi: true });
    const response = await handlePublish(request({ action: 'publish' }), env, mock.fetcher);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('secret-failure');
    expect(mock.hooks()).toHaveLength(0);
  });
  test('a timed-out hook is not automatically retried and its URL stays secret', async () => {
    const mock = upstream({ failHook: true });
    const response = await handlePublish(request({ action: 'publish' }), env, mock.fetcher);
    const body = await response.text();
    expect(response.status).toBe(502);
    expect(body).toContain('may have reached Cloudflare');
    expect(body).not.toContain(env.CLOUDFLARE_DEPLOY_HOOK_URL!);
    expect(mock.hooks()).toHaveLength(1);
  });
  test('rate limits and malformed hook responses never claim success', async () => {
    for (const options of [{ hookStatus: 429 }, { hookStatus: 500 }, { hookBody: { success: true, result: {} } }]) {
      const mock = upstream(options);
      const response = await handlePublish(request({ action: 'publish' }), env, mock.fetcher);
      expect(response.ok).toBe(false);
      expect(mock.hooks()).toHaveLength(1);
    }
  });
});

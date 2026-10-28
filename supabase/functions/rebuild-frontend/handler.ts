export interface RebuildEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_TAG?: string;
  CLOUDFLARE_BUILDS_READ_TOKEN?: string;
  CLOUDFLARE_DEPLOY_HOOK_URL?: string;
}
type State = { lease_id: string; needs_rebuild: boolean; revision: string; build_id: string | null; build_revision: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function state(value: unknown): State {
  const s = value as State | null;
  if (!s || !uuid.test(s.lease_id) || typeof s.needs_rebuild !== 'boolean'
    || typeof s.revision !== 'string' || !/^[1-9]\d*$/.test(s.revision)
    || (s.build_id !== null && (typeof s.build_id !== 'string' || !uuid.test(s.build_id)))
    || (s.build_id === null ? s.build_revision !== null : typeof s.build_revision !== 'string' || !/^[1-9]\d*$/.test(s.build_revision))) throw Error('Invalid state');
  return s;
}

/** One bounded reconciliation pass; Cloudflare performs the actual static build. */
export async function handleRebuild(request: Request, env: RebuildEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  const reply = (status: string, code = 200) => Response.json({ status }, { status: code, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply('Method not allowed', 405);
  // pg_net stores outgoing headers in its queue. Authenticate with an expiring
  // HMAC so the reusable Vault secret is never present in that queue.
  const sentAt = request.headers.get('x-rebuild-timestamp') ?? '';
  const signature = request.headers.get('x-rebuild-signature') ?? '';
  if (!/^\d{10}$/.test(sentAt) || Math.abs(Date.now() / 1000 - Number(sentAt)) > 300 || !/^[0-9a-f]{64}$/.test(signature)) return reply('Unauthorized', 401);
  const { SUPABASE_URL: supabase, SUPABASE_SERVICE_ROLE_KEY: key, CLOUDFLARE_ACCOUNT_ID: account,
    CLOUDFLARE_WORKER_TAG: tag, CLOUDFLARE_BUILDS_READ_TOKEN: token, CLOUDFLARE_DEPLOY_HOOK_URL: hook } = env;
  if (!supabase || !key || !account || !/^[0-9a-f]{32}$/i.test(account) || !tag || !/^[0-9a-f]{32}$/i.test(tag) || !token
    || !hook || !/^https:\/\/api\.cloudflare\.com\/client\/v4\/workers\/builds\/deploy_hooks\/[0-9a-f-]{36}$/i.test(hook)) return reply('Rebuild scheduling is not configured', 503);
  const dbHeaders = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const api = `https://api.cloudflare.com/client/v4/accounts/${account}/builds`;
  const cfHeaders = { Authorization: `Bearer ${token}` };
  async function json(url: string, init: RequestInit, cloudflare = false): Promise<any> {
    const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw Error('Upstream failed');
    const body = await response.json();
    if (cloudflare && body?.success !== true) throw Error('Cloudflare failed');
    return cloudflare ? body.result : body;
  }
  const rpc = (name: string, args: object = {}) => json(`${supabase}/rest/v1/rpc/${name}`, { method: 'POST', headers: dbHeaders, body: JSON.stringify(args) });
  const production = (build: any) => build?.trigger?.external_script_id === tag && build?.build_trigger_metadata?.branch === 'main';
  let lease: string | undefined;
  try {
    if (await rpc('verify_frontend_rebuild_signature', { p_timestamp: sentAt, p_signature: signature }) !== true) return reply('Unauthorized', 401);
    const claimed = await rpc('claim_frontend_rebuild');
    if (claimed === null) return reply('Another rebuild check is active');
    let current = state(claimed);
    lease = current.lease_id;
    let published = false;
    if (current.build_id) {
      const build = await json(`${api}/builds/${current.build_id}`, { headers: cfHeaders }, true);
      if (!production(build) || build.build_uuid !== current.build_id) throw Error('Build scope mismatch');
      if (['queued', 'initializing', 'running'].includes(build.status)) return reply('Build still active; changes remain pending');
      if (build.status !== 'stopped') throw Error('Unknown build status');
      if (build.build_outcome !== 'success') {
        // Retire confirmed terminal failures, allowing a retry on the next hourly run.
        if (!['fail', 'cancelled', 'terminated', 'skipped'].includes(build.build_outcome)) throw Error('Unknown build outcome');
        await rpc('record_frontend_rebuild', { p_lease: lease, p_action: 'failed', p_build_id: current.build_id });
        return reply('Build failed; changes remain pending for the next hourly retry', 502);
      }
      current = state(await rpc('record_frontend_rebuild', { p_lease: lease, p_action: 'succeeded', p_build_id: current.build_id }));
      if (current.lease_id !== lease || current.build_id !== null) throw Error('Invalid acknowledgement');
      published = true;
    }
    if (!current.needs_rebuild) return reply(published ? 'Frontend published; pending flag cleared' : 'No unpublished changes');
    const builds = await json(`${api}/workers/${tag}/builds?per_page=20`, { headers: cfHeaders }, true);
    if (!Array.isArray(builds)) throw Error('Invalid build list');
    // A manual/Git-push build may have read data before our captured revision.
    if (builds.some(build => production(build) && ['queued', 'initializing', 'running'].includes(build.status))) return reply('Production build already active; changes remain pending');
    const triggered = await json(hook, { method: 'POST' }, true);
    if (!uuid.test(triggered?.build_uuid ?? '')) throw Error('Invalid build ID');
    if (triggered.already_exists === true) return reply('Hook reused a build; changes remain pending');
    const tracked = state(await rpc('record_frontend_rebuild', {
      p_lease: lease, p_action: 'track', p_build_id: triggered.build_uuid, p_revision: current.revision,
    }));
    if (tracked.build_id !== triggered.build_uuid || tracked.build_revision !== current.revision) throw Error('Build was not tracked');
    return reply('Build requested; completion will be checked next hour', 202);
  } catch {
    // Never expose exceptions, response bodies, credential values or the hook URL.
    return reply('Could not complete rebuild check; changes remain pending', 502);
  } finally {
    if (lease) {
      try { await rpc('release_frontend_rebuild', { p_lease: lease }); }
      catch { /* A crashed or interrupted invocation also recovers via lease expiry. */ }
    }
  }
}

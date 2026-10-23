export interface PublishEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_TAG?: string;
  CLOUDFLARE_BUILDS_READ_TOKEN?: string;
  CLOUDFLARE_DEPLOY_HOOK_URL?: string;
  PUBLISH_ALLOWED_ORIGINS?: string;
}

type Build = {
  build_uuid: string;
  status: string;
  build_outcome: string | null;
  created_on?: string;
  stopped_on?: string | null;
  trigger?: { external_script_id?: string };
  build_trigger_metadata?: { branch?: string; commit_hash?: string };
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const worker = 'civpulse-web-new';
const branch = 'main';
const defaultOrigins = 'https://www.civpulse.org,https://new.civpulse.org';

function summarize(build: Build) {
  if (!uuid.test(build.build_uuid)) throw new Error('Invalid build');
  let state = 'unknown';
  if (['queued', 'initializing', 'running'].includes(build.status)) state = build.status;
  else if (build.status === 'stopped') {
    state = ({ success: 'succeeded', fail: 'failed', cancelled: 'canceled', terminated: 'canceled', skipped: 'skipped' } as Record<string, string>)[build.build_outcome ?? ''] ?? 'unknown';
  }
  // Do not proxy Cloudflare's full response: source metadata can contain build secrets.
  return {
    id: build.build_uuid,
    state,
    createdAt: build.created_on ?? null,
    finishedAt: build.stopped_on ?? null,
    commit: /^[0-9a-f]{40}$/i.test(build.build_trigger_metadata?.commit_hash ?? '') ? build.build_trigger_metadata!.commit_hash : null,
  };
}

/** Runtime-neutral handler so auth and upstream failures can be tested with Bun. */
export async function handlePublish(request: Request, env: PublishEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('Origin');
  const allowedOrigin = (env.PUBLISH_ALLOWED_ORIGINS ?? defaultOrigins).split(',').map(value => value.trim()).find(value => value === origin);
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
  }
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (origin && !allowedOrigin) return reply({ error: 'Origin is not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in with an admin account.' }, 401);

  try {
    const authHeaders = { Authorization: authorization, apikey: env.SUPABASE_ANON_KEY };
    const user = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, { headers: authHeaders, signal: AbortSignal.timeout(10_000) });
    if (user.status === 401 || user.status === 403) return reply({ error: 'Your session has expired. Sign in again.' }, 401);
    if (!user.ok) return reply({ error: 'Could not check access. Try again.' }, 503);
    const admin = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10_000),
    });
    if (!admin.ok) return reply({ error: 'Could not check admin access. Try again.' }, 503);
    if (await admin.json() !== true) return reply({ error: 'Administrator access is required.' }, 403);

    let input: { action?: string; buildId?: string };
    try {
      input = await request.json();
      if (!input || typeof input !== 'object' || !['status', 'publish'].includes(input.action ?? '')
        || (input.buildId !== undefined && (typeof input.buildId !== 'string' || !uuid.test(input.buildId)))) throw new Error('Invalid request');
    } catch {
      return reply({ error: 'Choose a valid publish or status action.' }, 400);
    }

    const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_WORKER_TAG: tag, CLOUDFLARE_BUILDS_READ_TOKEN: token, CLOUDFLARE_DEPLOY_HOOK_URL: hook } = env;
    if (!account || !tag || !token || !hook || !/^[0-9a-f]{32}$/i.test(account) || !/^[0-9a-f]{32}$/i.test(tag)
      || !/^https:\/\/api\.cloudflare\.com\/client\/v4\/workers\/builds\/deploy_hooks\/[0-9a-f-]{36}$/i.test(hook)) {
      return reply({ error: 'Publishing is not configured. Ask the site maintainer to configure the publish function secrets.' }, 503);
    }
    const dashboardUrl = `https://dash.cloudflare.com/${account}/workers/services/view/${worker}/production/builds`;
    const api = `https://api.cloudflare.com/client/v4/accounts/${account}/builds`;
    async function cloudflare(path: string) {
      const response = await fetcher(api + path, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      if (!response.ok || body.success !== true) throw new Error('Cloudflare unavailable');
      return body.result;
    }
    const isProduction = (build: Build) => build.trigger?.external_script_id === tag && build.build_trigger_metadata?.branch === branch;

    if (input.action === 'status' && input.buildId) {
      const build: Build = await cloudflare(`/builds/${input.buildId}`);
      if (!isProduction(build)) return reply({ error: 'Build not found for this site.' }, 404);
      return reply({ build: summarize(build), dashboardUrl });
    }

    const builds: Build[] = await cloudflare(`/workers/${tag}/builds?per_page=20`);
    if (!Array.isArray(builds)) throw new Error('Invalid build list');
    const production = builds.filter(isProduction).sort((a, b) => (b.created_on ?? '').localeCompare(a.created_on ?? ''));
    if (input.action === 'status') return reply({ build: production[0] ? summarize(production[0]) : null, dashboardUrl });

    // Share an active build across admins/tabs. Cloudflare also deduplicates queued hook calls.
    const active = production.find(build => ['queued', 'initializing', 'running'].includes(build.status));
    if (active) return reply({ build: summarize(active), dashboardUrl, alreadyExists: true });

    // The hook uses the existing branch's build/deploy commands, including check:migrations.
    // No build commands, branch choices, or credentials are accepted from the browser.
    let response: Response;
    try {
      response = await fetcher(hook, { method: 'POST', signal: AbortSignal.timeout(15_000) });
    } catch {
      return reply({ error: 'The publish request may have reached Cloudflare. Refresh status before trying again.' }, 502);
    }
    if (response.status === 429) return reply({ error: 'Cloudflare is busy. Wait a minute, then refresh status before trying again.' }, 429);
    const body = await response.json();
    if (!response.ok || body.success !== true || !uuid.test(body.result?.build_uuid ?? '')) {
      return reply({ error: 'Cloudflare did not confirm the publish request. Refresh status before trying again.' }, 502);
    }
    return reply({
      build: { id: body.result.build_uuid, state: 'queued', createdAt: null, finishedAt: null, commit: null },
      dashboardUrl, alreadyExists: body.result.already_exists === true,
    }, 202);
  } catch {
    // Never log upstream exceptions or bodies: they may contain the hook URL or credentials.
    return reply({ error: 'Could not reach the publishing service. Refresh status to try again.' }, 502);
  }
}

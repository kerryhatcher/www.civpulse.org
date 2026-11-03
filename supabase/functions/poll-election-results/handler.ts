export type PollEnv = { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };

/** The cron request is authenticated in Vault; source checks never download the feed. */
export async function handlePoll(request: Request, env: PollEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  const reply = (status: string, code = 200) => Response.json({ status }, { status: code, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply('Method not allowed', 405);
  const timestamp = request.headers.get('x-sos-timestamp') ?? '';
  const signature = request.headers.get('x-sos-signature') ?? '';
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[0-9a-f]{64}$/.test(signature)) return reply('Unauthorized', 401);
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = env;
  if (!url || !key) return reply('Poller is not configured', 503);
  const rpc = async (name: string, args: object = {}) => {
    const response = await fetcher(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw Error('Database request failed');
    return response.json();
  };
  try {
    if (await rpc('verify_sos_poll_signature', { p_timestamp: timestamp, p_signature: signature }) !== true) return reply('Unauthorized', 401);
    for (let i = 0; i < 25; i++) {
      const feed = await rpc('claim_sos_results_poll');
      if (feed === null) break;
      let changed = false;
      let error: string | null = null;
      try {
        if (!/^https:\/\/results\.sos\.ga\.gov\/cdn\/results\/Georgia\/export-[A-Za-z0-9_-]+\.json$/.test(feed.source_url)) throw Error('Invalid source');
        const headers = new Headers();
        if (feed.etag) headers.set('If-None-Match', feed.etag);
        if (feed.last_modified) headers.set('If-Modified-Since', feed.last_modified);
        const response = await fetcher(feed.source_url, { method: 'HEAD', headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
        if (response.status === 304) changed = false;
        else if (response.status === 405 || response.status === 501) changed = true;
        else if (!response.ok) throw Error(`Source HTTP ${response.status}`);
        else {
          const etag = response.headers.get('etag');
          const modified = response.headers.get('last-modified');
          changed = !(etag && feed.etag && etag === feed.etag) && !(modified && feed.last_modified && modified === feed.last_modified && !etag);
        }
      } catch (cause) { error = cause instanceof Error && /^Source HTTP \d+$/.test(cause.message) ? cause.message : 'Source check failed'; }
      await rpc('finish_sos_results_poll', { p_election_id: feed.election_id, p_lease_id: feed.lease_id, p_changed: changed, p_error: error });
    }
    return reply('Poll completed');
  } catch { return reply('Poll failed; work remains pending', 502); }
}

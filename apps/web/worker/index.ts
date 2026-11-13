import { normalizeTargetUrl } from '../src/lib/short-links';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/l/')) return env.ASSETS.fetch(request);
    const reply = (message: string, status: number) => new Response(request.method === 'HEAD' ? null : message, {
      status, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
    });
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    }
    const match = /^\/l\/([a-f0-9]{8})\/?$/.exec(url.pathname);
    if (!match) return reply('Short link not found.', 404);
    try {
      const response = await fetch(`${env.PUBLIC_SUPABASE_URL}/rest/v1/rpc/resolve_short_link`, {
        method: 'POST',
        headers: { apikey: env.PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_code: match[1], p_count: request.method === 'GET' }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Short link lookup status ${response.status}`);
      const target: unknown = await response.json();
      if (target === null) return reply('Short link not found or paused.', 404);
      if (typeof target !== 'string') throw new Error('Invalid short link destination');
      const destination = normalizeTargetUrl(target);
      // Never cache an editable destination or skip counting a later request.
      return new Response(null, { status: 302, headers: { ...headers, Location: destination, 'Referrer-Policy': 'no-referrer' } });
    } catch (error) {
      console.error(JSON.stringify({ event: 'short_link_failed', message: error instanceof Error ? error.message : 'Unknown failure' }));
      return reply('This short link is temporarily unavailable. Please try again.', 503);
    }
  },
} satisfies ExportedHandler<Env>;

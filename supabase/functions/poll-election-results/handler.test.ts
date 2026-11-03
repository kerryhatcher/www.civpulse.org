import { describe, expect, test } from 'bun:test';
import { handlePoll } from './handler';

const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'secret' };
const signed = () => new Request('https://poll.example', { method: 'POST', headers: { 'x-sos-timestamp': String(Math.floor(Date.now() / 1000)), 'x-sos-signature': 'a'.repeat(64) } });
const feed = { election_id: 'e', lease_id: 'l', source_url: 'https://results.sos.ga.gov/cdn/results/Georgia/export-Test.json', etag: '"old"', last_modified: null };

describe('election poll', () => {
  test('rejects unsigned requests before database access', async () => {
    const response = await handlePoll(new Request('https://poll.example', { method: 'POST' }), env, (() => { throw Error('unexpected'); }) as typeof fetch);
    expect(response.status).toBe(401);
  });
  for (const [status, etag, changed, error] of [[304, null, false, null], [200, '"new"', true, null], [429, null, false, 'Source HTTP 429'], [405, null, true, null]] as const) {
    test(`handles HEAD ${status}`, async () => {
      const calls: any[] = []; let claimed = false;
      const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/verify_sos_poll_signature')) return Response.json(true);
        if (url.endsWith('/claim_sos_results_poll')) { if (claimed) return Response.json(null); claimed = true; return Response.json(feed); }
        if (url.endsWith('/finish_sos_results_poll')) { calls.push(JSON.parse(String(init?.body))); return Response.json(null); }
        expect(init?.method).toBe('HEAD');
        expect(new Headers(init?.headers).get('User-Agent')).toBe('CivicPulse-results-collector/0.1.0 (+https://github.com/CivicPulse/updaters)');
        expect(String(input)).toBe(feed.source_url);
        expect(init?.redirect).toBe('error');
        expect(new Headers(init?.headers).get('If-None-Match')).toBe('"old"');
        return new Response(null, { status, headers: etag ? { ETag: etag } : {} });
      }) as typeof fetch;
      expect((await handlePoll(signed(), env, fetcher)).status).toBe(200);
      expect(calls).toEqual([{ p_election_id: 'e', p_lease_id: 'l', p_changed: changed, p_error: error }]);
    });
  }
});

test('source HEAD carries honest identity on the actual loopback HTTP request', async () => {
  const observed: { method: string; agent: string | null; validator: string | null }[] = [];
  const source = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    observed.push({ method: request.method, agent: request.headers.get('user-agent'), validator: request.headers.get('if-none-match') });
    return new Response(null, { status: 304 });
  } });
  let claimed = false;
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/verify_sos_poll_signature')) return Response.json(true);
    if (url.endsWith('/claim_sos_results_poll')) { if (claimed) return Response.json(null); claimed = true; return Response.json(feed); }
    if (url.endsWith('/finish_sos_results_poll')) return Response.json(null);
    expect(url).toBe(feed.source_url);
    // Only the synthetic source transport boundary is redirected to loopback.
    return fetch(source.url, init);
  }) as typeof fetch;
  try {
    expect((await handlePoll(signed(), env, fetcher)).status).toBe(200);
    expect(observed).toEqual([{ method: 'HEAD', agent: 'CivicPulse-results-collector/0.1.0 (+https://github.com/CivicPulse/updaters)', validator: '"old"' }]);
  } finally { source.stop(true); }
});

for (const finishStatus of [204, 200]) {
  for (const sourceStatus of [200, 304]) {
    test(`empty finish ${finishStatus} after HEAD ${sourceStatus} continues claiming exactly once`, async () => {
      let claims = 0; const finishes: unknown[] = []; let heads = 0;
      const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/verify_sos_poll_signature')) return Response.json(true);
        if (url.endsWith('/claim_sos_results_poll')) return Response.json(++claims === 1 ? feed : null);
        if (url.endsWith('/finish_sos_results_poll')) {
          finishes.push(JSON.parse(String(init?.body)));
          return new Response(null, { status: finishStatus });
        }
        expect(url).toBe(feed.source_url); expect(init?.method).toBe('HEAD'); heads++;
        return new Response(null, { status: sourceStatus, headers: sourceStatus === 200 ? { ETag: '"new"' } : {} });
      }) as typeof fetch;
      expect((await handlePoll(signed(), env, fetcher)).status).toBe(200);
      expect(claims).toBe(2); expect(heads).toBe(1);
      expect(finishes).toEqual([{ p_election_id: 'e', p_lease_id: 'l', p_changed: sourceStatus === 200, p_error: null }]);
    });
  }
}

for (const name of ['verify_sos_poll_signature', 'claim_sos_results_poll']) {
  for (const body of [null, '', 'not JSON']) {
    test(`${name} rejects ${body === null ? '204' : JSON.stringify(body)} without source or finish calls`, async () => {
      const calls: string[] = [];
      const fetcher = (async (input: string | URL | Request) => {
        const url = String(input); calls.push(url);
        if (url.endsWith('/' + name)) return new Response(body, { status: body === null ? 204 : 200 });
        if (url.endsWith('/verify_sos_poll_signature')) return Response.json(true);
        throw Error('Unexpected source or finish call');
      }) as typeof fetch;
      expect((await handlePoll(signed(), env, fetcher)).status).toBe(502);
      expect(calls.length).toBe(name === 'verify_sos_poll_signature' ? 1 : 2);
      expect(calls.every(url => !url.includes('/finish_sos_results_poll') && !url.startsWith('https://results.sos'))).toBe(true);
    });
  }
}

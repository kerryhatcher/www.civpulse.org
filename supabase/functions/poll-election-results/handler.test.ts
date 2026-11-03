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
        expect(new Headers(init?.headers).get('If-None-Match')).toBe('"old"');
        return new Response(null, { status, headers: etag ? { ETag: etag } : {} });
      }) as typeof fetch;
      expect((await handlePoll(signed(), env, fetcher)).status).toBe(200);
      expect(calls).toEqual([{ p_election_id: 'e', p_lease_id: 'l', p_changed: changed, p_error: error }]);
    });
  }
});

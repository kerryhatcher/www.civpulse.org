import { describe, expect, test } from 'bun:test';
import { handleRequest } from '../../apps/mcp/src/index';

const resource = 'https://api.civpulse.org/functions/v1/mcp';
const env = {
  MCP_RESOURCE_URL: resource,
  SUPABASE_URL: 'https://drzcrodqflzkzzbqsags.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  AUTHORIZATION_SERVER: 'https://drzcrodqflzkzzbqsags.supabase.co/auth/v1',
};

describe('Supabase gateway routing and OAuth discovery', () => {
  for (const path of ['/functions/v1/mcp', '/mcp']) {
    test(`serves challenge and metadata at ${path}`, async () => {
      const response = await handleRequest(new Request(`https://api.civpulse.org${path}`), env);
      expect(response.status).toBe(401);
      const metadata = `${resource}/.well-known/oauth-protected-resource`;
      expect(response.headers.get('WWW-Authenticate')).toContain(metadata);
      const discovery = await handleRequest(new Request(`https://api.civpulse.org${path}/.well-known/oauth-protected-resource`), env);
      expect(await discovery.json()).toMatchObject({ resource, authorization_servers: [env.AUTHORIZATION_SERVER] });
    });
  }

  test('rejects unexpected origins and hosts, permits site preflight', async () => {
    expect((await handleRequest(new Request(resource, { headers: { Origin: 'https://evil.example' } }), env)).status).toBe(403);
    expect((await handleRequest(new Request('https://evil.example/functions/v1/mcp'), env)).status).toBe(403);
    const preflight = await handleRequest(new Request(resource, { method: 'OPTIONS', headers: { Origin: 'https://www.civpulse.org' } }), env);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://www.civpulse.org');
    const response = await handleRequest(new Request(resource, { headers: { Origin: 'https://www.civpulse.org' } }), env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://www.civpulse.org');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('WWW-Authenticate');
  });
});

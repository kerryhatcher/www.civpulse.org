import { handleRequest, type Env } from './index';

const env: Env = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL ?? 'http://localhost:8789/mcp',
  AUTHORIZATION_SERVER: process.env.AUTHORIZATION_SERVER!,
};
if (Object.values(env).some(value => !value)) throw new Error('Set the MCP environment variables');
Bun.serve({ port: 8789, fetch: request => handleRequest(request, env) });

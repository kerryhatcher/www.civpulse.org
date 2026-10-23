import { handleRequest } from './handler.js';

// Use the platform's internal project URL and public key, never its service key.
Deno.serve((request: Request) => handleRequest(request, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL')!,
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY')!,
  MCP_RESOURCE_URL: 'https://api.civpulse.org/functions/v1/mcp',
  // Custom domains do not change the Supabase Auth token issuer.
  AUTHORIZATION_SERVER: 'https://drzcrodqflzkzzbqsags.supabase.co/auth/v1',
}));

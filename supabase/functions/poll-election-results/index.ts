import { handlePoll } from './handler.ts';
Deno.serve((request: Request) => handlePoll(request, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));

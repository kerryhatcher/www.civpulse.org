import { handleRebuild } from './handler.ts';

Deno.serve((request: Request) => handleRebuild(request, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL')!,
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  CLOUDFLARE_ACCOUNT_ID: Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),
  CLOUDFLARE_WORKER_TAG: Deno.env.get('CLOUDFLARE_WORKER_TAG'),
  CLOUDFLARE_BUILDS_READ_TOKEN: Deno.env.get('CLOUDFLARE_BUILDS_READ_TOKEN'),
  CLOUDFLARE_DEPLOY_HOOK_URL: Deno.env.get('CLOUDFLARE_DEPLOY_HOOK_URL'),
}));

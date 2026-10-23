import { handlePublish } from './handler.ts';

Deno.serve((request: Request) => handlePublish(request, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL')!,
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY')!,
  CLOUDFLARE_ACCOUNT_ID: Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),
  CLOUDFLARE_WORKER_TAG: Deno.env.get('CLOUDFLARE_WORKER_TAG'),
  CLOUDFLARE_BUILDS_READ_TOKEN: Deno.env.get('CLOUDFLARE_BUILDS_READ_TOKEN'),
  CLOUDFLARE_DEPLOY_HOOK_URL: Deno.env.get('CLOUDFLARE_DEPLOY_HOOK_URL'),
  PUBLISH_ALLOWED_ORIGINS: Deno.env.get('PUBLISH_ALLOWED_ORIGINS'),
}));

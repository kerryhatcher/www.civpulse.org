import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * Browser-safe Supabase client. Uses the public anon key only — never a
 * service-role key. Created lazily so builds without env vars still succeed.
 */
export function getSupabase(): SupabaseClient {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Copy apps/web/.env.example to .env and fill it in.',
    );
  }

  client ??= createClient(url, anonKey);
  return client;
}

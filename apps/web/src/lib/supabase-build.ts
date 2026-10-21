import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * Read-only Supabase client for build-time data fetching (getStaticPaths).
 * Returns null when the public env vars are not configured.
 */
export function getBuildSupabase(): SupabaseClient | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  client ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

function publicStorageUrl(bucket: string, path: string | null | undefined): string | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!path || !url) return null;
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

/** Public URL for an object in the org-logos bucket. */
export function organizationLogoUrl(path: string | null | undefined): string | null {
  return publicStorageUrl('org-logos', path);
}

/** Public URL for an object in the person-images bucket. */
export function personImageUrl(path: string | null | undefined): string | null {
  return publicStorageUrl('person-images', path);
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
let activeRequests = 0;
const waitingRequests: Array<() => void> = [];

// Static profiles fan out many related reads; avoid exhausting PostgREST's pool.
async function buildFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (activeRequests >= 6) await new Promise<void>(resolve => waitingRequests.push(resolve));
  else activeRequests++;
  try {
    return await fetch(input, init);
  } finally {
    const next = waitingRequests.shift();
    if (next) next();
    else activeRequests--;
  }
}

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
    global: { fetch: buildFetch },
  });

  return client;
}

function publicStorageUrl(bucket: string, path: string | null | undefined): string | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!path) return null;
  // R2 uploads store an absolute URL; legacy Supabase paths stay supported.
  const mediaUrl = (import.meta.env.PUBLIC_MEDIA_URL || 'https://media.civpulse.org').replace(/\/$/, '');
  if (path.startsWith(`${mediaUrl}/${bucket}/`)) return path;
  if (!url || /^[a-z]+:/i.test(path)) return null;
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

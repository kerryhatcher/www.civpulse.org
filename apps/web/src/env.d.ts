/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. http://127.0.0.1:54321. */
  readonly PUBLIC_SUPABASE_URL: string;
  /** Supabase publishable/anon key. Never a service-role key. */
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

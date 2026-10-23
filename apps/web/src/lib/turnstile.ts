/** Public Cloudflare testing key; accepted only with a loopback Supabase backend. */
export const TURNSTILE_TEST_SITEKEY = '1x00000000000000000000AA';

export function turnstileSitekey(supabaseUrl: string, configured?: string): string {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(supabaseUrl).hostname);
  const sitekey = configured?.trim() || (local ? TURNSTILE_TEST_SITEKEY : '');
  if (!sitekey || (!local && /^[123]x0{10,}/.test(sitekey))) {
    throw new Error('Set PUBLIC_TURNSTILE_SITEKEY to a production Turnstile sitekey before building against hosted Supabase.');
  }
  return sitekey;
}

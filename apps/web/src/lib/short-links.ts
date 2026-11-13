/** Normalize bare domains while rejecting unsafe protocols, credentials and redirect chains. */
export function normalizeTargetUrl(value: string): string {
  const input = value.trim();
  if (!input || input.length > 4000 || /[\s\\\x00-\x1f\x7f]/.test(input)) throw new Error('Enter a valid HTTP or HTTPS destination URL without spaces.');
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error('Enter a valid destination URL, such as https://www.kerryhatcher.com.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Use an HTTP or HTTPS URL without a username or password.');
  const hostname = url.hostname.replace(/\.$/, '');
  if (['civpulse.org', 'www.civpulse.org', 'new.civpulse.org', 'localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    let path: string;
    try { path = decodeURIComponent(url.pathname).replace(/\/{2,}/g, '/'); }
    catch { throw new Error('Enter a destination URL with valid percent encoding.'); }
    if (/^\/l(?:\/|$)/i.test(path)) throw new Error('Choose a destination outside /l/ to avoid redirect loops.');
  }
  if (url.href.length > 4000) throw new Error('The destination URL is too long.');
  return url.href;
}

export function shortLinkUrl(origin: string, code: string): string {
  return new URL(`/l/${code}`, origin).href;
}

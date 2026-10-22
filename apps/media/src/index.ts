const MAX_BYTES = 2 * 1024 * 1024;
const keyPattern = /^(org-logos|person-images)\/[0-9a-f-]{36}\.(png|jpg|webp)$/;

function imageExtension(bytes: Uint8Array, type: string): string | null {
  if (type === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'png';
  if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  const text = new TextDecoder();
  if (type === 'image/webp' && text.decode(bytes.slice(0, 4)) === 'RIFF' && text.decode(bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGINS.split(',').find((trusted) => trusted === origin);
  const cors = new Headers({ Vary: 'Origin', 'Cache-Control': 'no-store' });
  if (allowedOrigin) {
    cors.set('Access-Control-Allow-Origin', allowedOrigin);
    cors.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    cors.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }
  const reply = (error: string, status: number) => Response.json({ error }, { status, headers: cors });

  if (url.pathname === '/upload') {
    if (origin && !allowedOrigin) return reply('Origin is not allowed.', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply('Method not allowed.', 405);
    const bucket = url.searchParams.get('bucket');
    if (bucket !== 'org-logos' && bucket !== 'person-images') return reply('Invalid image category.', 400);
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply('Sign in to upload an image.', 401);

    // Supabase verifies the token; the database allowlist, not user-editable claims,
    // decides whether this caller is an administrator. No service-role credentials.
    const authHeaders = { Authorization: authorization, apikey: env.SUPABASE_ANON_KEY };
    const userResponse = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: authHeaders });
    if (!userResponse.ok) return reply('Your session has expired. Sign in again.', 401);
    const adminResponse = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/is_admin', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!adminResponse.ok || await adminResponse.json() !== true) return reply('Administrator access is required.', 403);
    if (!request.body) return reply('Choose an image.', 400);
    if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return reply('Images must be 2 MB or smaller.', 413);

    // Bound actual bytes too: Content-Length is optional and untrusted.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return reply('Images must be 2 MB or smaller.', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const type = request.headers.get('Content-Type') ?? '';
    const ext = imageExtension(bytes, type);
    if (!ext) return reply('Choose a valid PNG, JPEG, or WebP image.', 415);
    const key = `${bucket}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
    return Response.json({ path: `${url.origin}/${key}` }, { status: 201, headers: cors });
  }

  if (!['GET', 'HEAD'].includes(request.method)) return reply('Method not allowed.', 405);
  const key = url.pathname.slice(1);
  if (!keyPattern.test(key)) return reply('Image not found.', 404);
  const object = request.method === 'HEAD' ? await env.MEDIA.head(key) : await env.MEDIA.get(key);
  if (!object) return reply('Image not found.', 404);
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' });
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Content-Length', String(object.size));
  if (request.headers.get('If-None-Match') === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response('body' in object ? (object as R2ObjectBody).body : null, { headers });
}

export default {
  async fetch(request, env): Promise<Response> {
    try { return await handle(request, env); }
    catch (error) {
      console.error('Media request failed', error instanceof Error ? error.message : 'Unknown error');
      const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
      const origin = request.headers.get('Origin');
      const allowedOrigin = env.ALLOWED_ORIGINS.split(',').find((trusted) => trusted === origin);
      if (allowedOrigin) headers.set('Access-Control-Allow-Origin', allowedOrigin);
      return Response.json({ error: 'Media storage is temporarily unavailable. Please try again.' }, { status: 503, headers });
    }
  },
} satisfies ExportedHandler<Env>;

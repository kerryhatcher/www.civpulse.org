// All public responses use the anonymous catalog projection, even for admins.
// A separate R2 custom domain serves the deliberately published files.
export type RuntimeEnv = { [K in keyof Env]: Env[K] extends string ? string : Env[K] };
const MAX_BYTES = 25 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objectKey = /^documents\/([0-9a-f-]{36})\/[0-9a-f]{64}\.[a-z0-9]+$/;
const kinds = ['agenda','minutes','packet','presentation','spreadsheet','transcript','other'];
const origins = ['official','automated_transcript','ocr','other'];
interface DocumentRecord {
  id: string; title: string; file_name: string; object_key: string; mime_type: string;
  size_bytes: number; source_url: string; document_kind: string; text_origin: string;
  status: string; claim?: string | null; published_at: string | null;
  meetings: {id: string; title: string; starts_at: string}[];
}
interface Attachment { id: string; file_name: string; storage_path: string; mime_type: string; size_bytes: number }
class HttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function boundedBytes(response: Response | Request, max: number): Promise<Uint8Array> {
  if (Number(response.headers.get('Content-Length')) > max) throw new HttpError('File or request is too large.', 413);
  if (!response.body) throw new HttpError('Empty file or request.', 400);
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const {value,done} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > max) { await reader.cancel(); throw new HttpError('File or request is too large.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of chunks) { bytes.set(part,offset); offset += part.length; }
  return bytes;
}

async function rpc<T>(env: RuntimeEnv, name: string, args: Record<string,unknown>, authorization?: string): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(args), signal: AbortSignal.timeout(20000),
  });
  const value = JSON.parse(new TextDecoder().decode(await boundedBytes(response, 2 * 1024 * 1024)));
  if (!response.ok) throw new HttpError(typeof value.message === 'string' ? value.message : 'Document catalog unavailable.', response.status >= 500 ? 503 : 400);
  return value as T;
}

function publicRecord(record: DocumentRecord, env: RuntimeEnv) {
  const {claim: _claim,...metadata} = record;
  const extension=record.object_key.split('.').pop()??'';
  const supported=['pdf','txt','csv','docx','xls','xlsx','odt','ods'].includes(extension);
  const limit=['pdf','txt'].includes(extension)?10*1024*1024:4*1024*1024;
  const eligible=supported && record.size_bytes<=limit;
  return { ...metadata, url: `${env.PUBLIC_DOCUMENT_ORIGIN}/${record.object_key}`,
    indexing:{eligible,reason:eligible?'Queued for the next R2 sync; indexing success is not yet verified.'
      : 'Downloadable original. Publish a smaller supported PDF or TXT derivative to make its contents searchable.'} };
}

async function admin(request: Request, env: RuntimeEnv): Promise<string> {
  const authorization = request.headers.get('Authorization');
  if (!authorization || !/^Bearer \S+$/i.test(authorization)) throw new HttpError('Sign in to publish documents.',401);
  const result = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {Authorization: authorization, apikey: env.SUPABASE_ANON_KEY}, signal: AbortSignal.timeout(10000),
  });
  if (!result.ok) throw new HttpError('Your session has expired. Sign in again.',401);
  const user = JSON.parse(new TextDecoder().decode(await boundedBytes(result,65536)));
  if (!user.id || user.is_anonymous || await rpc(env,'is_admin',{},authorization) !== true) throw new HttpError('Administrator access is required.',403);
  return authorization;
}

async function publish(request: Request, env: RuntimeEnv, authorization: string) {
  if (env.PUBLICATION_ENABLED !== 'true') throw new HttpError('Public document publication is paused. Attachments remain in their existing storage.',503);
  let body: Record<string,unknown>;
  try { body = JSON.parse(new TextDecoder().decode(await boundedBytes(request,8192))); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError('Provide a JSON publication request.',400); }
  if (!body || Array.isArray(body) || typeof body !== 'object' || body.confirm_public !== true ||
      typeof body.meeting_id !== 'string' || !uuid.test(body.meeting_id) ||
      typeof body.attachment_id !== 'string' || !uuid.test(body.attachment_id) ||
      typeof body.title !== 'string' || !body.title.trim() || body.title.length>300 ||
      !kinds.includes(String(body.document_kind)) || !origins.includes(String(body.text_origin))) {
    throw new HttpError('Choose a meeting attachment, title, document type and text origin, and confirm public distribution.',400);
  }
  if (!env.PUBLICATION_MEETING_IDS.split(',').map(id=>id.trim()).includes(body.meeting_id)) {
    throw new HttpError('Publication is not enabled for this meeting.',403);
  }
  let source: URL;
  try { source = new URL(String(body.source_url)); } catch { throw new HttpError('Provide the original HTTPS source URL.',400); }
  if (source.protocol !== 'https:' || source.username || source.password) throw new HttpError('Provide the original HTTPS source URL without credentials.',400);
  const meeting = await rpc<{status:string; event?:{visibility:string}; calendar?:{visibility:string}; attachments?:Attachment[]}>(env,'get_meeting',{p_id:body.meeting_id},authorization);
  const attachment = meeting.attachments?.find(a=>a.id===body.attachment_id);
  if (meeting.status !== 'ok' || meeting.event?.visibility !== 'public' || meeting.calendar?.visibility !== 'public' || !attachment) {
    throw new HttpError('Publish only attachments of public, listed meetings.',400);
  }
  const storagePath = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.[a-z0-9]+$/.exec(attachment.storage_path);
  if (!storagePath || storagePath[1]!==body.meeting_id || !uuid.test(storagePath[2])) throw new HttpError('Invalid attachment storage path.',400);
  if (!/^(application\/(pdf|msword|vnd\.[a-z0-9.+-]+)|text\/(plain|csv))$/.test(attachment.mime_type)) {
    throw new HttpError('Unsupported attachment MIME type.',400);
  }
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/authenticated/meeting-attachments/${attachment.storage_path}`, {
    headers: {Authorization:authorization,apikey:env.SUPABASE_ANON_KEY}, signal:AbortSignal.timeout(30000), redirect:'manual',
  });
  if (!response.ok) throw new HttpError('The source attachment could not be downloaded.',502);
  const bytes = await boundedBytes(response,MAX_BYTES);
  if (!bytes.length || bytes.length !== attachment.size_bytes) throw new HttpError('Attachment size does not match its catalog record.',400);
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const document = await rpc<DocumentRecord>(env,'prepare_public_document',{
    p_attachment_id:body.attachment_id,p_sha256:sha,p_title:body.title,p_source_url:source.href,
    p_document_kind:body.document_kind,p_text_origin:body.text_origin,p_confirm_public:true,
  },authorization);
  if (document.status === 'published') return publicRecord(document,env);
  if (!document.claim || !objectKey.test(document.object_key)) throw new HttpError('Publication could not be reserved.',503);
  // Keep immutable bytes after an uncertain database response. Never delete a
  // successfully published object merely because a response was interrupted.
  await env.DOCUMENTS.put(document.object_key,bytes,{
    httpMetadata:{contentType:document.mime_type,contentDisposition:`attachment; filename*=UTF-8''${encodeURIComponent(document.file_name)}`,cacheControl:'no-store'},
    customMetadata:{document_id:document.id,document_kind:document.document_kind,text_origin:document.text_origin},
  });
  const saved = await rpc<DocumentRecord>(env,'finish_public_document',{p_id:document.id,p_claim:document.claim},authorization);
  return publicRecord(saved,env);
}

export async function handle(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url); const origin = request.headers.get('Origin');
  const allowed = env.ALLOWED_ORIGINS.split(',').find(trusted=>trusted===origin);
  const headers = new Headers({'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'});
  if (allowed) {
    headers.set('Access-Control-Allow-Origin',allowed);
    headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  }
  const json = (value: unknown,status=200) => Response.json(value,{status,headers});
  try {
    if (origin && !allowed) throw new HttpError('Origin is not allowed.',403);
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if (url.pathname==='/status' && request.method==='GET') return json({search_enabled:env.SEARCH_ENABLED==='true',publication_enabled:env.PUBLICATION_ENABLED==='true'});
    if (url.pathname==='/publish' && request.method==='POST') return json(await publish(request,env,await admin(request,env)),201);
    const withdrawal = /^\/documents\/([0-9a-f-]{36})\/withdraw$/.exec(url.pathname);
    if (withdrawal && request.method==='POST' && uuid.test(withdrawal[1])) {
      const authorization = await admin(request,env);
      const document = await rpc<DocumentRecord>(env,'withdraw_public_document',{p_id:withdrawal[1]},authorization);
      await env.DOCUMENTS.delete(document.object_key);
      return json({status:'withdrawn',id:document.id,index_cleanup:'next R2 sync; search results are blocked immediately by the catalog'});
    }
    if (request.method!=='GET') throw new HttpError('Method not allowed.',405);
    if (url.pathname==='/documents') {
      const query = url.searchParams.get('q')??''; const offset = Number(url.searchParams.get('offset')??0);
      if (query.length>500 || !Number.isInteger(offset) || offset<0 || offset>10000) throw new HttpError('Invalid catalog query.',400);
      const rows = await rpc<DocumentRecord[]>(env,'list_public_documents',{p_query:query,p_limit:20,p_offset:offset});
      return json({documents:rows.map(row=>publicRecord(row,env))});
    }
    if (url.pathname==='/search') {
      if (env.SEARCH_ENABLED!=='true') throw new HttpError('Document content search is not enabled yet. Browse the document catalog instead.',503);
      const query = (url.searchParams.get('q')??'').trim();
      if (!query || query.length>500) throw new HttpError('Enter a search of 1–500 characters.',400);
      const limited = await env.SEARCH_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')??'unknown'});
      if (!limited.success) { headers.set('Retry-After','60'); throw new HttpError('Too many searches. Try again in a minute.',429); }
      const results = await env.SEARCH.search({query,ai_search_options:{
        retrieval:{retrieval_type:'hybrid',max_num_results:20,return_on_failure:false},
        query_rewrite:{enabled:false},cache:{enabled:false},
      }});
      const grouped = new Map<string,{document:ReturnType<typeof publicRecord>;passages:string[]}>();
      // Do not return raw index metadata, stale/withdrawn chunks or arbitrary URLs.
      const keys = [...new Set(results.chunks.map(c=>c.item.key))];
      await Promise.all(keys.map(async key=>{
        const match = objectKey.exec(key); if (!match || !uuid.test(match[1])) return;
        const record = await rpc<DocumentRecord|null>(env,'get_public_document',{p_id:match[1]});
        if (!record || record.status!=='published' || record.object_key!==key) return;
        grouped.set(key,{document:publicRecord(record,env),passages:[]});
      }));
      const ranked: {document:ReturnType<typeof publicRecord>;passages:string[]}[] = [];
      for (const chunk of results.chunks) {
        const row = grouped.get(chunk.item.key); if (!row) continue;
        if (!ranked.includes(row)) ranked.push(row);
        if (row.passages.length<3) row.passages.push(chunk.text.slice(0,3000));
      }
      return json({results:ranked});
    }
    throw new HttpError('Not found.',404);
  } catch (error) {
    if (error instanceof HttpError) return json({error:error.message},error.status);
    console.error(JSON.stringify({event:'kb_request_failed',path:url.pathname,error:error instanceof Error?error.name:'unknown'}));
    return json({error:'The document archive is temporarily unavailable. Please try again.'},503);
  }
}

export default {fetch:handle} satisfies ExportedHandler<RuntimeEnv>;

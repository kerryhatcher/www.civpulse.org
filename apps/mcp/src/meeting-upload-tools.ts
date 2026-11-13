import {transferMeetingChunk,MCP_UPLOAD_CHUNK_BYTES,MCP_UPLOAD_BASE64_MAX,type UploadRelayContext} from './meeting-upload-relay';
import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createToolkit } from './toolkit';
import { meetingDocumentType, MAX_DOCUMENT_BYTES } from './meeting-tools';

const BUCKET = 'meeting-attachments';
const uuid = z.string().uuid();
const sha = z.string().regex(/^[a-f0-9]{64}$/);

/** Check the original bytes before making metadata readable to meeting visitors. */
export async function verifyMeetingOriginal(blob: Blob, expected: { size_bytes: number; sha256: string; mime_type: string }) {
  if (blob.size !== expected.size_bytes || blob.size < 1 || blob.size > MAX_DOCUMENT_BYTES) throw new Error('Original size mismatch');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const signature = new TextDecoder().decode(bytes.slice(0, 8));
  if (expected.mime_type === 'application/pdf' && !signature.startsWith('%PDF-')) throw new Error('Invalid PDF signature');
  if (/openxmlformats|opendocument/.test(expected.mime_type) && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error('Invalid Office/OpenDocument ZIP signature');
  if (['application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'].includes(expected.mime_type) &&
    ![0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i) => bytes[i] === v)) throw new Error('Invalid Office binary signature');
  if (expected.mime_type === 'application/json') JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join('');
  if (hash !== expected.sha256) throw new Error('Original SHA-256 mismatch');
  return hash;
}

export function registerMeetingUploadTools(server: McpServer, supabase: SupabaseClient, context?: UploadRelayContext) {
  const { register, ensureAdmin } = createToolkit(server, supabase);
  async function session(id: string) {
    await ensureAdmin();
    const { data, error } = await supabase.from('meeting_upload_sessions').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }
  register('begin_meeting_attachment_upload', 'Begin/reconcile an original-document upload (admin, 1–26,214,400 bytes). Stable provider/source_key returns the same 24-hour session; changed metadata conflicts. Connected agents use manage_meeting_attachment_upload action=transfer_chunk with id, byte offset and at most 256 KiB of original bytes encoded as base64; transfer_status reconciles progress without exposing the caller token or TUS Location. Legacy direct-TUS endpoint/scoped x-signature metadata is also returned for applications that already possess their own user token; connected agents must not extract one. Never send a whole large file in one MCP call. Never set x-upsert. Finalize after upload; status reconciles uncertain responses. PDF, Office, OpenDocument, TXT, CSV and JSON projections supported. Signed token expires in 2 hours; repeat begin to refresh within session lifetime. No R2 publication.',
    { meeting_id: uuid, provider: z.string().min(1).max(100), source_key: z.string().min(1).max(500),
      file_name: z.string().min(1).max(255), size_bytes: z.number().int().min(1).max(MAX_DOCUMENT_BYTES), sha256: sha,
      source_url: z.string().url().startsWith('https://') },
    async ({ meeting_id, provider, source_key, file_name, size_bytes, sha256, source_url }) => {
      const mime_type = meetingDocumentType(file_name).contentType;
      const { data: s, error } = await supabase.rpc('begin_meeting_upload', { p_meeting_id: meeting_id, p_provider: provider,
        p_source_key: source_key, p_file_name: file_name, p_mime_type: mime_type, p_size_bytes: size_bytes, p_sha256: sha256, p_source_url: source_url });
      if (error) throw new Error(error.message);
      if (s.state !== 'pending' || Date.parse(s.expires_at) <= Date.now()) return { ...s, upload_available: false };
      const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(s.storage_path);
      if (signError) throw new Error(signError.message);
      const endpoint = new URL(data.signedUrl);
      endpoint.pathname = '/storage/v1/upload/resumable'; endpoint.search = '';
      if (endpoint.hostname.endsWith('.supabase.co') && !endpoint.hostname.endsWith('.storage.supabase.co')) endpoint.hostname = endpoint.hostname.replace('.supabase.co','.storage.supabase.co');
      return { ...s, tus_endpoint: endpoint.href, headers: { 'x-signature': data.token }, chunk_size: 6 * 1024 * 1024,
        mcp_transfer: { tool: 'manage_meeting_attachment_upload', action: 'transfer_chunk', max_chunk_bytes: MCP_UPLOAD_CHUNK_BYTES, status_action: 'transfer_status' },
        metadata: { bucketName: BUCKET, objectName: s.storage_path, contentType: s.mime_type }, token_expires_in: 7200 };
    }, { write: true, destructive: false, idempotent: true });
  register('finalize_meeting_attachment_upload', 'Verify uploaded original size, type signature and SHA-256, then atomically create one canonical meeting attachment (admin). Retry safely after timeout using the same session UUID; completed sessions return the same attachment. Missing, expired or cancelled originals are rejected. No public-archive publication.',
    { id: uuid }, async ({ id }) => {
      const s = await session(id);
      if (s.state !== 'complete') {
        if (s.state !== 'pending' || Date.parse(s.expires_at) <= Date.now()) throw new Error('Upload cancelled or expired');
        const { data, error } = await supabase.storage.from(BUCKET).download(s.storage_path);
        if (error) throw new Error(error.message);
        await verifyMeetingOriginal(data, s);
      }
      const { data, error } = await supabase.rpc('finish_meeting_upload', { p_id: id, p_verified_sha256: s.sha256 });
      if (error) throw new Error(error.message);
      return data;
    }, { write: true, destructive: false, idempotent: true });
  register('manage_meeting_attachment_upload', 'Admin upload transfer/reconciliation/cleanup. action=transfer_chunk accepts id, exact byte offset and data_base64 of 1–262144 original bytes (maximum 349528 base64 characters). Server forwards caller auth internally and owns HEAD/TUS state; never supply an OAuth token or arbitrary URL. Exact replay is unchanged; changed chunk bytes conflict. transfer_status returns committed/storage offsets and pending-chunk bounds; retry the exact pending chunk after uncertainty. A lost creation Location returns creation_uncertain without another POST; operator reconciliation is required. Confirmed pre-creation JWT expiry returns authentication_required only if its durable intent is safely cleared; refresh the connection and retry the same session. Transfer is bound to its initiating admin. action=status retains session/checksum/stored-object metadata. action=cancel records a durable cancelled receipt and removes any completed staged object; it does not terminate partial TUS resources or revoke issued capabilities. Private partial bytes expire in Storage, and in-flight writes may require repeated cleanup after capabilities expire. Completed attachments are protected. action=list_cleanup lists up to 100 expired/cancelled receipts. No existing backfill attachments are deleted automatically.',
    { action: z.enum(['status','cancel','list_cleanup','transfer_chunk','transfer_status']), id: uuid.optional(), offset: z.number().int().min(0).default(0), data_base64: z.string().min(4).max(MCP_UPLOAD_BASE64_MAX).optional() }, async ({ action, id, offset, data_base64 }) => {
      await ensureAdmin();
      if (action === 'list_cleanup') {
        const { data, error } = await supabase.from('meeting_upload_sessions').select('*').neq('state','complete')
          .or(`state.eq.cancelled,expires_at.lt.${new Date().toISOString()}`).order('id').range(offset,offset+99);
        if (error) throw new Error(error.message);
        return data;
      }
      if (!id) throw new Error('id is required for session actions');
      if (action === 'transfer_chunk' || action === 'transfer_status') {
        return transferMeetingChunk(supabase, await session(id), context, {offset,data_base64,statusOnly:action==='transfer_status'});
      }
      if (action === 'cancel') {
        const { data: s, error } = await supabase.rpc('cancel_meeting_upload', { p_id: id });
        if (error) throw new Error(error.message);
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([s.storage_path]);
        if (removeError) throw new Error(`Session cancelled; retry cleanup for ${id}: ${removeError.message}`);
        return s;
      }
      const s = await session(id);
      const { data, error } = await supabase.storage.from(BUCKET).info(s.storage_path);
      if (error && !['404','400'].includes(String(error.status))) throw new Error(error.message);
      return { ...s, expired: Date.parse(s.expires_at) <= Date.now(), stored_object: data ?? null, attachment_id: s.state === 'complete' ? s.id : null };
    }, { write: true, destructive: true, idempotent: true });
}

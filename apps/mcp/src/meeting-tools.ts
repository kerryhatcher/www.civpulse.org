import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { registerMeetingImportTools } from './meeting-import-tools';
import { registerMeetingUploadTools } from './meeting-upload-tools';
import { createToolkit } from './toolkit';

const BUCKET = 'meeting-attachments';
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = {
  json: 'application/json', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

export function meetingDocumentType(fileName: string) {
  if (!fileName || fileName.length > 255 || /[\x00-\x1f\x7f/\\]/.test(fileName) || fileName.trim() !== fileName) {
    throw new Error('Use a file name of 1–255 characters without paths or control characters');
  }
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const contentType = FILE_TYPES[extension];
  if (!contentType) throw new Error('Unsupported document type. Use PDF, Office, OpenDocument, TXT or CSV');
  return { extension, contentType };
}

/** Validate before allocating decoded bytes or writing to Storage. */
export function decodeMeetingDocument(fileName: string, base64: string) {
  const { extension, contentType } = meetingDocumentType(fileName);
  if (!base64 || base64.length > 4 * Math.ceil(MAX_DOCUMENT_BYTES / 3) || base64.length % 4 !== 0 ||
      /[^A-Za-z0-9+/=]/.test(base64) || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('Provide valid base64 without a data-URL prefix (maximum document size: 25 MB)');
  }
  const binary = atob(base64);
  if (!binary.length || binary.length > MAX_DOCUMENT_BYTES) throw new Error('Document size must be 1 byte–25 MB');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return { bytes, extension, contentType };
}

export function registerMeetingTools(server: McpServer, supabase: SupabaseClient) {
  registerMeetingImportTools(server, supabase);
  registerMeetingUploadTools(server, supabase);
  const { register, readRpc } = createToolkit(server, supabase);
  const uuid = z.string().uuid();
  readRpc('get_meeting', 'Get a meeting’s notes, transcript, attendance, votes and attachment metadata through its event/calendar visibility gate. Use this before uploading to avoid duplicates.',
    { id: uuid }, 'get_meeting', ({ id }) => ({ p_id: id }));

  register('upload_meeting_attachment', 'Upload a document to an existing meeting (admin only, maximum 3 MiB via inline base64; use begin_meeting_attachment_upload for larger originals up to 25 MiB). Set is_meeting=true with create_event/update_event first. Supply file_name and base64 bytes without a data-URL prefix. PDF, Office, OpenDocument, TXT and CSV are supported. The file inherits meeting visibility; no public bucket is used. Uploads create new attachments: after an uncertain result, inspect get_meeting before retrying.',
    { meeting_id: uuid, file_name: z.string().min(1).max(255), data_base64: z.string().min(4).max(4 * Math.ceil(3 * 1024 * 1024 / 3)) },
    async ({ meeting_id, file_name, data_base64 }) => {
      const document = decodeMeetingDocument(file_name, data_base64);
      if (document.bytes.length > 3 * 1024 * 1024) throw new Error('Inline upload maximum is 3 MiB; use begin_meeting_attachment_upload');
      const { data: meeting, error: meetingError } = await supabase.rpc('get_meeting', { p_id: meeting_id });
      if (meetingError) throw new Error(meetingError.message);
      if (meeting?.status !== 'ok') throw new Error('Meeting not found or unavailable; mark the event is_meeting=true first');
      const attachmentId = crypto.randomUUID();
      const columns = 'id,meeting_id,file_name,mime_type,size_bytes,created_at';
      const storagePath = `${meeting_id}/${attachmentId}.${document.extension}`;
      const bucket = supabase.storage.from(BUCKET);
      const { error: uploadError } = await bucket.upload(storagePath, document.bytes, { contentType: document.contentType, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      // Storage and Postgres are separate services. Retain bytes until metadata is confirmed.
      try {
        const { data, error } = await supabase.from('meeting_attachments').insert({
          id: attachmentId, meeting_id, file_name, storage_path: storagePath, mime_type: document.contentType, size_bytes: document.bytes.length,
        }).select(columns).single();
        if (error) throw new Error(error.message);
        return data;
      } catch (error) {
        // An interrupted response can hide a committed insert. Do not remove
        // its object, or destroy evidence when the recovery read also fails.
        const recovered = await supabase.from('meeting_attachments').select(columns).eq('id', attachmentId).maybeSingle();
        if (!recovered.error && recovered.data) return recovered.data;
        throw new Error(`Upload outcome uncertain for attachment ${attachmentId}; retained object ${storagePath}. Inspect get_meeting before retrying or reconciling the upload`);
      }
    }, { write: true, destructive: false });

  register('get_meeting_attachment_url', 'Get a 60-second download URL for an attachment of a permitted meeting. Requires both meeting_id and attachment_id; visibility is checked before signing. Never persist the expiring URL as a source link.',
    { meeting_id: uuid, attachment_id: uuid }, async ({ meeting_id, attachment_id }) => {
      const { data: meeting, error } = await supabase.rpc('get_meeting', { p_id: meeting_id });
      if (error) throw new Error(error.message);
      const attachment = meeting?.status === 'ok'
        ? meeting.attachments?.find((item: { id: string }) => item.id === attachment_id) : null;
      if (!attachment) return { status: 'missing' };
      const { data, error: signError } = await supabase.storage.from(BUCKET)
        .createSignedUrl(attachment.storage_path, 60, { download: attachment.file_name });
      if (signError) throw new Error(signError.message);
      return { status: 'ok', attachment_id, file_name: attachment.file_name, url: data.signedUrl, expires_in: 60 };
    });
}

import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createToolkit } from './toolkit';

export interface DocumentContext { apiUrl?: string; accessToken?: string }
export function registerDocumentTools(server: McpServer, supabase: SupabaseClient, context: DocumentContext) {
  const {register,readRpc} = createToolkit(server,supabase); const uuid=z.string().uuid();
  async function api(path: string, body?: Record<string,unknown>) {
    if (!context.apiUrl) throw new Error('The public document archive is not configured yet');
    const base=new URL(context.apiUrl);
    if (base.protocol!=='https:' && !(base.protocol==='http:' && ['localhost','127.0.0.1'].includes(base.hostname))) throw new Error('Invalid document API configuration');
    if (body && !context.accessToken) throw new Error('Authenticated publication context is required');
    const response=await fetch(new URL(path,base.origin),{method:body?'POST':'GET',headers:body?{
      Authorization:`Bearer ${context.accessToken}`,'Content-Type':'application/json',
    }:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000),redirect:'error'});
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || 'Document archive unavailable');
    return data;
  }
  readRpc('get_public_document','Get a published public document and its public meeting links. Admins can also inspect pending/withdrawn publication metadata.',
    {id:uuid},'get_public_document',({id})=>({p_id:id}));
  readRpc('list_public_documents','Browse or search published document titles and file names. This does not search file contents. include_unpublished requires admin access.',
    {query:z.string().max(500).optional(),meeting_id:uuid.optional(),include_unpublished:z.boolean().optional(),limit:z.number().int().min(1).max(50).optional(),offset:z.number().int().min(0).max(10000).optional()},
    'list_public_documents',({query,meeting_id,include_unpublished,limit,offset})=>({p_query:query??'',p_meeting_id:meeting_id??null,p_admin:include_unpublished??false,p_limit:limit??20,p_offset:offset??0}));
  register('link_public_document_meeting','Link an already published document to another public, listed meeting without uploading another copy (admin only). Useful for a combined committee/full-board transcript.',
    {document_id:uuid,meeting_id:uuid},async({document_id,meeting_id})=>{
      const {data,error}=await supabase.rpc('link_public_document_meeting',{p_document_id:document_id,p_meeting_id:meeting_id});
      if(error)throw new Error(error.message);return data;
    },{write:true,destructive:false,idempotent:true});
  register('search_document_contents','Search published document contents using Cloudflare hybrid search. Returns matching passages and document/meeting citations; automated transcripts and OCR can contain errors.',
    {query:z.string().trim().min(1).max(500)},async({query})=>api(`/search?${new URLSearchParams({q:query})}`));
  register('publish_meeting_document','Explicitly publish a public meeting attachment to the unrestricted public document archive (admin only). This creates an independently public copy; changing meeting visibility does not withdraw it. Never use for private research or confidential files. Publication must be enabled by the operator. Inspect the catalog after an uncertain response before retrying.',
    {meeting_id:uuid,attachment_id:uuid,title:z.string().trim().min(1).max(300),source_url:z.url(),
      document_kind:z.enum(['agenda','minutes','packet','presentation','spreadsheet','transcript','other']),
      text_origin:z.enum(['official','automated_transcript','ocr','other']),confirm_public:z.literal(true)},
    async input=>api('/publish',input),{write:true,destructive:false,idempotent:true});
  register('withdraw_public_document','Withdraw a published document from the catalog and delete its public R2 object (admin only). Affects all linked meetings. Search passages are blocked immediately; index cleanup follows R2 sync. Public downloads already copied elsewhere cannot be recalled. Pending publications must be resolved first.',
    {id:uuid},async({id})=>api(`/documents/${id}/withdraw`,{}),{write:true,destructive:true,idempotent:true});
}

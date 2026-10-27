import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseStructuredTurnout } from './structured-turnout';
import { createToolkit } from './toolkit';

const uuid = z.string().uuid();
const count = z.number().int().min(0).max(2147483647).nullable().optional();
const text = z.string().trim().min(1).max(200);
export const resultScope = z.object({ county: text, unit_type: z.enum(['county','precinct','tabulator']),
  unit: text.describe('Canonical precinct code or tabulator ID; county reports use all. Never invent an ID for a cropped tape.'),
  counting_group: z.enum(['all','election_day','advance','absentee_mail','provisional']),
  ballot_style: text.describe('Use all for combined ballots; preserve primary party/ballot style when separate.') }).strict();
export const resultSnapshot = z.object({ election_date: z.string().date(), status: z.enum(['unofficial','official','certified']),
  note: z.string().max(2000).optional(),
  turnout: z.object({ ballots: count, voters: count, registered: count, precincts_reported: count, precincts_total: count }).strict(),
  contests: z.array(z.object({ contest_id: uuid.optional(), question_id: uuid.optional(),
    choices: z.array(z.object({ person_id: uuid.optional(), label: text, votes: z.number().int().min(0).max(2147483647) }).strict()).min(1).max(100),
    total_votes: count, unresolved_write_ins: count, ballots: count, registered: count,
    precincts_reported: count, precincts_total: count, undervotes: count, overvotes: count }).strict()).max(100) }).strict();

const source = z.object({path:z.string().regex(/^[a-f0-9]{64}\.(jpg|png|pdf)$/),locator:z.string().min(1).max(2000),transcription:z.string().min(1).max(10000)}).strict();
const operation = z.discriminatedUnion('action', [
 z.object({action:z.literal('import_turnout'),document:z.string().min(2).max(2097152),sha256:z.string().regex(/^[a-f0-9]{64}$/),expected_report_id:uuid.nullable().default(null),dry_run:z.boolean().default(true)}).strict(),
 z.object({action:z.literal('read_turnout'),election_id:uuid,report_id:uuid.nullable().default(null),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(100).default(100)}).strict(),
 z.object({action:z.literal('upload'),base64:z.string().min(4).max(13981016),mime_type:z.enum(['image/jpeg','image/png','application/pdf'])}).strict(),
 z.object({action:z.literal('view'),path:z.string().regex(/^[a-f0-9]{64}\.(jpg|png|pdf)$/)}).strict(),
 z.object({action:z.literal('read'),election_id:uuid,history:z.boolean().default(false),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(100).default(50)}).strict(),
 z.object({action:z.literal('import'),election_id:uuid,scope:resultScope,observed_at:z.string().datetime({offset:true}),snapshot:resultSnapshot,
 sources:z.array(source).min(1).max(20),expected_report_id:uuid.nullable().default(null),dry_run:z.boolean().default(true)}).strict(),
]);

export function registerElectionResultTools(server: McpServer, supabase: SupabaseClient) {
 const { register } = createToolkit(server, supabase);
 register('manage_election_results', 'Structured Georgia SOS JSON: import_turnout accepts sanitized schema-v1 document text plus exact UTF-8 SHA-256, maximum 2 MiB / 636 rows in one atomic transaction, dry_run defaults true; read_turnout returns paged typed measures, provenance and history. Preserve unavailable values, source as-of separately from capture, county FIPS, original styles and all absentee measures. Never add overlapping views. JSON evidence is immutable in Postgres; no image upload is needed. Admin election result workflow: upload original JPEG/PNG/PDF base64 (10 MiB, SHA-256 dedup), view a private original, read paginated scoped snapshots/history, or import a complete cumulative report (dry_run=true by default). The agent performs OCR; uploading does not extract votes. Resolve printed election date, tabulator/precinct, ballot style and candidate/question UUIDs. Same scope+timestamp+snapshot is a no-op even for different photos; conflicting OCR rejects. Newer reports require expected_report_id and retain history. Never add county summaries to tapes or successive reports. Unknown metrics stay null; unreadable choices block saving. Printed total_votes excludes separately printed unresolved write-ins. Preserve election versus contest turnout denominators. Certification requires explicit support, not tape boilerplate. Future elections accept turnout only. Sources retain private crop/page locators and transcription. Empty reports means not reported, not zero.',
 {operation}, async ({operation:input})=>{
  if(input.action==='import_turnout') {
   parseStructuredTurnout(input.document);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.document)))).map(v=>v.toString(16).padStart(2,'0')).join('');
   if(digest!==input.sha256)throw new Error('Evidence checksum mismatch');
   const {data,error}=await supabase.rpc('import_structured_turnout',{p_document:input.document,p_sha256:input.sha256,p_expected_report_id:input.expected_report_id,p_dry_run:input.dry_run});
   if(error)throw error;return data;
  }
  if(input.action==='read_turnout') {
   const {data,error}=await supabase.rpc('get_structured_turnout',{p_election_id:input.election_id,p_report_id:input.report_id,p_offset:input.offset,p_limit:input.limit});
   if(error)throw error;return data;
  }
  if(input.action==='read') {
   const {data,error}=await supabase.rpc('get_election_results',{p_election_id:input.election_id,p_history:input.history,p_offset:input.offset,p_limit:input.limit});
   if(error)throw error;return data;
  }
  if(input.action==='import') {
   const {data,error}=await supabase.rpc('import_election_result',{p_election_id:input.election_id,p_scope:input.scope,p_observed_at:input.observed_at,
    p_snapshot:input.snapshot,p_sources:input.sources,p_expected_report_id:input.expected_report_id,p_dry_run:input.dry_run});
   if(error)throw error;return data;
  }
  const action=input.action;
  const path=input.action==='view'?input.path:undefined;
  const base64=input.action==='upload'?input.base64:undefined;
  const mime_type=input.action==='upload'?input.mime_type:undefined;
      const bucket=supabase.storage.from('election-evidence');
      if(action==='view') {
        if(!path) throw new Error('path required');
        const {data,error}=await bucket.createSignedUrl(path,600); if(error)throw error; return data;
      }
      if(!base64 || !mime_type || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('Valid base64 and MIME required');
      const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
      if(!bytes.length || bytes.length>10*1024*1024)throw new Error('Original exceeds 10 MiB');
      const signature = mime_type==='image/jpeg' ? bytes[0]===255&&bytes[1]===216&&bytes[2]===255 : mime_type==='image/png' ? [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v) : new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
      if(!signature)throw new Error('File signature does not match MIME');
      const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
      const name=`${sha}.${mime_type==='image/jpeg'?'jpg':mime_type==='image/png'?'png':'pdf'}`;
      const {error}=await bucket.upload(name,bytes,{contentType:mime_type,upsert:false});
      if(error) {
        // Reconcile retries by verifying actual bytes, not by swallowing upload errors.
        const existing=await bucket.download(name);
        if(existing.error)throw error;
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await existing.data.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
        if(digest!==sha)throw new Error('Stored evidence checksum mismatch');
      }
      return {path:name,sha256:sha,bytes:bytes.length,duplicate:Boolean(error)};

 },{write:true,destructive:false,idempotent:true});
}

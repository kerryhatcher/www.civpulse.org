import type {McpServer} from '@modelcontextprotocol/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {createToolkit} from './toolkit';
import {parseSimbliMinutes,SIMBLI_ADAPTER} from './simbli-minutes';
const uuid=z.string().uuid(),key=z.string().min(1).max(500);
const citation=z.object({source_url:z.string().url().startsWith('https://').max(2000),document_sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const ballot=z.object({person_id:uuid,choice:z.enum(['yes','no','abstain','recused','unknown']),text:z.string().min(1).max(2000),source_key:key.optional()}).strict();
const motion=z.object({source_key:key,locator:z.string().min(1).max(2000),subject:z.string().min(1).max(300),description:z.string().max(100000).optional(),ballots:z.array(ballot).max(100)}).strict();
export function expandCompact(provenance:z.infer<typeof citation>,attendance:any[],motions:z.infer<typeof motion>[]) {
 const rows:any[]=[];
 for(const a of attendance)rows.push({kind:'attendance',source_key:a.source_key,provenance:{...provenance,locator:a.locator},data:{person_id:a.person_id,status:a.status,evidence:a.evidence}});
 for(const m of motions){rows.push({kind:'vote',source_key:m.source_key,provenance:{...provenance,locator:m.locator},data:{subject:m.subject,...(m.description!==undefined?{description:m.description}:{})}});
 for(const b of m.ballots)rows.push({kind:'choice',source_key:b.source_key??`${m.source_key}:person:${b.person_id}`,provenance:{...provenance,locator:m.locator},data:{person_id:b.person_id,vote_source_key:m.source_key,choice:b.choice,original_text:b.text}});}
 if(rows.length<1||rows.length>2000||new TextEncoder().encode(JSON.stringify(rows)).length>2*1024*1024)throw Error('Maximum 2000 expanded observations / 2 MiB');
 if(new Set(rows.map(r=>r.source_key)).size!==rows.length)throw Error('Duplicate source keys');
 return rows;
}
export function registerMeetingSourceImport(server:McpServer,supabase:SupabaseClient){
 const {register}=createToolkit(server,supabase);
 register('import_meeting_source','Admin compact or checked-attachment import/reconciliation. Default dry run. Adapter simbli-minutes-v1 reads captured public agenda/minutes JSON text, both Voting and VotingHTML. Supply exact source-name→existing person UUID bindings, never fuzzy guesses. Attachment bytes are downloaded with caller auth and SHA-256 checked. No arbitrary URL fetch. Compact payload shares provenance once and nests named ballots; 150 observations fit one call. Rows are ordered partial observations in one transaction, NOT all-or-nothing: unchanged retry is a no-op, conflicts/errors are reported without immutable overwrite. Reconcile existing sources before import; do not invent new keys to bypass conflicts. A legacy imported meeting requires explicit existing source-key bindings. Does not infer outcomes or attendance from roster/totals. No automatic publication; rebuild public pages.',{
 meeting_id:uuid,provider:z.string().min(1).max(100),dry_run:z.boolean().default(true),reconcile_only:z.boolean().default(false),
 provenance:citation,
 attachment:z.object({id:uuid,adapter:z.literal(SIMBLI_ADAPTER),people:z.array(z.object({name:z.string().min(1).max(300),person_id:uuid}).strict()).max(100),
 source_keys:z.record(z.string(),key).optional()}).strict().optional(),
 attendance:z.array(z.object({source_key:key,locator:z.string().min(1).max(2000),person_id:uuid,status:z.enum(['present','absent','excused','observed','unknown']),evidence:z.string().min(1).max(2000)}).strict()).max(100).default([]),
 motions:z.array(motion).max(500).default([])
 },async input=>{
 const {data:meeting,error}=await supabase.rpc('get_meeting',{p_id:input.meeting_id});
 if(error||meeting?.status!=='ok')throw Error('Meeting unavailable');
 let motions=input.motions,attendance=input.attendance;let warnings:any[]=[];let document:any=null;
 const sources=(meeting.sources??[]).filter((s:any)=>s.provider===input.provider);
 if(input.attachment){
 if(motions.length||attendance.length)throw Error('Attachment and inline observations are mutually exclusive');
 const a=(meeting.attachments??[]).find((a:any)=>a.id===input.attachment!.id&&a.meeting_id===input.meeting_id);
 if(!a||!['text/plain','application/json'].includes(a.mime_type)||!Number.isInteger(a.size_bytes)||a.size_bytes<1||a.size_bytes>2*1024*1024||typeof a.storage_path!=='string'||(!a.storage_path.startsWith(input.meeting_id+'/')||/[?#\\\x00-\x1f]/.test(a.storage_path)||a.storage_path.split('/').some((s:string)=>!s||s==='.'||s==='..')))throw Error('Matching bounded TXT/JSON attachment required');
 if(a.sha256&&a.sha256!==input.provenance.document_sha256)throw Error('Attachment checksum metadata conflict');
 const {data:blob,error:downloadError}=await supabase.storage.from('meeting-attachments').download(a.storage_path);
 if(downloadError||!blob)throw Error('Attachment download failed');
 if(blob.size!==a.size_bytes)throw Error('Attachment size mismatch');
 const bytes=await blob.arrayBuffer();if(bytes.byteLength!==a.size_bytes)throw Error('Attachment size mismatch');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==input.provenance.document_sha256)throw Error('Original SHA-256 mismatch');
 const parsed=parseSimbliMinutes(new TextDecoder('utf-8',{fatal:true}).decode(bytes));warnings=parsed.warnings;
 if(!parsed.source_urls.includes(input.provenance.source_url))throw Error('Source URL must match captured Minutes source URL exactly');
 const people=new Map(input.attachment.people.map(p=>[p.name,p.person_id]));
 if(people.size!==input.attachment.people.length)throw Error('Duplicate source name binding');
 const missing=[...new Set(parsed.motions.flatMap(m=>[...m.ballots,...m.absences].map(b=>b.name)))].filter(n=>!people.has(n));
 document={attachment_id:a.id,sha256:hash,adapter:parsed.adapter,motions:parsed.motions.length,named_ballots:parsed.motions.reduce((n,m)=>n+m.ballots.filter(b=>b.choice!=='unknown').length,0),unknown_choices:parsed.motions.reduce((n,m)=>n+m.ballots.filter(b=>b.choice==='unknown').length,0)};
 const keyFor=(locator:string,fallback:string)=>input.attachment!.source_keys?.[locator]??fallback;
 motions=parsed.motions.map(m=>({source_key:keyFor(m.locator,`simbli:${m.item_id}:round:${m.round}`),locator:m.locator,subject:m.subject,description:m.description,ballots:m.ballots.map(b=>({person_id:people.get(b.name)!,choice:b.choice,text:b.text,source_key:input.attachment!.source_keys?.[m.locator+':'+b.name]}))}));
 const reconciliation=parsed.motions.map((m,i)=>{
 const stored=sources.find((s:any)=>s.kind==='vote'&&s.source_key===motions[i].source_key);
 const storedBallots=stored?sources.filter((s:any)=>s.kind==='choice'&&s.vote_id===stored.vote_id):[];
 const differences=stored?['subject','description'].filter(f=>stored.data?.[f]!==motions[i][f as 'subject'|'description']):[];
 if(stored&&stored.provenance?.document_sha256!==hash)differences.push('document_sha256');
 const expectedBallots=motions[i].ballots.map((b,j)=>({person_id:b.person_id,source_key:b.source_key??`${motions[i].source_key}:person:${b.person_id}`,source_name:m.ballots[j].name,choice:b.choice,original_text:b.text}));
 const matched=new Set<number>(),missingBallots:any[]=[],ballotDifferences:any[]=[];
 for(const b of expectedBallots){
  const index=storedBallots.findIndex((s:any,j:number)=>!matched.has(j)&&s.person_id===b.person_id&&s.source_key===b.source_key);
  if(index<0){missingBallots.push(b);continue;}
  matched.add(index);const prior=storedBallots[index];
  if(prior.data?.choice!==b.choice||prior.data?.original_text!==b.original_text)ballotDifferences.push({person_id:b.person_id,source_key:b.source_key,source_name:b.source_name,expected:{choice:b.choice,original_text:b.original_text},stored:{choice:prior.data?.choice,original_text:prior.data?.original_text}});
 }
 const unexpectedBallots=storedBallots.filter((_:any,j:number)=>!matched.has(j)).map((s:any)=>({person_id:s.person_id,source_key:s.source_key,choice:s.data?.choice,original_text:s.data?.original_text}));
 for(const b of missingBallots)differences.push('missing_ballot:'+b.source_key);
 for(const b of unexpectedBallots)differences.push('unexpected_ballot:'+b.source_key);
 for(const b of ballotDifferences)differences.push('ballot:'+b.source_key);
 const hasConflict=differences.some(d=>!d.startsWith('missing_ballot:'));
 return {locator:m.locator,source_key:motions[i].source_key,vote_id:stored?.vote_id??null,
 status:!stored?'missing':hasConflict?'differs':missingBallots.length?'partial':'complete',
 differences,missing_ballots:missingBallots,unexpected_ballots:unexpectedBallots,ballot_differences:ballotDifferences,
 stored_ballots:storedBallots.length,document_ballots:m.ballots.length};
 });
 const unboundExisting=sources.some((s:any)=>s.kind==='vote')&&parsed.motions.some(m=>!input.attachment!.source_keys?.[m.locator]);
 if(input.reconcile_only||missing.length||unboundExisting||warnings.length)return {status:'review_required',document,missing_people:missing,warnings,reconciliation,existing_motions:sources.filter((s:any)=>s.kind==='vote').map((s:any)=>({source_key:s.source_key,vote_id:s.vote_id,subject:s.data?.subject,ballots:sources.filter((b:any)=>b.kind==='choice'&&b.vote_id===s.vote_id).length})),reason:unboundExisting?'Bind every document motion locator to its existing source key before importing into an already imported meeting':undefined};
 // Presence is supported only for named cast ballots; absent/unknown labels never imply presence.
 const observed=new Map<string,{evidence:string;locator:string}>();
 for(const m of motions)for(const b of m.ballots)if(b.choice!=='unknown'&&!observed.has(b.person_id))observed.set(b.person_id,{evidence:b.text,locator:m.locator});
 const absent=new Map<string,{evidence:string;locator:string}>();
 for(const m of parsed.motions)for(const a of m.absences){const id=people.get(a.name)!;if(!observed.has(id)&&!absent.has(id))absent.set(id,{evidence:a.text,locator:m.locator});}
 attendance=[...observed].map(([person_id,evidence])=>({source_key:keyFor(`attendance:${person_id}`,`simbli:attendance:${person_id}`),person_id,status:'observed' as const,...evidence}));
 attendance.push(...[...absent].map(([person_id,evidence])=>({source_key:keyFor(`attendance:${person_id}`,`simbli:attendance:${person_id}`),person_id,status:'absent' as any,...evidence})));
 }
 const rows=expandCompact(input.provenance,attendance,motions);
 if(input.reconcile_only)return {status:'reconciled',observations:rows.length,existing:sources.length};
 const {data,error:importError}=await supabase.rpc('import_meeting_records_compact',{p_meeting_id:input.meeting_id,p_provider:input.provider,p_records:rows,p_dry_run:input.dry_run});
 if(importError)throw Error(importError.message);
 return {...data,errors:(data.errors??[]).slice(0,25),errors_truncated:(data.errors?.length??0)>25,document,warnings};
 },{write:true,destructive:false,idempotent:true});
}

import type {SupabaseClient} from '@supabase/supabase-js';
export const MCP_UPLOAD_CHUNK_BYTES=256*1024;
export const MCP_UPLOAD_BASE64_MAX=4*Math.ceil(MCP_UPLOAD_CHUNK_BYTES/3);
export interface UploadRelayContext { apiUrl:string; publicKey:string; accessToken:string; transport?:typeof fetch }
interface Session {id:string;storage_path:string;mime_type:string;size_bytes:number;state:string;expires_at:string}

export function decodeRelayChunk(encoded:string):Uint8Array<ArrayBuffer> {
 if(encoded.length<4||encoded.length>MCP_UPLOAD_BASE64_MAX||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw Error('Use canonical base64, 1–262144 decoded bytes, no data URL');
 const text=atob(encoded),bytes=Uint8Array.from(text,c=>c.charCodeAt(0));
 if(bytes.length<1||bytes.length>MCP_UPLOAD_CHUNK_BYTES||btoa(text)!==encoded)throw Error('Invalid or oversized chunk');return bytes;
}
export function relayEndpoint(context:UploadRelayContext):URL {
 const url=new URL(context.apiUrl);
 if(url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw Error('Invalid Storage configuration');
 if(url.hostname.endsWith('.supabase.co')&&!url.hostname.endsWith('.storage.supabase.co'))url.hostname=url.hostname.replace('.supabase.co','.storage.supabase.co');
 url.pathname='/storage/v1/upload/resumable';return url;
}
export function checkedRelayLocation(value:string,endpoint:URL):URL {
 const url=new URL(value,endpoint);
 if(url.origin!==endpoint.origin||url.username||url.password||url.search||url.hash||!url.pathname.startsWith(endpoint.pathname+'/')||url.pathname===endpoint.pathname+'/')throw Error('Storage returned an unexpected transfer location');return url;
}
export async function transferMeetingChunk(api:SupabaseClient,session:Session,context:UploadRelayContext|undefined,input:{offset?:number;data_base64?:string;statusOnly?:boolean}) {
 if(!context?.accessToken||!context.publicKey)throw Error('Authenticated server upload context is unavailable; never extract a connector token');
 const endpoint=relayEndpoint(context),transport=context.transport??fetch;
 const headers={Authorization:`Bearer ${context.accessToken}`,apikey:context.publicKey,'Tus-Resumable':'1.0.0'};
 const bytes=input.statusOnly?null:decodeRelayChunk(input.data_base64??'');
 const offset=input.offset??0;
 if(!Number.isSafeInteger(offset)||offset<0||offset+(bytes?.length??0)>session.size_bytes)throw Error('Chunk offset/size outside original document');
 async function state(action:string,extra:Record<string,unknown>={}) {
  const {data,error}=await api.rpc('manage_meeting_upload_transfer',{p_action:action,p_id:session.id,...extra});if(error)throw Error(['P0001','42501'].includes(error.code)?error.message:'Upload transfer state unavailable; retry reconciliation');return data;
 }
 const publicState=(r:any,extra:Record<string,unknown>={})=>({state:r.state,offset:Number(r.offset??0),size_bytes:Number(session.size_bytes),max_chunk_bytes:MCP_UPLOAD_CHUNK_BYTES,
  ...(r.pending_chunk?{pending_chunk:{offset:Number(r.pending_chunk.chunk_offset),size_bytes:r.pending_chunk.size_bytes}}:{}),...extra});
 let current=await state('status');
 if(input.statusOnly&&current.state==='not_started')return publicState(current);
 if(session.state==='complete')return publicState(current,{state:'complete',offset:Number(session.size_bytes),attachment_id:session.id});
 if(session.state!=='pending'||Date.parse(session.expires_at)<=Date.now())throw Error('Upload cancelled or expired');
 current=await state('acquire');const lease=current.lease;
 const action=(name:string,extra:Record<string,unknown>={})=>state(name,{p_lease:lease,...extra});
 async function request(url:URL,options:RequestInit={}) {return transport(url,{...options,headers:{...headers,...options.headers},redirect:'error',signal:AbortSignal.timeout(20000)});}
 async function head(location:URL) {
  let response:Response;try{response=await request(location,{method:'HEAD'});}catch{throw Error('Storage HEAD receipt unavailable; retry transfer_status before resending bytes');}if(!response.ok)throw Error(`Storage HEAD unavailable (${response.status}); retain the session and reconcile`);
  const size=Number(response.headers.get('Upload-Length')),position=Number(response.headers.get('Upload-Offset'));
  const metadata=new Map((response.headers.get('Upload-Metadata')??'').split(',').filter(Boolean).map(item=>{const [key,value]=item.trim().split(' ');return [key,value?atob(value):''];}));
  if(!response.headers.has('Upload-Length')||!response.headers.has('Upload-Offset')||size!==Number(session.size_bytes)||!Number.isSafeInteger(position)||position<0||position>size||metadata.get('bucketName')!=='meeting-attachments'||metadata.get('objectName')!==session.storage_path||metadata.get('contentType')!==session.mime_type)throw Error('Storage transfer does not match this session; no bytes forwarded');
  return position;
 }
 try {
  if(!current.location){
   if(current.creating)return publicState(current,{state:'creation_uncertain',message:'A previous Storage creation has no saved Location. Do not repeat POST or invent a source key; operator reconciliation is required.'});
   if(input.statusOnly)return publicState(current,{state:'not_started'});
   if(offset!==0)throw Error('Start a new transfer at offset 0');
   await action('creating');
   const metadata={bucketName:'meeting-attachments',objectName:session.storage_path,contentType:session.mime_type};
   let created:Response;
   try{created=await request(endpoint,{method:'POST',headers:{'Upload-Length':String(session.size_bytes),'Upload-Metadata':Object.entries(metadata).map(([k,v])=>`${k} ${btoa(v)}`).join(',')}});}catch{return publicState(current,{state:'creation_uncertain',message:'Storage creation receipt unavailable; do not blindly create another transfer.'});}
   if(created.status!==201||!created.headers.get('Location'))return publicState(current,{state:'creation_uncertain',message:`Storage creation not confirmed (${created.status}); operator reconciliation required.`});
   const location=checkedRelayLocation(created.headers.get('Location')!,endpoint);
   current=await action('location',{p_location:location.href});
  }
  const location=checkedRelayLocation(current.location,endpoint);
  let storedOffset=await head(location);
  if(input.statusOnly){
   const pending=current.pending_chunk;
   if(pending&&storedOffset===Number(pending.chunk_offset)+pending.size_bytes)current=await action('commit',{p_offset:pending.chunk_offset});
   if(pending&&(storedOffset<Number(pending.chunk_offset)||storedOffset>Number(pending.chunk_offset)+pending.size_bytes))throw Error('Storage offset outside pending receipt; no bytes forwarded');
   if(!pending&&storedOffset!==Number(current.offset))throw Error('Storage offset differs from committed receipts; no bytes forwarded');
   return publicState(current,{storage_offset:storedOffset});
  }
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes!))].map(v=>v.toString(16).padStart(2,'0')).join('');
  current=await action('prepare',{p_offset:offset,p_size:bytes!.length,p_sha256:hash});
  if(current.chunk.committed&&storedOffset<Number(current.offset))throw Error('Storage offset behind committed receipts; no bytes forwarded');
  if(current.chunk.committed)return publicState(current,{status:'unchanged',storage_offset:storedOffset});
  const end=offset+bytes!.length;
  if(storedOffset<offset||storedOffset>end)throw Error('Storage offset conflicts with pending chunk; no bytes forwarded');
  if(storedOffset<end){
   let failure=false;
   try{const response=await request(location,{method:'PATCH',headers:{'Upload-Offset':String(storedOffset),'Content-Type':'application/offset+octet-stream'},body:bytes!.slice(storedOffset-offset)});failure=!response.ok;}catch{failure=true;}
   // Always HEAD after PATCH, including a lost/error response. Never assume a
   // response timeout means the bytes were rejected or blindly resend a prefix.
   storedOffset=await head(location);
   if(storedOffset!==end)return publicState(current,{status:'pending',storage_offset:storedOffset,message:'Retry the exact pending chunk; HEAD will reconcile its accepted prefix.'});
   current=await action('commit',{p_offset:offset});
   return publicState(current,{status:failure?'reconciled':'accepted',storage_offset:storedOffset});
  }
  current=await action('commit',{p_offset:offset});return publicState(current,{status:'reconciled',storage_offset:storedOffset});
 }finally{try{await action('release');}catch{/* A durable lease expires; never hide the original transfer result. */}}
}

import {expect,test} from 'bun:test';
import {checkedRelayLocation,decodeRelayChunk,relayEndpoint,transferMeetingChunk,MCP_UPLOAD_CHUNK_BYTES} from '../../apps/mcp/src/meeting-upload-relay';
const endpoint=new URL('https://project.storage.supabase.co/storage/v1/upload/resumable');
const session={id:'session',storage_path:'meeting/session.pdf',mime_type:'application/pdf',size_bytes:8,state:'pending',expires_at:'2099-01-01T00:00:00Z'};
const metadata=['bucketName '+btoa('meeting-attachments'),'objectName '+btoa(session.storage_path),'contentType '+btoa(session.mime_type)].join(',');
test('bounded canonical base64 and trusted Storage locations reject alternative credential destinations',()=>{
 expect(decodeRelayChunk(btoa('1234')).length).toBe(4);expect(decodeRelayChunk(Buffer.alloc(MCP_UPLOAD_CHUNK_BYTES).toString('base64')).length).toBe(MCP_UPLOAD_CHUNK_BYTES);
 for(const value of ['', 'a','AB==','YWJj\n','data:text/plain;base64,YWJj',Buffer.alloc(MCP_UPLOAD_CHUNK_BYTES+1).toString('base64')])expect(()=>decodeRelayChunk(value)).toThrow();
 expect(relayEndpoint({apiUrl:'https://project.supabase.co',publicKey:'public',accessToken:'caller'}).href).toBe(endpoint.href);
 for(const url of ['https://evil.test/storage/v1/upload/resumable/id','https://secret@project.storage.supabase.co/storage/v1/upload/resumable/id',endpoint.href+'/id?token=secret',endpoint.href+'/id#fragment','https://project.storage.supabase.co/other/id'])expect(()=>checkedRelayLocation(url,endpoint)).toThrow();
});
function mockState(location=endpoint.href+'/resource'){
 let current:any={state:'pending',offset:0,location,creating:false,lease:'lease',pending_chunk:null},receipt:any;
 const api:any={rpc:async(_name:string,args:any)=>{const {p_action:a}=args;
  if(a==='creating')current={...current,creating:true};
  if(a==='creation_auth_rejected')current={...current,creating:false};
  if(a==='location')current={...current,location:args.p_location,creating:false};
  if(a==='prepare'){if(receipt&&(receipt.sha256!==args.p_sha256||receipt.size_bytes!==args.p_size))return {data:null,error:{code:'P0001',message:'Chunk conflict'}};receipt??={chunk_offset:args.p_offset,size_bytes:args.p_size,sha256:args.p_sha256,committed:false};current={...current,chunk:receipt,pending_chunk:receipt.committed?null:receipt};}
  if(a==='commit'){receipt.committed=true;current={...current,offset:receipt.chunk_offset+receipt.size_bytes,pending_chunk:null,chunk:receipt};}
  return {data:{...current},error:null};}};return api;
}
test('partial accepted prefixes are reconciled without retransmitting them',async()=>{
 const api=mockState(),patches:number[][]=[];let remoteOffset=0;
 const transport:any=async(_url:URL,init:RequestInit)=>{
  if(init.method==='HEAD')return new Response(null,{headers:{'Upload-Offset':String(remoteOffset),'Upload-Length':'8','Upload-Metadata':metadata}});
  const bytes=[...new Uint8Array(await new Response(init.body).arrayBuffer())];patches.push(bytes);
  if(patches.length===1){remoteOffset=3;return new Response(null,{status:500});}remoteOffset=8;return new Response(null,{status:204});
 };
 const context={apiUrl:'https://project.supabase.co',publicKey:'public',accessToken:'caller-secret',transport};
 const input={offset:0,data_base64:btoa('12345678')};
 expect((await transferMeetingChunk(api,session,context,input)).status).toBe('pending');
 expect((await transferMeetingChunk(api,session,context,input)).offset).toBe(8);expect(patches).toEqual([[49,50,51,52,53,54,55,56],[52,53,54,55,56]]);
 const replay=await transferMeetingChunk(api,session,context,input);expect(replay.status).toBe('unchanged');expect(patches).toHaveLength(2);expect(JSON.stringify(replay)).not.toMatch(/caller-secret|resource|lease/);
});
test('completed direct TUS sessions report complete even without a relay record',async()=>{
 const api:any={rpc:async()=>({data:{state:'not_started',offset:0},error:null})};
 const context={apiUrl:'https://project.supabase.co',publicKey:'public',accessToken:'caller',transport:(async()=>{throw Error('Storage must not be called');}) as typeof fetch};
 expect(await transferMeetingChunk(api,{...session,state:'complete'},context,{statusOnly:true})).toMatchObject({state:'complete',offset:8,attachment_id:session.id});
});
test('only confirmed pre-creation JWT expiry permits retry; ambiguous receipts stay blocked',async()=>{
 const expired={statusCode:'403',code:'AccessDenied',error:'Unauthorized',message:'"exp" claim timestamp check failed'};
 const input={offset:0,data_base64:btoa('12345678')};
 const api=mockState('');let posts=0,remoteOffset=0;
 const context={apiUrl:'https://project.supabase.co',publicKey:'public',accessToken:'caller',transport:(async(_url:any,init:any)=>{
  if(init.method==='POST'){posts++;return posts===1?Response.json(expired,{status:400}):new Response(null,{status:201,headers:{Location:endpoint.href+'/resource'}});}
  if(init.method==='PATCH'){remoteOffset=8;return new Response(null,{status:204});}
  return new Response(null,{headers:{'Upload-Offset':String(remoteOffset),'Upload-Length':'8','Upload-Metadata':metadata}});
 }) as typeof fetch};
 expect((await transferMeetingChunk(api,session,context,input)).state).toBe('authentication_required');
 expect((await transferMeetingChunk(api,session,context,input)).offset).toBe(8);expect(posts).toBe(2);
 for(const response of [Response.json(expired,{status:500}),Response.json({code:'AccessDenied',error:'Unauthorized',message:'RLS rejected'}, {status:403}),Response.json({error:'Unauthorized'},{status:401}),new Response(null,{status:201}),new Response('bad gateway',{status:400}),null]){
  const uncertain=mockState('');let attempts=0;
  const blocked={...context,transport:(async()=>{attempts++;if(!response)throw Error('Lost POST receipt');return response;}) as typeof fetch};
  expect((await transferMeetingChunk(uncertain,session,blocked,input)).state).toBe('creation_uncertain');
  expect((await transferMeetingChunk(uncertain,session,blocked,input)).state).toBe('creation_uncertain');expect(attempts).toBe(1);
 }
 const resetFailure=mockState(''),rpc=resetFailure.rpc;
 resetFailure.rpc=async(name:any,args:any)=>args.p_action==='creation_auth_rejected'?{error:{code:'42501',message:'expired credentials'},data:null}:rpc(name,args);
 expect((await transferMeetingChunk(resetFailure,session,{...context,transport:(async()=>Response.json(expired,{status:400})) as typeof fetch},input)).state).toBe('creation_uncertain');
});
test('foreign-session metadata blocks PATCH and upstream HEAD failures never expose headers',async()=>{
 let patches=0;const context={apiUrl:'https://project.supabase.co',publicKey:'public',accessToken:'caller-secret',transport:(async(_url:any,init:any)=>{if(init.method==='PATCH')patches++;return new Response(null,{headers:{'Upload-Offset':'0','Upload-Length':'8','Upload-Metadata':metadata.replace(btoa(session.storage_path),btoa('other/session.pdf'))}});}) as typeof fetch};
 await expect(transferMeetingChunk(mockState(),session,context,{offset:0,data_base64:btoa('12345678')})).rejects.toThrow('does not match');expect(patches).toBe(0);
 context.transport=async()=>{throw Error('caller-secret raw Authorization headers');};
 try{await transferMeetingChunk(mockState(),session,context,{statusOnly:true});throw Error('Expected failure');}catch(e){expect(String(e)).toContain('HEAD receipt unavailable');expect(String(e)).not.toContain('caller-secret');}
});

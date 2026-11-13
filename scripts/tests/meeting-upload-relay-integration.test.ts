import {expect,test,spyOn} from 'bun:test';import {SQL} from 'bun';
import {createClient} from '../../apps/mcp/node_modules/@supabase/supabase-js';
import {Client} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import {handleRequest} from '../../apps/mcp/src/index';
import {MCP_UPLOAD_CHUNK_BYTES} from '../../apps/mcp/src/meeting-upload-relay';
import {createHmac} from 'node:crypto';
const enabled=process.env.MEETING_RELAY_INTEGRATION==='1';
const hash=(bytes:Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

test.skipIf(!enabled)('isolated real Auth/MCP/TUS transfers reported sizes, reconciles interruption, and denies substitution',async()=>{
 const settings=await Bun.file(process.env.MEETING_RELAY_LOCAL_STATUS!).json();
 if(settings.API_URL!=='http://127.0.0.1:54341')throw Error('This fixture requires isolated API 54341, never shared or hosted');
 const url=settings.API_URL,anon=settings.ANON_KEY,db=new SQL('postgresql://postgres:postgres@127.0.0.1:54342/postgres');
 // Service credential is fixture provisioning/cleanup only, never supplied to MCP.
 const setup=createClient(url,settings.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const suffix=crypto.randomUUID(),users:string[]=[],apis:any[]=[],clients:Client[]=[],sessions:any[]=[],meetings:string[]=[];let org='',cal='',maxRequestBytes=0,patches=0,losePatch=false,losePost=false,loseHead=false,loseHeadAfterPatch=false;
 const originalFetch=globalThis.fetch;let expirePost=false;
 const jwtPart=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const expiredHeader=jwtPart({alg:'HS256',typ:'JWT'}),expiredPayload=jwtPart({role:'authenticated',sub:crypto.randomUUID(),exp:Math.floor(Date.now()/1000)-120,iss:'supabase'});
 const expiredToken=expiredHeader+'.'+expiredPayload+'.'+createHmac('sha256',settings.JWT_SECRET).update(expiredHeader+'.'+expiredPayload).digest('base64url');
 const fault=spyOn(globalThis,'fetch').mockImplementation(async(input:any,init:any)=>{
  const target=new URL(input instanceof Request?input.url:input.toString()),method=init?.method??(input instanceof Request?input.method:'GET');
  if(target.pathname.startsWith('/storage/v1/upload/resumable')){
   expect(target.origin).toBe(url);
   expect(new Headers(init?.headers).get('apikey')===anon).toBe(true);
   if(method==='HEAD'&&loseHead){loseHead=false;throw new TypeError('Synthetic HEAD receipt lost');}
   if(method==='PATCH'){patches++;const response=await originalFetch(input,init);if(loseHeadAfterPatch){loseHeadAfterPatch=false;loseHead=true;}if(losePatch){losePatch=false;throw new TypeError('Synthetic PATCH receipt lost');}return response;}
   if(method==='POST'&&losePost){losePost=false;await originalFetch(input,init);throw new TypeError('Synthetic POST receipt lost');}
   if(method==='POST'&&expirePost){
    expirePost=false;const headers=new Headers(init.headers);headers.set('Authorization','Bearer '+expiredToken);
    const response=await originalFetch(input,{...init,headers});expect(response.status).toBe(400);expect(response.headers.has('Location')).toBe(false);
    expect(await response.clone().json()).toMatchObject({statusCode:'403',code:'AccessDenied',error:'Unauthorized',message:'"exp" claim timestamp check failed'});return response;
   }
  }
  return originalFetch(input,init);
 });
 const call=async(client:Client,name:string,args:any)=>{const result:any=await client.callTool({name,arguments:args});if(result.isError)throw Error(result.content[0].text);return JSON.parse(result.content[0].text);};
 try{
  for(const role of ['admin','admin','user']){
   const email=`relay-${users.length}-${suffix}@example.test`,password='Local-fixture-'+suffix;
   const created=await setup.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;const id=created.data.user.id;users.push(id);
   if(role==='admin')await db`insert into public.admins(user_id) values(${id})`;
   const api=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const login=await api.auth.signInWithPassword({email,password,options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'}});if(login.error)throw login.error;apis.push(api);
   const token=login.data.session!.access_token,issuer=JSON.parse(atob(token.split('.')[1])).iss,env={SUPABASE_URL:url,SUPABASE_ANON_KEY:anon,AUTHORIZATION_SERVER:issuer,MCP_RESOURCE_URL:'http://localhost:8789/mcp'};
   const client=new Client({name:'relay-fixture',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(env.MCP_RESOURCE_URL+'/v2'),{requestInit:{headers:{Authorization:`Bearer ${token}`}},fetch:async(input,init)=>{
    const request=new Request(input,init);if(request.body)maxRequestBytes=Math.max(maxRequestBytes,(await request.clone().arrayBuffer()).byteLength);
    const response=await handleRequest(request,env);const text=await response.clone().text();expect(text.includes(token)||text.includes(settings.SERVICE_ROLE_KEY)).toBe(false);return response;
   }}));clients.push(client);
  }
  org=(await db`insert into public.organizations(name,slug) values('Synthetic relay QA',${'relay-'+suffix}) returning id`)[0].id;
  cal=(await db`insert into public.calendars(organization_id,name,slug) values(${org},'Synthetic relay calendar',${'relay-'+suffix}) returning id`)[0].id;
  for(const visibility of ['public','private'])meetings.push((await db`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility) values(${cal},'Synthetic relay meeting','2026-01-02T18:00Z',true,${visibility}) returning id`)[0].id);
  const authBytes=new TextEncoder().encode('%PDF-1.7');
  const authSession=await call(clients[0],'begin_meeting_attachment_upload',{meeting_id:meetings[0],provider:'relay-qa',source_key:'auth-expiry',file_name:'auth.pdf',size_bytes:authBytes.length,sha256:hash(authBytes),source_url:'https://example.test/auth.pdf'});sessions.push(authSession);
  const authInput={action:'transfer_chunk',id:authSession.id,offset:0,data_base64:Buffer.from(authBytes).toString('base64')};
  expirePost=true;expect((await call(clients[0],'manage_meeting_attachment_upload',authInput)).state).toBe('authentication_required');
  expect((await db`select creating,location,next_offset::int from meeting_private.upload_relays where session_id=${authSession.id}`)[0]).toMatchObject({creating:false,location:null,next_offset:0});
  expect((await call(clients[0],'manage_meeting_attachment_upload',authInput)).offset).toBe(authBytes.length);
  const acquired=await apis[0].rpc('manage_meeting_upload_transfer',{p_action:'acquire',p_id:authSession.id});expect(acquired.error).toBeNull();
  const reset={p_action:'creation_auth_rejected',p_id:authSession.id,p_lease:acquired.data.lease};
  expect((await apis[1].rpc('manage_meeting_upload_transfer',reset)).error?.message).toContain('another administrator');
  expect((await apis[2].rpc('manage_meeting_upload_transfer',reset)).error?.message).toContain('Admin access');
  expect((await apis[0].rpc('manage_meeting_upload_transfer',{...reset,p_lease:crypto.randomUUID()})).error?.message).toContain('lease');
  expect((await apis[0].rpc('manage_meeting_upload_transfer',reset)).error?.message).toContain('unlocated, empty');
  await db`update meeting_private.upload_relays set lease_until=clock_timestamp()-interval '1 minute' where session_id=${authSession.id}`;
  expect((await apis[0].rpc('manage_meeting_upload_transfer',reset)).error?.message).toContain('lease');
  expect((await apis[0].rpc('manage_meeting_upload_transfer',{...reset,p_action:'release'})).error).toBeNull();
  const authFinal=await call(clients[0],'finalize_meeting_attachment_upload',{id:authSession.id});expect(authFinal.sha256).toBe(hash(authBytes));
  await db`delete from meeting_private.upload_relays where session_id=${authSession.id}`;
  expect(await call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_status',id:authSession.id})).toMatchObject({state:'complete',offset:authBytes.length,attachment_id:authSession.id});
  for(const [index,size] of [5179685,20968285].entries()){
   const bytes=new Uint8Array(size).fill(65+index);bytes.set(new TextEncoder().encode('%PDF-1.7\nSynthetic transport fixture\n'));
   const params={meeting_id:meetings[index],provider:'relay-qa',source_key:'original-'+size,file_name:'synthetic-'+size+'.pdf',size_bytes:size,sha256:hash(bytes),source_url:'https://example.test/synthetic.pdf'};
   const session=await call(clients[0],'begin_meeting_attachment_upload',params);sessions.push(session);expect(session.mcp_transfer.max_chunk_bytes).toBe(MCP_UPLOAD_CHUNK_BYTES);
   expect((await call(clients[0],'begin_meeting_attachment_upload',params)).id).toBe(session.id);
   for(let offset=0;offset<size;offset+=MCP_UPLOAD_CHUNK_BYTES){
    const data_base64=Buffer.from(bytes.slice(offset,offset+MCP_UPLOAD_CHUNK_BYTES)).toString('base64');
    if(offset===0)losePatch=true;
    if(index===0&&offset===MCP_UPLOAD_CHUNK_BYTES){
     loseHeadAfterPatch=true;await expect(call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_chunk',id:session.id,offset,data_base64})).rejects.toThrow('HEAD receipt unavailable');
     const prior=patches;expect((await call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_status',id:session.id})).offset).toBe(offset+MCP_UPLOAD_CHUNK_BYTES);
     expect((await call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_chunk',id:session.id,offset,data_base64})).status).toBe('unchanged');expect(patches).toBe(prior);continue;
    }
    const result=await call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_chunk',id:session.id,offset,data_base64});
    expect(result.offset).toBe(Math.min(offset+MCP_UPLOAD_CHUNK_BYTES,size));expect(result.storage_offset).toBe(result.offset);expect(JSON.stringify(result)).not.toContain('/storage/v1/upload/resumable/');
    if(offset===0){
     expect(result.status).toBe('reconciled');const prior=patches;
     expect((await call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_chunk',id:session.id,offset,data_base64})).status).toBe('unchanged');expect(patches).toBe(prior);
     await expect(call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_chunk',id:session.id,offset,data_base64:Buffer.from(new Uint8Array(MCP_UPLOAD_CHUNK_BYTES).fill(90)).toString('base64')})).rejects.toThrow('conflict');
     expect((await call(clients[0],'manage_meeting_attachment_upload',{action:'transfer_status',id:session.id})).offset).toBe(MCP_UPLOAD_CHUNK_BYTES);
     await expect(call(clients[1],'manage_meeting_attachment_upload',{action:'transfer_chunk',id:session.id,offset,data_base64})).rejects.toThrow('another administrator');
     await expect(call(clients[2],'manage_meeting_attachment_upload',{action:'transfer_status',id:session.id})).rejects.toThrow('Admin access');
    }
   }
   const final=await call(clients[0],'finalize_meeting_attachment_upload',{id:session.id});
   const replay=await call(clients[0],'finalize_meeting_attachment_upload',{id:session.id});expect(replay.id).toBe(final.id);expect(final.sha256).toBe(params.sha256);
   const download=await call(clients[0],'get_meeting_attachment_url',{meeting_id:meetings[index],attachment_id:session.id});const response=await fetch(download.url);expect(response.ok).toBe(true);expect(hash(new Uint8Array(await response.arrayBuffer()))).toBe(params.sha256);
   expect((await call(clients[0],'get_meeting',{id:meetings[index]})).attachments.filter((a:any)=>a.id===session.id)).toHaveLength(1);
   const publicApi=createClient(url,anon,{auth:{persistSession:false}});expect((await publicApi.rpc('get_meeting',{p_id:meetings[index]})).data.status).toBe(index===0?'ok':'private');
   const foreign=await call(clients[0],'get_meeting_attachment_url',{meeting_id:meetings[1-index],attachment_id:session.id});expect(foreign.status).toBe('missing');
   if(index===1)expect((await call(clients[2],'get_meeting_attachment_url',{meeting_id:meetings[index],attachment_id:session.id})).status).toBe('missing');
   console.log({fixture_size:size,download_sha256:params.sha256,canonical_attachments:1,chunk_bytes:MCP_UPLOAD_CHUNK_BYTES});
  }
  // A lost POST cannot be recovered by guessing a URL or creating another resource.
  const bytes=new TextEncoder().encode('%PDF-1.7\nuncertain creation'),pending=await call(clients[0],'begin_meeting_attachment_upload',{meeting_id:meetings[0],provider:'relay-qa',source_key:'uncertain-post',file_name:'uncertain.pdf',size_bytes:bytes.length,sha256:hash(bytes),source_url:'https://example.test/uncertain.pdf'});sessions.push(pending);losePost=true;
  const args={action:'transfer_chunk',id:pending.id,offset:0,data_base64:Buffer.from(bytes).toString('base64')};expect((await call(clients[0],'manage_meeting_attachment_upload',args)).state).toBe('creation_uncertain');expect((await call(clients[0],'manage_meeting_attachment_upload',args)).state).toBe('creation_uncertain');
  expect(maxRequestBytes).toBeLessThan(400000);console.log({max_mcp_request_bytes:maxRequestBytes,actual_patch_requests:patches,hosted_connector_acceptance:'not_run'});
 }finally{
  fault.mockRestore();for(const client of clients)await client.close();
  if(sessions.length)await setup.storage.from('meeting-attachments').remove(sessions.map(s=>s.storage_path));
  for(const id of meetings)await db`delete from public.events where id=${id}`;if(cal)await db`delete from public.calendars where id=${cal}`;if(org)await db`delete from public.organizations where id=${org}`;
  for(const id of users)await setup.auth.admin.deleteUser(id);await db.close();
 }
},240000);

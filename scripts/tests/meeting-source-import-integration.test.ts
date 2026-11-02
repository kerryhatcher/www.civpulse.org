import {expect,test} from 'bun:test';import {SQL} from 'bun';
import {createClient} from '../../apps/mcp/node_modules/@supabase/supabase-js';
import {Client} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import {handleRequest} from '../../apps/mcp/src/index';
import {syntheticMinutes} from './meeting-source-import.test';
import {parseSimbliMinutes} from '../../apps/mcp/src/simbli-minutes';
import {expandCompact,expandedJsonbBytes} from '../../apps/mcp/src/meeting-source-import';
test.skipIf(!process.env.MEETING_SOURCE_LOCAL_STATUS)('real isolated Auth→MCP→Storage→partial immutable import, capacity and visibility',async()=>{
 const s=await Bun.file(process.env.MEETING_SOURCE_LOCAL_STATUS!).json();if(s.API_URL!=='http://127.0.0.1:54341')throw Error('Isolated API 54341 only');
 const db=new SQL('postgresql://postgres:postgres@127.0.0.1:54342/postgres'),setup=createClient(s.API_URL,s.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),users:string[]=[],apis:any[]=[],clients:Client[]=[];
 const suffix=crypto.randomUUID();let org='',cal='',meeting='',privateMeeting='',person='',otherPerson='',attachment='',path='',maxRequest=0;
 const call=async(c:Client,args:any)=>{const r:any=await c.callTool({name:'import_meeting_source',arguments:args});if(r.isError)throw Error(r.content[0].text);return JSON.parse(r.content[0].text);};
 try{
 for(const role of ['admin','user']){
 const email=`source-${role}-${suffix}@example.test`,password='Local-fixture-'+suffix;
 const u=await setup.auth.admin.createUser({email,password,email_confirm:true});if(u.error)throw u.error;users.push(u.data.user.id);if(role==='admin')await db`insert into public.admins(user_id) values(${u.data.user.id})`;
 const api=createClient(s.API_URL,s.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const login=await api.auth.signInWithPassword({email,password,options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'}});if(login.error)throw login.error;apis.push(api);
 const token=login.data.session!.access_token,env={SUPABASE_URL:s.API_URL,SUPABASE_ANON_KEY:s.ANON_KEY,AUTHORIZATION_SERVER:JSON.parse(atob(token.split('.')[1])).iss,MCP_RESOURCE_URL:'http://localhost:8789/mcp'};
 const c=new Client({name:'source-fixture',version:'1'});await c.connect(new StreamableHTTPClientTransport(new URL(env.MCP_RESOURCE_URL+'/v2'),{requestInit:{headers:{Authorization:'Bearer '+token}},fetch:async(input,init)=>{const request=new Request(input,init);if(request.body)maxRequest=Math.max(maxRequest,(await request.clone().arrayBuffer()).byteLength);const response=await handleRequest(request,env);expect((await response.clone().text()).includes(token)).toBe(false);return response;}}));clients.push(c);
 }
 org=(await db`insert into public.organizations(name,slug) values('Synthetic source QA',${'source-'+suffix}) returning id`)[0].id;
 cal=(await db`insert into public.calendars(organization_id,name,slug) values(${org},'Synthetic source calendar',${'source-'+suffix}) returning id`)[0].id;
 person=(await db`insert into public.people(full_name,slug) values('Synthetic source voter',${'source-'+suffix}) returning id`)[0].id;
 otherPerson=(await db`insert into public.people(full_name,slug) values('Synthetic unexpected voter',${'unexpected-'+suffix}) returning id`)[0].id;
 meeting=(await db`insert into public.events(calendar_id,title,starts_at,is_meeting) values(${cal},'Synthetic source meeting','2026-01-01T18:00Z',true) returning id`)[0].id;
 privateMeeting=(await db`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility) values(${cal},'Private synthetic source meeting','2026-01-01T18:00Z',true,'private') returning id`)[0].id;
 const provenance={source_url:'https://example.test/minutes',document_sha256:'a'.repeat(64)};
 const motions=Array.from({length:75},(_,i)=>({source_key:'m'+i,locator:'item '+i,subject:'Motion '+i,ballots:i<74?[{person_id:person,choice:'yes',text:'Yes: Synthetic source voter'}]:[]}));
 const args={meeting_id:meeting,provider:'compact-fixture',provenance,attendance:[{source_key:'attendance',locator:'named ballot',person_id:person,status:'observed',evidence:'Yes: Synthetic source voter'}],motions};
 const expanded=expandCompact(provenance,args.attendance,args.motions);
 expect((await db`select octet_length(${JSON.stringify(expanded)}::text::jsonb::text)::int bytes`)[0].bytes).toBe(expandedJsonbBytes(expanded));
 expect(await call(clients[0],args)).toMatchObject({created:150,dry_run:true,rejected:0});
 expect((await db`select * from public.meeting_record_sources where meeting_id=${meeting}`)).toHaveLength(0);
 expect(await call(clients[0],{...args,dry_run:false})).toMatchObject({created:150,rejected:0});
 expect(await call(clients[0],{...args,dry_run:false})).toMatchObject({created:0,unchanged:150,rejected:0});
 const changed=structuredClone(args);changed.motions[0].subject='Changed immutable wording';changed.motions.push({source_key:'new-motion',locator:'item 76',subject:'New motion',ballots:[]});
 expect(await call(clients[0],{...changed,dry_run:false})).toMatchObject({created:1,unchanged:149,rejected:1,status:'partial'});
 expect((await db`select subject from public.meeting_votes where meeting_id=${meeting} and subject='Motion 0'`)).toHaveLength(1);
 await expect(call(clients[1],args)).rejects.toThrow('Admin access required');
 const anon=createClient(s.API_URL,s.ANON_KEY,{auth:{persistSession:false}});expect((await anon.rpc('import_meeting_records_compact',{p_meeting_id:meeting,p_provider:'x',p_records:[],p_dry_run:true})).error).not.toBeNull();
 const text=syntheticMinutes().replace('<li>Not Present: Voter B</li>','');const bytes=new TextEncoder().encode(text),sha=new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
 attachment=crypto.randomUUID();path=privateMeeting+'/'+attachment+'.txt';const up=await apis[0].storage.from('meeting-attachments').upload(path,bytes,{contentType:'text/plain'});if(up.error)throw up.error;
 await db`insert into public.meeting_attachments(id,meeting_id,file_name,storage_path,mime_type,size_bytes) values(${attachment},${privateMeeting},'synthetic.txt',${path},'text/plain',${bytes.length})`;
 const attached={meeting_id:privateMeeting,provider:'attachment-fixture',provenance:{source_url:provenance.source_url,document_sha256:sha},attachment:{id:attachment,adapter:'simbli-minutes-v1',people:[{name:'Voter A',person_id:person}]}};
 expect((await call(clients[0],{...attached,reconcile_only:true})).document).toMatchObject({motions:3,named_ballots:3});
 await expect(call(clients[0],{...attached,provenance:{...attached.provenance,document_sha256:'b'.repeat(64)}})).rejects.toThrow('SHA-256 mismatch');
 await expect(call(clients[0],{...attached,meeting_id:meeting})).rejects.toThrow('Matching bounded');
 expect((await anon.rpc('get_meeting',{p_id:privateMeeting})).data.status).toBe('private');expect((await apis[1].rpc('get_meeting',{p_id:privateMeeting})).data.status).toBe('private');
 expect((await call(clients[0],{...attached,attachment:{...attached.attachment,people:[]}})).missing_people).toHaveLength(1);
 expect(await call(clients[0],attached)).toMatchObject({created:7,dry_run:true,rejected:0});
 expect(await call(clients[0],{...attached,dry_run:false})).toMatchObject({created:7,dry_run:false,rejected:0});
 expect((await call(clients[0],attached)).status).toBe('review_required');
 const evidence=await db`select payload from public.meeting_record_sources where meeting_id=${privateMeeting}`;expect(evidence).toHaveLength(7);expect(evidence.every(r=>r.payload.provenance.document_sha256===sha)).toBe(true);
 const parsed=parseSimbliMinutes(text),wrongMotions=parsed.motions.map((m,i)=>({source_key:'wrong-motion-'+i,locator:m.locator,subject:m.subject,description:m.description,ballots:[{person_id:otherPerson,choice:'yes',text:'Voter C: Yes'}]}));
 expect(await call(clients[0],{meeting_id:privateMeeting,provider:'wrong-identity-fixture',provenance:attached.provenance,attendance:[{source_key:'wrong-attendance',locator:parsed.motions[0].locator,person_id:otherPerson,status:'observed',evidence:'Voter C: Yes'}],motions:wrongMotions,dry_run:false})).toMatchObject({created:7,rejected:0});
 const before=await db`select payload from public.meeting_record_sources where meeting_id=${privateMeeting} and provider='wrong-identity-fixture' order by source_key`;
 const mismatch=await call(clients[0],{...attached,provider:'wrong-identity-fixture',reconcile_only:true,attachment:{...attached.attachment,source_keys:Object.fromEntries(parsed.motions.map((m,i)=>[m.locator,wrongMotions[i].source_key]))}});
 for(const [i,row] of mismatch.reconciliation.entries()){
  expect(row.status).toBe('differs');expect(row.stored_ballots).toBe(row.document_ballots);
  expect(row.missing_ballots[0]).toMatchObject({person_id:person,source_name:'Voter A',choice:parsed.motions[i].ballots[0].choice,source_key:wrongMotions[i].source_key+':person:'+person});
  expect(row.unexpected_ballots[0]).toMatchObject({person_id:otherPerson,choice:'yes',original_text:'Voter C: Yes',source_key:wrongMotions[i].source_key+':person:'+otherPerson});
 }
 expect(await db`select payload from public.meeting_record_sources where meeting_id=${privateMeeting} and provider='wrong-identity-fixture' order by source_key`).toEqual(before);
 console.log(JSON.stringify({expanded_observations:150,max_mcp_request_bytes:maxRequest,maximum_bytes:2097152}));
 }finally{
 for(const c of clients)await c.close();if(path)await setup.storage.from('meeting-attachments').remove([path]);
 if(cal)await db`delete from public.events where calendar_id=${cal}`;if(cal)await db`delete from public.calendars where id=${cal}`;if(person)await db`delete from public.people where id=${person}`;if(otherPerson)await db`delete from public.people where id=${otherPerson}`;if(org)await db`delete from public.organizations where id=${org}`;
 for(const id of users)await setup.auth.admin.deleteUser(id);await db.close();
 }
},60000);

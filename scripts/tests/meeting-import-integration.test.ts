import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import { createClient } from '../../apps/mcp/node_modules/@supabase/supabase-js';
import { Client } from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StreamableHTTPClientTransport } from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import { handleRequest } from '../../apps/mcp/src/index';
import { verifyMeetingOriginal } from '../../apps/mcp/src/meeting-upload-tools';
import source from './fixtures/meeting-35355-ballot.json';

const enabled = process.env.MEETING_IMPORT_INTEGRATION === '1';
const hash = (b: Uint8Array) => new Bun.CryptoHasher('sha256').update(b).digest('hex');

test('original verification rejects altered bytes and mislabeled documents', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\nOriginal');
  const metadata = { size_bytes: bytes.length, sha256: hash(bytes), mime_type: 'application/pdf' };
  expect(await verifyMeetingOriginal(new Blob([bytes]), metadata)).toBe(metadata.sha256);
  await expect(verifyMeetingOriginal(new Blob(['x'.repeat(bytes.length)]), metadata)).rejects.toThrow('signature');
  await expect(verifyMeetingOriginal(new Blob([bytes]), {...metadata, sha256:'0'.repeat(64)})).rejects.toThrow('SHA-256');
  await expect(verifyMeetingOriginal(new Blob([bytes]), {...metadata, size_bytes:bytes.length+1})).rejects.toThrow('size');
  await expect(verifyMeetingOriginal(new Blob(['not JSON']), {size_bytes:8,sha256:hash(new TextEncoder().encode('not JSON')),mime_type:'application/json'})).rejects.toThrow();
});

test.skipIf(!enabled)('real local Auth/MCP/Postgres/Storage: atomic sourced ballots, gates, TUS interruption and replay', async () => {
  // Explicitly local; no production credentials or writes.
  const env = await Bun.file('apps/web/.env.local').text();
  const anon = /^PUBLIC_SUPABASE_ANON_KEY=["']?([^"'\n]+)/m.exec(env)![1];
  const url = 'http://127.0.0.1:54321';
  const db = new SQL('postgres://postgres:postgres@127.0.0.1:54322/postgres');
  const api = createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const login = await api.auth.signInWithPassword({ email:'test@civpulse.org', password:'civicpulse-test-123', options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'} });
  if (login.error) throw login.error;
  const token = login.data.session!.access_token;
  const issuer = JSON.parse(atob(token.split('.')[1])).iss;
  const mcpEnv = { SUPABASE_URL:url,SUPABASE_ANON_KEY:anon,AUTHORIZATION_SERVER:issuer,MCP_RESOURCE_URL:'http://localhost:8789/mcp' };
  const client = new Client({name:'meeting-integration',version:'1'});
  const transport = new StreamableHTTPClientTransport(new URL(mcpEnv.MCP_RESOURCE_URL),{
    requestInit:{headers:{Authorization:`Bearer ${token}`}},
    fetch: async (input, init) => handleRequest(new Request(input,init),mcpEnv),
  });
  await client.connect(transport);
  async function call(name:string,args:Record<string,unknown>) {
    const r:any = await client.callTool({name,arguments:args});
    if(r.isError) throw new Error(r.content[0].text);
    return JSON.parse(r.content[0].text);
  }
  const suffix=crypto.randomUUID(); let org:string='',calendar:string=''; const people:string[]=[]; const meetings:string[]=[]; const uploads:string[]=[];
  let ordinaryId:string|undefined;
  try {
    [org] = (await db`insert into public.organizations(name,slug) values('Synthetic meeting import QA',${`meeting-qa-${suffix}`}) returning id`).map(x=>x.id);
    [calendar] = (await db`insert into public.calendars(name,slug,organization_id) values('Synthetic meeting QA',${`meeting-qa-${suffix}`},${org}) returning id`).map(x=>x.id);
    for(let i=0;i<5;i++) people.push((await db`insert into public.people(full_name,slug) values(${i===0?'Lester Miller (local source replay)':`Synthetic member ${i}`},${`meeting-qa-${suffix}-${i}`}) returning id`)[0].id);
    for(const visibility of ['public','unlisted','private']) meetings.push((await db`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility)
      values(${calendar},'Synthetic local replay: December 19 2013','2013-12-19 23:30Z',true,${visibility}) returning id`)[0].id);
    const provenance={source_url:source.source_url,document_sha256:source.document_sha256,locator:`${source.locator}.MeetingOnlineVotings[0]`};
    const records:any[]=[
      ...people.map((p,i)=>({kind:'attendance',source_key:`attendee-${i}`,provenance,data:{person_id:p,status:i===4?'unknown':'observed',evidence:i===4?'Synthetic roster only; no attendance assertion':'Explicit named ballot at this round only'}})),
      {kind:'vote',source_key:`item:${source.source_item_id}:local-round-index:0`,provenance,data:{subject:source.title,agenda_context:'Confirmation of Minutes',position:0}},
      ...people.map((p,i)=>({kind:'choice',source_key:`choice-${i}`,provenance,data:{person_id:p,vote_source_key:`item:${source.source_item_id}:local-round-index:0`,choice:['yes','no','abstain','recused','unknown'][i],original_text:i===0?source.original_choice:['','No (synthetic)','Abstain (synthetic)','Recused (synthetic)','Vote Not Recorded'][i]}})),
    ];
    const args={meeting_id:meetings[0],provider:'simbli-local-qa',records};
    const dry = await call('import_meeting_records',args);
    expect(dry).toMatchObject({status:'ok',dry_run:true,created:11});
    expect((await api.rpc('get_meeting',{p_id:meetings[0]})).data.votes).toHaveLength(0);
    const [first,replay]=await Promise.all([call('import_meeting_records',{...args,dry_run:false}),call('import_meeting_records',{...args,dry_run:false})]);
    expect([first.created,replay.created].sort((a,b)=>a-b)).toEqual([0,11]);
    expect(first.records).toEqual(replay.records);
    expect((await call('import_meeting_records',{...args,dry_run:false})).unchanged).toBe(11);
    await db`update public.meeting_attendance set note='Editorial note retained' where meeting_id=${meetings[0]} and person_id=${people[0]}`;
    expect((await call('import_meeting_records',{...args,dry_run:false})).unchanged).toBe(11);
    expect((await api.rpc('get_meeting',{p_id:meetings[0]})).data.attendance.find((a:any)=>a.person_id===people[0]).note).toBe('Editorial note retained');
    const bad=await api.rpc('import_meeting_records',{p_meeting_id:meetings[0],p_provider:'bad',p_records:[{kind:'vote',source_key:'bad',data:{subject:'malformed'}}],p_dry_run:false});
    expect(bad.data.errors[0].field).toBe('provenance');
    const changed=structuredClone(records);changed[6].data.original_text='Changed source';
    expect((await call('import_meeting_records',{...args,records:changed,dry_run:false})).status).toBe('rejected');
    const wrong=[{...records[5],source_key:'new-round'}, {...records[6],source_key:'bad-choice',data:{...records[6].data,vote_source_key:'new-round',person_id:crypto.randomUUID()}}];
    expect((await call('import_meeting_records',{...args,records:wrong,dry_run:false})).created).toBe(0);
    expect((await api.rpc('get_meeting',{p_id:meetings[0]})).data.votes).toHaveLength(1);
    const rosterBallot=[{...records[5],source_key:"roster-round"},{...records[10],source_key:"roster-ballot",data:{...records[10].data,vote_source_key:"roster-round",choice:"yes",original_text:"Yes (unsupported synthetic inference)"}}];
    expect((await call("import_meeting_records",{...args,records:rosterBallot,dry_run:false})).status).toBe("rejected");
    const misclassified=structuredClone(rosterBallot);misclassified[1].data.original_text="Vote Not Recorded";
    expect((await call("import_meeting_records",{...args,records:misclassified,dry_run:false})).errors[0].message).toContain("must remain unknown");
    const namedUnknown=[{...records[5],source_key:"named-unknown-round"},{...records[6],source_key:"named-unknown-choice",data:{...records[6].data,vote_source_key:"named-unknown-round",choice:"yes",original_text:"Vote Not Recorded: Mr. Lester M. Miller"}}];
    expect((await call("import_meeting_records",{...args,records:namedUnknown,dry_run:false})).errors[0].message).toContain("must remain unknown");
    expect((await api.rpc("get_meeting",{p_id:meetings[0]})).data.votes).toHaveLength(1);
    // A second round under the same agenda item must remain independent.
    const round2=[{...records[5],source_key:'round-2',data:{...records[5].data,position:1}}, {...records[6],source_key:'round-2-choice',data:{...records[6].data,vote_source_key:'round-2'}}];
    expect((await call('import_meeting_records',{...args,records:round2,dry_run:false})).created).toBe(2);
    const meeting=await call('get_meeting',{id:meetings[0]});
    expect(meeting.votes[0].choices).toHaveLength(5);
    expect(meeting.votes[0].outcome).toBeNull();
    expect(meeting.sources.find((s:any)=>s.source_key==='choice-0').data.original_text).toBe(source.original_choice);
    expect((await call('get_person_meeting_votes',{person_id:people[0],organization_id:org,from:'2013-12-19',to:'2013-12-19',limit:1}))).toHaveLength(1);
    expect((await call('get_person_meeting_votes',{person_id:people[0],from:'2014-01-01'}))).toHaveLength(0);
    for(const meeting_id of meetings.slice(1)) expect((await call('import_meeting_records',{...args,meeting_id,dry_run:false})).created).toBe(11);
    const publicApi=createClient(url,anon,{auth:{persistSession:false}});
    expect((await publicApi.rpc('import_meeting_records',{p_meeting_id:meetings[0],p_provider:'bad',p_records:records,p_dry_run:false})).error).toBeTruthy();
    expect((await publicApi.rpc('get_meeting',{p_id:meetings[1]})).data.status).toBe('ok');
    expect((await publicApi.rpc('get_meeting',{p_id:meetings[2]})).data.status).toBe('private');
    expect((await publicApi.rpc('get_person_meeting_votes',{p_person_id:people[0]})).data).toHaveLength(2);
    const regular=createClient(url,anon,{auth:{persistSession:false}});
    const email=`meeting-${suffix}@example.test`,password=`Qa-${suffix}!`;
    const signup=await regular.auth.signUp({email,password,options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'}});if(signup.error)throw signup.error;
    ordinaryId=signup.data.user!.id;
    await db`update auth.users set email_confirmed_at=now() where id=${ordinaryId}`;
    const signed=await regular.auth.signInWithPassword({email,password,options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'}});if(signed.error)throw signed.error;
    expect((await regular.rpc('import_meeting_records',{p_meeting_id:meetings[0],p_provider:'bad',p_records:records})).error).toBeTruthy();
    expect((await regular.rpc('get_person_meeting_votes',{p_person_id:people[0]})).data).toHaveLength(2);
    expect((await regular.from('meeting_upload_sessions').select('*')).data).toEqual([]);
    // Original bytes go through real Storage TUS, including the reported sizes and max.
    const originals: any[] = [];
    const captureRoot=process.env.MEETING_ORIGINAL_CAPTURE_ROOT;
    if(captureRoot){
      const manifest=await Bun.file(captureRoot+'/document-manifest.json').json();
      for(const size of [5179685,20968285]){
        const entry=manifest.find((d:any)=>d.size===size);
        if(!entry)throw new Error('Captured original missing from manifest: '+size);
        originals.push(entry);
      }
    }
    for(const item of [...[5179685,20968285,26214400].map(size=>({size})),...originals]) {
      const size=item.size;
      const bytes=new Uint8Array(size);bytes.fill(32);bytes.set(new TextEncoder().encode('%PDF-1.7\n% Synthetic transport fixture\n'));bytes.set(new TextEncoder().encode('\n%%EOF\n'),size-7);
      const originalBytes=item.path?new Uint8Array(await Bun.file(captureRoot+'/'+item.path).arrayBuffer()):bytes;
      if(item.sha256)expect(hash(originalBytes)).toBe(item.sha256);
      const params={meeting_id:meetings[0],provider:'qa',source_key:(item.path?'original-':'synthetic-')+size,file_name:(item.path?'captured-':'synthetic-')+size+'.pdf',size_bytes:size,sha256:hash(originalBytes),source_url:item.source_url??'https://example.test/synthetic.pdf'};
      const session=await call('begin_meeting_attachment_upload',params);uploads.push(session.id);
      expect((await call('begin_meeting_attachment_upload',params)).id).toBe(session.id);
      expect((await publicApi.storage.from('meeting-attachments').download(session.storage_path)).error).toBeTruthy();
      const metadata=Object.entries(session.metadata).map(([k,v])=>`${k} ${btoa(v as string)}`).join(',');
      const headers={Authorization:`Bearer ${token}`,apikey:anon,...session.headers,'Tus-Resumable':'1.0.0'};
      const start=await fetch(session.tus_endpoint,{method:'POST',headers:{...headers,'Upload-Length':String(size),'Upload-Metadata':metadata}});
      if(start.status!==201)throw new Error(`TUS start ${start.status}: ${await start.text()}`);
      const location=new URL(start.headers.get('Location')!,session.tus_endpoint).href;
      let offset=0;
      while(offset<size){
        // HEAD recovers a saved offset after intentionally dropping each PATCH receipt.
        const head=await fetch(location,{method:'HEAD',headers});expect(head.ok).toBe(true);
        offset=Number(head.headers.get('Upload-Offset'));
        if(offset===size)break;
        const chunk=originalBytes.slice(offset,Math.min(offset+session.chunk_size,size));
        const patch=await fetch(location,{method:'PATCH',headers:{...headers,'Upload-Offset':String(offset),'Content-Type':'application/offset+octet-stream'},body:chunk});
        if(!patch.ok)throw new Error(`TUS PATCH ${patch.status}: ${await patch.text()}`);
      }
      const state=await call('manage_meeting_attachment_upload',{action:'status',id:session.id});expect(state.stored_object).toBeTruthy();
      expect((await publicApi.storage.from('meeting-attachments').download(session.storage_path)).error).toBeTruthy();
      // Ignore one completed finalize receipt; concurrent replay must give one attachment.
      await call('finalize_meeting_attachment_upload',{id:session.id});
      const finals=await Promise.all([call('finalize_meeting_attachment_upload',{id:session.id}),call('finalize_meeting_attachment_upload',{id:session.id})]);
      expect(finals[0].id).toBe(session.id);expect(finals[1].sha256).toBe(params.sha256);
      const original=await publicApi.storage.from('meeting-attachments').download(session.storage_path);
      if(original.error)throw original.error;
      expect(hash(new Uint8Array(await original.data.arrayBuffer()))).toBe(params.sha256);
      expect((await call('get_meeting',{id:meetings[0]})).attachments.filter((a:any)=>a.id===session.id)).toHaveLength(1);
    }
    for(const meetingId of meetings.slice(1)) {
      const params={meeting_id:meetingId,provider:'qa',source_key:'json-visibility',file_name:'source.json',size_bytes:2,sha256:hash(new TextEncoder().encode('{}')),source_url:'https://example.test/source.json'};
      const session=await call('begin_meeting_attachment_upload',params);uploads.push(session.id);
      const put=await api.storage.from('meeting-attachments').upload(session.storage_path,new TextEncoder().encode('{}'),{contentType:'application/json'});
      expect(put.error).toBeNull();
      await call('finalize_meeting_attachment_upload',{id:session.id});
      const download=await publicApi.storage.from('meeting-attachments').download(session.storage_path);
      expect(Boolean(download.error)).toBe(meetingId===meetings[2]);
      const userDownload=await regular.storage.from('meeting-attachments').download(session.storage_path);
      expect(Boolean(userDownload.error)).toBe(meetingId===meetings[2]);
    }
    expect((await regular.rpc('begin_meeting_upload',{p_meeting_id:meetings[0],p_provider:'bad',p_source_key:'bad',p_file_name:'x.json',p_mime_type:'application/json',p_size_bytes:2,p_sha256:'0'.repeat(64),p_source_url:'https://example.test/x'})).error).toBeTruthy();
    await db`update public.people set visibility='private' where id=${people[4]}`;
    const hiddenPerson=(await publicApi.rpc('get_meeting',{p_id:meetings[0]})).data;
    expect(hiddenPerson.sources.some((r:any)=>r.person_id===people[4])).toBe(false);
    expect(hiddenPerson.votes[0].choices.some((r:any)=>r.person_id===people[4])).toBe(false);
    const cancelled=await call('begin_meeting_attachment_upload',{meeting_id:meetings[2],provider:'qa',source_key:'cancel',file_name:'source.json',size_bytes:2,sha256:hash(new TextEncoder().encode('{}')),source_url:'https://example.test/source.json'});
    uploads.push(cancelled.id);
    await expect(call('begin_meeting_attachment_upload',{meeting_id:meetings[2],provider:'qa',source_key:'cancel',file_name:'source.json',size_bytes:3,sha256:hash(new TextEncoder().encode('{}')),source_url:'https://example.test/source.json'})).rejects.toThrow('conflict');
    await db`update public.meeting_upload_sessions set expires_at=now()-interval '1 second' where id=${cancelled.id}`;
    await expect(call('finalize_meeting_attachment_upload',{id:cancelled.id})).rejects.toThrow('expired');
    await call('manage_meeting_attachment_upload',{action:'cancel',id:cancelled.id});
    await expect(call('finalize_meeting_attachment_upload',{id:cancelled.id})).rejects.toThrow('cancelled');
    expect((await call('manage_meeting_attachment_upload',{action:'list_cleanup'})).some((s:any)=>s.id===cancelled.id)).toBe(true);
  } finally {
    const paths=await db`select storage_path from public.meeting_upload_sessions where meeting_id=any(${db.array(meetings,'uuid')})`;
    if(paths.length) await api.storage.from('meeting-attachments').remove(paths.map(p=>p.storage_path));
    await db`delete from public.events where id=any(${db.array(meetings,'uuid')})`;
    if(calendar) await db`delete from public.calendars where id=${calendar}`;
    if(org) await db`delete from public.organizations where id=${org}`;
    await db`delete from public.people where id=any(${db.array(people,'uuid')})`;
    if(ordinaryId) await db`delete from auth.users where id=${ordinaryId}`;
    await client.close();await db.close();
  }
},180000);

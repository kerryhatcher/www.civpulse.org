import {expect,spyOn,test} from 'bun:test';
import {SQL} from 'bun';
import {handle,type RuntimeEnv} from '../../apps/kb/src/index';
import {decodeMeetingDocument} from '../../apps/mcp/src/meeting-tools';
import manifest from '../fixtures/public-documents-pilot.json';

// Real source files stay outside Git. Every database write rolls back; R2 and
// AI Search are local adapters. This does not verify Cloudflare ingestion.
const root=process.env.DOCUMENTS_PILOT_DIR;
test('pilot manifest limits the import to two meetings and records verified file identities',()=>{
  expect(manifest.meetings).toHaveLength(2);
  expect(manifest.files).toHaveLength(11);
  expect(manifest.files.filter(f=>f.accepted)).toHaveLength(9);
  for(const file of manifest.files){
    expect(manifest.meetings.some(m=>m.id===file.meeting_id)).toBe(true);
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.source_url.startsWith('https://')).toBe(true);
    expect(file.accepted).toBe(file.size_bytes<=25*1024*1024);
    if(file.derived)expect(file.text_origin).toBe('other');
  }
});
test.skipIf(!root || !process.env.DOCUMENTS_TEST_DATABASE_URL)('two real meetings: upload, publish, byte integrity, search, deduplication and withdrawal',async()=>{
  const sql=new SQL(process.env.DOCUMENTS_TEST_DATABASE_URL!);
  const rollback=new Error('pilot rollback');
  let mock:ReturnType<typeof spyOn>|undefined;
  const objects=new Map<string,Uint8Array>();
  try{await sql.begin(async tx=>{
    const [table]=await tx`select to_regclass('public.public_documents') as relation`;
    if(!table.relation)await tx.unsafe(await Bun.file('supabase/migrations/20261121000000_public_document_archive.sql').text());
    const admin=crypto.randomUUID(),suffix=crypto.randomUUID();
    await tx`insert into auth.users(id,email) values(${admin},${`pilot-${suffix}@example.test`})`;
    await tx`insert into public.admins(user_id) values(${admin})`;
    const [org]=await tx`insert into public.organizations(name,slug) values('Public document pilot',${`pilot-${suffix}`}) returning id`;
    const [calendar]=await tx`insert into public.calendars(name,slug,organization_id) values('Public document pilot',${`pilot-${suffix}`},${org.id}) returning id`;
    const meetings=new Map<string,string>();
    for(const source of manifest.meetings){
      const [event]=await tx`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility)
        values(${calendar.id},${source.title},${source.starts_at},true,'public') returning id`;
      meetings.set(source.id,event.id);
    }
    const attachments=new Map<string, {id:string;meeting_id:string;file_name:string;storage_path:string;mime_type:string;size_bytes:number;path:string}>();
    for(const source of manifest.files){
      const file=Bun.file(`${root}/${source.path}`);
      expect(file.size).toBe(source.size_bytes);
      const hasher=new Bun.CryptoHasher('sha256');
      for await(const chunk of file.stream())hasher.update(chunk);
      expect(hasher.digest('hex')).toBe(source.sha256);
      const id=crypto.randomUUID(),meeting_id=meetings.get(source.meeting_id)!;
      const file_name=source.path.split('/').at(-1)!;
      const mime_type=file_name.endsWith('pdf')?'application/pdf':file_name.endsWith('pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'text/plain';
      const storage_path=`${meeting_id}/${id}.${file_name.split('.').at(-1)}`;
      const attachment={id,meeting_id,file_name,storage_path,mime_type,size_bytes:file.size,path:source.path};
      attachments.set(source.path,attachment);
      if(source.accepted){
        // Exercise the MCP decoder on actual PDF, PPTX and TXT bytes too.
        const decoded=decodeMeetingDocument(file_name,Buffer.from(await file.arrayBuffer()).toString('base64'));
        expect(decoded.contentType).toBe(mime_type);expect(decoded.bytes.length).toBe(file.size);
        await tx`insert into public.meeting_attachments(id,meeting_id,file_name,storage_path,mime_type,size_bytes)
          values(${id},${meeting_id},${file_name},${storage_path},${mime_type},${file.size})`;
      }
    }
    const signatures:Record<string,string[]>={get_meeting:['p_id'],is_admin:[],prepare_public_document:['p_attachment_id','p_sha256','p_title','p_source_url','p_document_kind','p_text_origin','p_confirm_public'],finish_public_document:['p_id','p_claim'],get_public_document:['p_id'],list_public_documents:['p_query','p_limit','p_offset'],withdraw_public_document:['p_id']};
    let queue:Promise<unknown>=Promise.resolve();
    mock=spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
      const url=new URL(String(input));
      if(url.pathname==='/auth/v1/user')return Response.json({id:admin});
      if(url.pathname.includes('/storage/')){
        const attachment=[...attachments.values()].find(a=>url.pathname.endsWith(a.storage_path))!;
        const file=Bun.file(`${root}/${attachment.path}`);
        return new Response(file.stream(),{headers:{'Content-Length':String(file.size)}});
      }
      const name=url.pathname.split('/').at(-1)!;
      const args=JSON.parse(String(init?.body??'{}'));
      // Serialize caller roles on the single rollback transaction, including
      // concurrent anonymous catalog reads made by the search handler.
      const result=queue.then(async()=>{
        const signed=new Headers(init?.headers).has('Authorization');
        await tx.unsafe(`set local role ${signed?'authenticated':'anon'}`);
        await tx`select set_config('request.jwt.claim.sub',${signed?admin:''},true)`;
        if(name==='get_meeting'){
          const oversized=[...attachments.values()].filter(a=>a.meeting_id===args.p_id&&!manifest.files.find(f=>f.path===a.path)!.accepted);
          const [row]=await tx`select public.get_meeting(${args.p_id}::uuid) as d`;
          return Response.json({...row.d,attachments:[...row.d.attachments,...oversized]});
        }
        const params=signatures[name];if(!params)throw new Error(`Unexpected pilot RPC ${name}`);
        const rows=await tx.unsafe(`select public.${name}(${params.map((p,i)=>`${p} => $${i+1}`).join(',')}) as d`,params.map(p=>args[p]));
        return Response.json(name==='list_public_documents'?rows.map(r=>r.d):rows[0].d);
      });
      queue=result.catch(()=>{});return result;
    });
    const chunks:{id:string;type:string;score:number;text:string;item:{key:string}}[]=[];
    const env={SUPABASE_URL:'https://pilot.example.test',SUPABASE_ANON_KEY:'public-test-key',PUBLIC_DOCUMENT_ORIGIN:'https://kb.civpulse.org',ALLOWED_ORIGINS:'http://localhost:4323',PUBLICATION_ENABLED:'true',SEARCH_ENABLED:'true',
      PUBLICATION_MEETING_IDS:[...meetings.values()].join(','),
      DOCUMENTS:{put:async(key:string,bytes:Uint8Array)=>{objects.set(key,bytes.slice());},delete:async(key:string)=>{objects.delete(key);}},
      SEARCH_LIMITER:{limit:async()=>({success:true})},SEARCH:{search:async()=>({chunks})}} as unknown as RuntimeEnv;
    const published:Record<string,any>[]=[];
    for(const source of manifest.files){
      const attachment=attachments.get(source.path)!;
      const body={meeting_id:attachment.meeting_id,attachment_id:attachment.id,title:source.title,source_url:source.source_url,document_kind:source.document_kind,text_origin:source.text_origin,confirm_public:true};
      const request=()=>new Request('https://kb-api.civpulse.org/publish',{method:'POST',headers:{Authorization:'Bearer local-pilot','Content-Type':'application/json'},body:JSON.stringify(body)});
      const response=await handle(request(),env);
      const document=await response.json();
      if(!source.accepted){expect(response.status).toBe(413);continue;}
      expect(response.status).toBe(201);expect(document.indexing.eligible).toBe(source.index_eligible);
      expect(document.meetings).toHaveLength(1);
      expect(new Bun.CryptoHasher('sha256').update(objects.get(document.object_key)!).digest('hex')).toBe(source.sha256);
      expect(document.text_origin).toBe(source.text_origin);
      // A repeated publication must reuse the immutable object and catalog ID.
      expect((await (await handle(request(),env)).json()).id).toBe(document.id);
      published.push(document);
      if(source.path.endsWith('txt'))chunks.push({id:document.id,type:'text',score:1,text:(await Bun.file(`${root}/${source.path}`).text()).slice(0,600),item:{key:document.object_key}});
    }
    expect(published).toHaveLength(9);expect(objects.size).toBe(9);
    const catalog=await (await handle(new Request('https://kb-api.civpulse.org/documents'),env)).json();
    expect(catalog.documents).toHaveLength(9);
    expect(new Set(catalog.documents.flatMap((d:any)=>d.meetings.map((m:any)=>m.id))).size).toBe(2);
    const search=()=>handle(new Request('https://kb-api.civpulse.org/search?q=meeting'),env);
    expect((await (await search()).json()).results).toHaveLength(4);
    const withdrawn=published.find(d=>d.file_name.endsWith('transcript.txt'))!;
    expect((await handle(new Request(`https://kb-api.civpulse.org/documents/${withdrawn.id}/withdraw`,{method:'POST',headers:{Authorization:'Bearer local-pilot'}}),env)).status).toBe(200);
    expect(objects.has(withdrawn.object_key)).toBe(false);
    expect((await (await search()).json()).results).toHaveLength(3);
    mock.mockRestore();mock=undefined;
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{mock?.mockRestore();await sql.close();}
},120000);

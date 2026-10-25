import {expect,test} from 'bun:test';
import {SQL} from 'bun';

// Local only. Applies this new migration inside the transaction when it has not
// been installed, avoiding changes to the shared checkout's migration history.
test.skipIf(!process.env.DOCUMENTS_TEST_DATABASE_URL)('public archive permissions, claims, deduplication, links and withdrawal',async()=>{
  const sql=new SQL(process.env.DOCUMENTS_TEST_DATABASE_URL!);const rollback=new Error('rollback');
  try {await sql.begin(async tx=>{
    const [table]=await tx`select to_regclass('public.public_documents') as relation`;
    if(!table.relation)await tx.unsafe(await Bun.file('supabase/migrations/20261121000000_public_document_archive.sql').text());
    await tx.unsafe(await Bun.file('supabase/migrations/20261122000000_public_document_admin_execute.sql').text());
    expect((await tx`select has_function_privilege('anon','public.withdraw_public_document(uuid)','execute') as allowed`)[0].allowed).toBe(false);
    const admin=crypto.randomUUID();const suffix=crypto.randomUUID();
    await tx`insert into auth.users(id,email) values(${admin},${`documents-${suffix}@example.test`})`;
    await tx`insert into public.admins(user_id) values(${admin})`;
    const [org]=await tx`insert into public.organizations(name,slug) values('Document QA',${`doc-qa-${suffix}`}) returning id`;
    const [calendar]=await tx`insert into public.calendars(name,slug,organization_id) values('Document QA',${`doc-qa-${suffix}`},${org.id}) returning id`;
    const files:string[]=[];
    for(let n=0;n<3;n++){
      const [event]=await tx`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility)
        values(${calendar.id},${`Document QA ${n}`},'2026-01-15 18:00Z',true,${n===2?'private':'public'}) returning id`;
      const [file]=await tx`insert into public.meeting_attachments(meeting_id,file_name,storage_path,mime_type,size_bytes)
        values(${event.id},'test.txt',${`${event.id}/${crypto.randomUUID()}.txt`},'text/plain',4) returning id`;
      files.push(file.id);
    }
    const prepare=async(file:string,sha='a'.repeat(64),confirm=true)=>(await tx`select public.prepare_public_document(${file}::uuid,${sha},'Document QA','https://example.test/agenda','agenda','official',${confirm}) as d`)[0].d;
    // Catch expected errors in savepoints so the outer fixture transaction lives.
    const fails=async(fn:(q:typeof tx)=>Promise<unknown>)=>{let failed=false;try{await tx.savepoint(fn);}catch{failed=true;}expect(failed).toBe(true);};
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
    await fails(async q=>q`select public.prepare_public_document(${files[0]}::uuid,${'a'.repeat(64)},'QA','https://example.test','agenda','official',true)`);
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    await fails(async q=>q`select public.prepare_public_document(${files[2]}::uuid,${'b'.repeat(64)},'QA','https://example.test','agenda','official',true)`);
    await fails(async q=>q`select public.prepare_public_document(${files[0]}::uuid,${'a'.repeat(64)},'QA','https://example.test','agenda','official',false)`);
    const draft=await prepare(files[0]);expect(draft.status).toBe('pending');expect(draft.claim).toBeTruthy();
    await tx.unsafe('set local role anon');
    await tx`select set_config('request.jwt.claim.sub','',true)`;
    expect((await tx`select public.get_public_document(${draft.id}::uuid) as d`)[0].d).toBeNull();
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    await fails(async q=>q`select public.finish_public_document(${draft.id}::uuid,${crypto.randomUUID()}::uuid)`);
    const [finished]=await tx`select public.finish_public_document(${draft.id}::uuid,${draft.claim}::uuid) as d`;
    expect(finished.d.status).toBe('published');
    const reused=await prepare(files[1]);expect(reused.id).toBe(draft.id);expect(reused.meetings).toHaveLength(2);
    const [linkedMeeting]=await tx`select meeting_id from public.meeting_attachments where id=${files[1]}::uuid`;
    expect((await tx`select public.link_public_document_meeting(${draft.id}::uuid,${linkedMeeting.meeting_id}::uuid) as d`)[0].d.meetings).toHaveLength(2);
    const [hiddenMeeting]=await tx`select meeting_id from public.meeting_attachments where id=${files[2]}::uuid`;
    await fails(async q=>q`select public.link_public_document_meeting(${draft.id}::uuid,${hiddenMeeting.meeting_id}::uuid)`);
    await tx.unsafe('reset role');
    await tx`update public.events set visibility='private' where id=${linkedMeeting.meeting_id}::uuid`;
    await tx.unsafe('set local role anon');
    await tx`select set_config('request.jwt.claim.sub','',true)`;
    const [visible]=await tx`select public.get_public_document(${draft.id}::uuid) as d`;
    expect(visible.d.status).toBe('published');expect(visible.d.meetings).toHaveLength(1);
    expect(visible.d).not.toHaveProperty('claim');expect(visible.d).not.toHaveProperty('publication_claim');
    await fails(async q=>q`select * from public.public_documents`);
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    await tx`select public.withdraw_public_document(${draft.id}::uuid)`;
    await fails(async q=>q`select public.prepare_public_document(${files[0]}::uuid,${'a'.repeat(64)},'QA','https://example.test','agenda','official',true)`);
    await tx.unsafe('set local role anon');
    await tx`select set_config('request.jwt.claim.sub','',true)`;
    expect((await tx`select public.get_public_document(${draft.id}::uuid) as d`)[0].d).toBeNull();
    const rows=await tx`select public.list_public_documents('Document QA',null,true,50,0) as d`;
    expect(rows.some(r=>r.d.id===draft.id)).toBe(false);
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
},20000);

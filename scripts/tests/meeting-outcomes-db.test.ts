import {expect,test} from 'bun:test';import {SQL} from 'bun';
const hash='a'.repeat(64),url='https://example.test/official-minutes.pdf',locator='Page 3, item 7: motion carried';
test.skipIf(!process.env.MEETING_OUTCOMES_TEST_DATABASE_URL)('cited outcomes preserve imports, serialize corrections and retain all read visibility gates',async()=>{
 const sql=new SQL(process.env.MEETING_OUTCOMES_TEST_DATABASE_URL!),rollback=new Error('rollback cited outcome fixtures');
 try{await sql.begin(async tx=>{
  const admin=crypto.randomUUID(),user=crypto.randomUUID(),suffix=crypto.randomUUID();
  for(const id of [admin,user])await tx`insert into auth.users(id,email) values(${id},${`${id}@example.test`})`;
  await tx`insert into public.admins(user_id) values(${admin})`;
  const [org]=await tx`insert into public.organizations(name,slug) values('Outcome fixture',${'outcome-'+suffix}) returning id`;
  const [cal]=await tx`insert into public.calendars(name,slug,organization_id) values('Outcome calendar',${'outcome-'+suffix},${org.id}) returning id`;
  const [person]=await tx`insert into public.people(full_name,slug) values('Synthetic outcome voter',${'outcome-'+suffix}) returning id`;
  const [meeting]=await tx`insert into public.events(calendar_id,title,starts_at,is_meeting) values(${cal.id},'Synthetic committee meeting','2026-01-02T18:00:00Z',true) returning id`;
  const records=[{source_key:'motion-7',kind:'vote',data:{subject:'Synthetic sourced motion',description:'Source passFail code: -1; outcome unspecified'},provenance:{source_url:url,document_sha256:hash,locator:'Agenda item 7'}},
   {source_key:'attendance-1',kind:'attendance',data:{person_id:person.id,status:'observed',evidence:'Named ballot'},provenance:{source_url:url,document_sha256:hash,locator:'Agenda item 7'}},
   {source_key:'choice-1',kind:'choice',data:{person_id:person.id,vote_source_key:'motion-7',choice:'yes',original_text:'Yes: Synthetic outcome voter'},provenance:{source_url:url,document_sha256:hash,locator:'Agenda item 7'}}];
  const [rev]=await tx`select revision from public.frontend_rebuild_state where id`;
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const [{data:imported}]=await tx`select public.import_meeting_records(${meeting.id},'synthetic-provider',${JSON.stringify(records)}::text::jsonb,false) as data`;
  expect(imported.status).toBe('ok');const vote=imported.records[0].vote_id;
  const set=async(outcome='passed',supersedes:string|null=null,reason:string|null=null)=> (await tx`select public.set_meeting_vote_outcome(${vote},${outcome},${url},${hash},${locator},${supersedes},${reason}) as data`)[0].data;
  const [{data:before}]=await tx`select public.get_meeting(${meeting.id}) as data`;
  expect(before.votes[0].outcome).toBeNull();expect(before.attachments).toEqual([]);
  const first=await set();expect(first.status).toBe('created');expect((await set()).status).toBe('unchanged');
  expect((await set('failed')).status).toBe('conflict');expect((await set('failed',first.observation_id)).status).toBe('conflict');
  const corrected=await set('failed',first.observation_id,'Corrected synthetic transcription after reviewing the exact motion');expect(corrected.status).toBe('created');
  expect((await set('failed',first.observation_id,'Corrected synthetic transcription after reviewing the exact motion')).status).toBe('unchanged');
  expect((await set('tabled',first.observation_id,'Stale correction')).status).toBe('conflict');
  expect(await tx`select id from public.meeting_vote_outcome_observations where vote_id=${vote}`).toHaveLength(2);
  const [{data:replay}]=await tx`select public.import_meeting_records(${meeting.id},'synthetic-provider',${JSON.stringify(records)}::text::jsonb,false) as data`;
  expect(replay.status).toBe('ok');expect(replay.unchanged).toBe(3);expect(replay.updated).toBe(0);
  const [original]=await tx`select outcome,description from public.meeting_votes where id=${vote}`;expect(original.outcome).toBeNull();expect(original.description).toContain('passFail code: -1');
  async function denied(query:()=>Promise<unknown>,code='42501'){await tx.unsafe('savepoint outcome_denied');try{await query();throw new Error('Expected denial');}catch(e){expect((e as any).errno).toBe(code);}finally{await tx.unsafe('rollback to savepoint outcome_denied');}}
  await denied(()=>tx`update public.meeting_vote_outcome_observations set outcome='passed' where id=${corrected.observation_id}`);
  await denied(()=>tx`delete from public.meeting_vote_outcome_observations where id=${corrected.observation_id}`);
  await denied(()=>tx`select public.set_meeting_vote_outcome(${vote},'passed','http://example.test',${hash},'item')`,'22023');
  await denied(()=>tx`select public.set_meeting_vote_outcome(${vote},'passed',${url},'bad-hash','item')`,'22023');
  await denied(()=>tx`select public.set_meeting_vote_outcome(${vote},'passed',${url},${hash},' ')`,'22023');
  await denied(()=>tx`select public.set_meeting_vote_outcome(${vote},'passed','https:///missing-host',${hash},'Page 3',${corrected.observation_id},'Review')`,'23514');
  for(const role of ['anon','authenticated']){
   await tx.unsafe('set local role '+role);await tx`select set_config('request.jwt.claim.sub',${role==='anon'?'':user},true)`;
   await denied(()=>set());
   if(role==='authenticated')expect(await tx`select * from public.meeting_vote_outcome_observations where vote_id=${vote}`).toHaveLength(0);
   else await denied(()=>tx`select * from public.meeting_vote_outcome_observations`);
   const [{data:shown}]=await tx`select public.get_meeting(${meeting.id}) as data`;
   expect(shown.status).toBe('ok');expect(shown.votes[0].outcome).toBe('failed');expect(shown.votes[0].original_outcome).toBeNull();
   expect(shown.votes[0].outcome_observations).toHaveLength(2);expect(shown.sources).toEqual(before.sources);expect(shown.votes[0].original_sources[0].source_key).toBe('motion-7');
   expect(JSON.stringify(shown.votes[0])).not.toContain(admin);
   const history=await tx`select public.get_object_history('meeting_votes',${vote}::text) as data`;expect(JSON.stringify(history)).toContain(corrected.observation_id);expect(JSON.stringify(history)).not.toContain(admin);
   expect((await tx`select public.get_person_votes(${person.id}) as data`)[0].data.outcome).toBe('failed');
   expect((await tx`select public.get_person_meeting_votes(${person.id},${org.id},'2026-01-01','2026-01-03',0,1) as data`)[0].data.outcome_observation.id).toBe(corrected.observation_id);
   expect(await tx`select public.get_person_meeting_votes(${person.id},null,null,null,1,1)`).toHaveLength(0);
   if(role==='anon'){const [row]=await tx`select * from public.export_public_profile_rows('votes',0,500)`;expect(row.owner_id).toBe(person.id);expect(row.data.outcome).toBe('failed');expect(row.data.outcome_observations).toHaveLength(2);}
  }
  await tx.unsafe('reset role');await tx`update public.events set visibility='private' where id=${meeting.id}`;
  for(const visibility of ['private','unlisted','public']){
   await tx`update public.events set visibility=${visibility} where id=${meeting.id}`;
   if(visibility==='public')await tx`update public.calendars set visibility='private' where id=${cal.id}`;
   for(const id of ['',user,admin]){
    await tx.unsafe(id?'set local role authenticated':'set local role anon');await tx`select set_config('request.jwt.claim.sub',${id},true)`;
    const [{data:shown}]=await tx`select public.get_meeting(${meeting.id}) as data`;
    expect(shown.status).toBe(id===admin||visibility==='unlisted'?'ok':'private');
    const n=id===admin?1:0;
    expect(await tx`select public.get_person_votes(${person.id})`).toHaveLength(n);
    expect(await tx`select public.get_person_meeting_votes(${person.id})`).toHaveLength(n);
    if(!id){expect(await tx`select * from public.export_public_profile_rows('votes',0,500)`).toHaveLength(0);if(visibility!=='unlisted')expect(JSON.stringify(shown)).not.toContain(hash);}
    await tx.unsafe('reset role');
   }
  }
  const [afterRev]=await tx`select revision,needs_rebuild from public.frontend_rebuild_state where id`;expect(BigInt(afterRev.revision)).toBeGreaterThan(BigInt(rev.revision));expect(afterRev.needs_rebuild).toBe(true);
  const [fn]=await tx`select prosecdef,proconfig from pg_proc where oid='public.set_meeting_vote_outcome(uuid,text,text,text,text,uuid,text)'::regprocedure`;expect(fn.prosecdef).toBe(true);expect(fn.proconfig).toContain('search_path=""');
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
});

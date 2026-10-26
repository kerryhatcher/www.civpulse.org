import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('imports preserve attendance corrections while patching source metadata',async()=>{
 const sql=new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);const rollback=Error('rollback attendance fixtures');
 try{await sql.begin(async tx=>{
  await tx.unsafe(await Bun.file('supabase/migrations/20261123150000_preserve_import_attendance.sql').text());
  const suffix=crypto.randomUUID();
  const [org]=await tx`insert into organizations(name,slug) values ('Attendance import QA',${suffix}) returning id`;
  const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values (${org.id},${suffix},'QA','2023-01-01') returning id`;
  const [session]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on) values (${term.id},${suffix},'QA','2023-01-01') returning id`;
  const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
  const [person]=await tx`insert into people(full_name,slug,kind) values ('Attendance QA',${suffix},'other') returning id`;
  const [office]=await tx`insert into offices(organization_id,name) values (${org.id},'Senator') returning id`;
  const [service]=await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values (${office.id},${person.id},'elected','2023-01-01') returning id`;
  const admin=crypto.randomUUID();await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;await tx`insert into admins(user_id) values (${admin})`;
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const base={source_system:'qa',source_id:suffix,session_id:session.id,body_id:body.id,identifier:'51',occurred_on:'2023-02-16',question:'SECOND READING OF BILLS AND RESOLUTIONS',category:'attendance',method:'roll_call',outcome:'not_reported',reported_yes:44,reported_no:0,reported_other:12};
  const run=async(data:Record<string,unknown>)=>(await tx`select import_legislation(${[{table:'legislative_votes',data}]}::jsonb) result`)[0].result;
  const saved=(await run(base))[0].id;
  const [choice]=await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice,membership_review_note) values (${saved},${service.id},'yes','Yea','Reviewed source identity') returning *`;
  // Retry a complete stale provider payload, then partial category and metadata patches.
  for(const patch of [{...base,category:'procedure',source_url:'https://example.test/refreshed'},
    {source_system:'qa',source_id:suffix,category:'passage'},
    {source_system:'qa',source_id:suffix,reported_yes:45}]){
   expect((await run(patch))[0].id).toBe(saved);
   const [v]=await tx`select * from legislative_votes where id=${saved}`;
   expect(v.category).toBe('attendance');
   expect(v.question).toBe(base.question);
  }
  const [v]=await tx`select * from legislative_votes where id=${saved}`;
  expect(v.source_url).toBe('https://example.test/refreshed');expect(v.reported_yes).toBe(45);
  expect((await tx`select * from legislative_vote_choices where id=${choice.id}`)[0]).toEqual(choice);
  // Normal legislative updates still work; new reviewed attendance can promote them.
  const other={...base,source_id:suffix+'-other',identifier:'52',category:'procedure'};
  const otherId=(await run(other))[0].id;
  await run({...other,category:'passage'});expect((await tx`select category from legislative_votes where id=${otherId}`)[0].category).toBe('passage');
  await run({...other,category:'attendance'});await run({...other,category:'procedure'});
  expect((await tx`select category from legislative_votes where id=${otherId}`)[0].category).toBe('attendance');
  // Scope is imports, not an irreversible constraint: an explicit admin correction remains possible.
  await tx`update legislative_votes set category='procedure' where id=${otherId}`;
  expect((await tx`select category from legislative_votes where id=${otherId}`)[0].category).toBe('procedure');
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
});

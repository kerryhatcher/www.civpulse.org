import {expect,test} from 'bun:test';
import {SQL} from 'bun';
const migration='supabase/migrations/20261124010500_profile_vote_export_shared_gates.sql';
test.skipIf(!process.env.PROFILE_TEST_DATABASE_URL)('profile vote export preserves visibility and payload and pages large histories within the anonymous timeout',async()=>{
 const sql=new SQL(process.env.PROFILE_TEST_DATABASE_URL!); const rollback=Error('rollback');
 try {await sql.begin(async tx=>{
 await tx.unsafe(await Bun.file('supabase/migrations/20261124010300_legislative_action_browse_performance.sql').text());
 const suffix=crypto.randomUUID();
 const [org]=await tx`insert into organizations(name,slug) values ('Export QA',${suffix}) returning id`;
 const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values (${org.id},'qa','QA','2025-01-01') returning id`;
 const [session]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on) values (${term.id},'qa','QA','2025-01-01') returning id`;
 const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
 const [person]=await tx`insert into people(full_name,slug,kind) values ('Export QA',${suffix},'other') returning id`;
 const [office]=await tx`insert into offices(organization_id,name) values (${org.id},'QA office') returning id`;
 const [service]=await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values (${office.id},${person.id},'elected','2025-01-01') returning id`;
 await tx`insert into legislative_body_memberships(body_id,office_term_id,starts_on) values (${body.id},${service.id},'2025-01-01')`;
 const [bill]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values (${term.id},${session.id},${body.id},'qa','HB 1','QA bill','2025-02-01') returning id`;
 const [vote]=await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome) values (${session.id},${body.id},'qa','2025-02-01','QA question','passage','roll_call','passed') returning id`;
 const [choice]=await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${vote.id},${service.id},'yes','Yea') returning id`;
 const [version]=await tx`insert into bill_versions(bill_id,identifier,title,published_on,text_url) values (${bill.id},'qa','QA version','2025-02-01','https://example.test/version') returning id`;
 const [amendment]=await tx`insert into bill_amendments(bill_id,version_id,identifier,title,offered_on) values (${bill.id},${version.id},'qa','QA amendment','2025-02-01') returning id`;
 const [action]=await tx`insert into bill_actions(bill_id,session_id,body_id,occurred_on,kind,description) values (${bill.id},${session.id},${body.id},'2025-02-01','vote','QA action') returning id`;
 const [link]=await tx`insert into legislative_vote_bills(vote_id,bill_id,action_id,version_id,amendment_id) values (${vote.id},${bill.id},${action.id},${version.id},${amendment.id}) returning id`;
 const read=async(offset=0)=>[...await tx`select * from export_public_profile_rows('legislative_votes',${offset},500)`];
 const targets={people:person.id,legislative_terms:term.id,legislative_sessions:session.id,legislative_bodies:body.id,bills:bill.id,legislative_votes:vote.id,legislative_vote_choices:choice.id,legislative_vote_bills:link.id,bill_actions:action.id,bill_versions:version.id,bill_amendments:amendment.id};
 const cases:any[]=[];
 for(const [table,id] of Object.entries(targets)) for(const visibility of ['public','unlisted','private']){
  await tx.unsafe(`update public.${table} set visibility=$1 where id=$2`,[visibility,id]);
  cases.push({table,id,visibility,rows:await read()});
  await tx.unsafe(`update public.${table} set visibility='public' where id=$1`,[id]);
 }
 await tx.unsafe(await Bun.file(migration).text());
 for(const c of cases){
  await tx.unsafe(`update public.${c.table} set visibility=$1 where id=$2`,[c.visibility,c.id]);
  expect(await read()).toEqual(c.rows);
  await tx.unsafe(`update public.${c.table} set visibility='public' where id=$1`,[c.id]);
 }
 expect((await tx`select has_function_privilege('authenticated','export_public_profile_rows(text,integer,integer)','execute') allowed`)[0].allowed).toBe(false);
 await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome)
 select ${session.id}::uuid,${body.id}::uuid,'bulk-'||n,'2025-02-01'::date,'QA question','passage','roll_call','passed' from generate_series(1,16000) n`;
 await tx.unsafe('alter table legislative_vote_choices disable trigger user');
 await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) select id,${service.id}::uuid,'yes','Yea' from legislative_votes where session_id=${session.id} and identifier like 'bulk-%'`;
 await tx.unsafe('alter table legislative_vote_choices enable trigger user');
 await tx.unsafe('alter table legislative_vote_bills disable trigger user');
 await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) select ${term.id}::uuid,${session.id}::uuid,${body.id}::uuid,'qa','bulk-'||n,'QA bulk bill','2025-02-01'::date from generate_series(1,16000) n`;
 await tx.unsafe('analyze bills');await tx.unsafe('analyze legislative_votes');
 await tx`insert into legislative_vote_bills(vote_id,bill_id) select v.id,b.id from legislative_votes v join bills b on b.session_id=v.session_id and b.identifier=v.identifier where v.session_id=${session.id} and v.identifier like 'bulk-%'`;
 await tx.unsafe('alter table legislative_vote_bills enable trigger user');
 await tx.unsafe("set local statement_timeout='3s'");
 await tx.unsafe('set local role anon');
 let ids=new Set<string>();const started=performance.now();
 for(let offset=0;offset<=16000;offset+=500){const rows=await read(offset); expect(rows.length).toBe(Math.min(500,16001-offset));for(const r of rows){expect(ids.has(r.data.id)).toBe(false);ids.add(r.data.id);expect(r.data.bills).toHaveLength(1);}}
 expect(ids.size).toBe(16001);console.log(`Exported 16,001 choices: ${Math.round(performance.now()-started)}ms`);
 throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
},120000);

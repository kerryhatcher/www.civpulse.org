import {expect,test} from 'bun:test';
import {SQL} from 'bun';
test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('bill children preserve recursive gates and scale to 20,000 rows',async()=>{
 const sql=new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);const rollback=Error('rollback');
 try{await sql.begin(async tx=>{
  await tx.unsafe(await Bun.file("supabase/migrations/20261124010100_legislative_choice_browse_performance.sql").text());
  const tag=crypto.randomUUID();
  const [org]=await tx`insert into organizations(name,slug) values('Child QA',${tag}) returning id`;
  const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values(${org.id},'qa','QA term','2025-01-01') returning id`;
  const [session]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on,ends_on) values(${term.id},'qa','QA session','2025-01-01','2025-12-31') returning id`;
  const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values(${org.id},${org.id},'chamber') returning id`;
  const [person]=await tx`insert into people(full_name,slug,kind) values('QA Member',${tag},'other') returning id`;
  const [office]=await tx`insert into offices(organization_id,name) values(${org.id},'QA office') returning id`;
  const [service]=await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values(${office.id},${person.id},'elected','2025-01-01') returning id`;
  const [calendar]=await tx`insert into calendars(organization_id,name,slug) values(${org.id},'QA calendar',${tag}) returning id`;
  const [event]=await tx`insert into events(calendar_id,title,starts_at) values(${calendar.id},'QA event','2025-02-01 15:00Z') returning id`;
  const [bill]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values(${term.id},${session.id},${body.id},'qa','1','QA bill','2025-01-01') returning id`;
  const [action]=await tx`insert into bill_actions(bill_id,session_id,body_id,event_id,occurred_on,kind,description) values(${bill.id},${session.id},${body.id},${event.id},'2025-02-01','other','QA action') returning id`;
  const [sponsor]=await tx`insert into bill_sponsorships(bill_id,office_term_id,role,source_role,starts_on) values(${bill.id},${service.id},'primary_sponsor','Sponsor','2025-01-01') returning id`;
  const admin=crypto.randomUUID(),ordinary=crypto.randomUUID();
  for(const id of [admin,ordinary])await tx`insert into auth.users(id,email) values(${id},${`${id}@example.test`})`;
  await tx`insert into admins(user_id) values(${admin})`;
  const read=async(table:string,args:any={})=>(await tx`select public.browse_legislation(p_table=>${table},p_id=>${args.direct??null}::uuid,p_bill_id=>${args.bill??null}::uuid,p_person_id=>${args.person??null}::uuid,p_filters=>${JSON.stringify({bill_id:bill.id})}::text::jsonb,p_query=>${args.query??''},p_limit=>100,p_offset=>${args.offset??0}) data`)[0].data;
  const targets:any={legislative_terms:term.id,legislative_sessions:session.id,legislative_bodies:body.id,people:person.id,calendars:calendar.id,events:event.id,bills:bill.id,bill_actions:action.id,bill_sponsorships:sponsor.id};
  const samples:any[]=[];
  for(const uid of ['',ordinary,admin]){
   await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
   for(const [target,id]of Object.entries(targets))for(const visibility of ['public','unlisted','private']){
    await tx.unsafe(`update public.${target} set visibility=$1 where id=$2`,[visibility,id]);
    await tx.unsafe(`set local role ${uid?'authenticated':'anon'}`);
    for(const table of ['bill_actions','bill_sponsorships'])for(const args of [{},{direct:table==='bill_actions'?action.id:sponsor.id},{bill:bill.id},{person:person.id},{bill:bill.id,person:person.id},{query:'QA'}])samples.push({uid,target,id,visibility,table,args,data:await read(table,args)});
    await tx.unsafe('reset role');await tx.unsafe(`update public.${target} set visibility='public' where id=$1`,[id]);
   }
  }
  await tx.unsafe(await Bun.file('supabase/migrations/20261124010700_calendar_bill_child_capacity.sql').text());
  for(const s of samples){
   await tx`select set_config('request.jwt.claim.sub',${s.uid},true)`;
   await tx.unsafe(`update public.${s.target} set visibility=$1 where id=$2`,[s.visibility,s.id]);
   await tx.unsafe(`set local role ${s.uid?'authenticated':'anon'}`);expect(await read(s.table,s.args)).toEqual(s.data);await tx.unsafe('reset role');
   await tx.unsafe(`update public.${s.target} set visibility='public' where id=$1`,[s.id]);
  }
  await tx`select set_config('request.jwt.claim.sub','',true)`;
  await tx.unsafe('set local session_replication_role=replica');
  await tx`insert into bill_actions(bill_id,session_id,body_id,occurred_on,kind,description) select ${bill.id}::uuid,${session.id}::uuid,${body.id}::uuid,'2025-02-01'::date,'other','QA bulk' from generate_series(1,20000)`;
  await tx`insert into bill_sponsorships(bill_id,office_term_id,role,source_role,starts_on) select ${bill.id}::uuid,${service.id}::uuid,'cosponsor','Sponsor','2025-01-01'::date+n from generate_series(1,20000) n`;
  await tx.unsafe('set local session_replication_role=origin');await tx.unsafe("set local statement_timeout='3s'");
  for(const uid of ['',ordinary,admin]){
   await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
   await tx.unsafe(`set local role ${uid?'authenticated':'anon'}`);
   for(const table of ['bill_actions','bill_sponsorships']){const start=performance.now();const data=await read(table);expect(data.total).toBe(20001);expect(data.rows.length).toBe(100);expect((await read(table,{offset:20000})).rows.length).toBe(1);console.log(table,uid===admin?'admin':uid?'user':'anon',Math.round(performance.now()-start),'ms');}
   await tx.unsafe('reset role');expect((await tx`select has_function_privilege(${uid?'authenticated':'anon'},'legislative_private.visible_bill_child_ids(text,uuid,uuid,uuid,uuid)','execute') allowed`)[0].allowed).toBe(false);
  }
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
},120000);

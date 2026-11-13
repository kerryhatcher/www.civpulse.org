import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('vote-choice browsing preserves caller/context gates and handles 35,000 choices within API timeout',async()=>{
 const sql=new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);const rollback=Error('rollback choice browse fixtures');
 try{await sql.begin(async tx=>{
  const tag=`choice-${crypto.randomUUID()}`;
  const [org]=await tx`insert into organizations(name,slug) values('Choice QA',${tag}) returning id`;
  const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values(${org.id},'qa','Choice QA term','2025-01-01') returning id`;
  const [session]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on,ends_on) values(${term.id},'qa','Choice QA session','2025-01-01','2025-12-31') returning id`;
  const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values(${org.id},${org.id},'chamber') returning id`;
  const [office]=await tx`insert into offices(organization_id,name) values(${org.id},'Choice QA office') returning id`;
  const service:string[]=[],votes:string[]=[],choices:string[]=[];
  const people:string[]=[];
  for(const [i,visibility] of ['public','unlisted','private'].entries()){
   const [person]=await tx`insert into people(full_name,slug,kind,visibility) values(${`Choice QA ${visibility}`},${`${tag}-${i}`},'other',${visibility}) returning id`;people.push(person.id);
   const [s]=await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values(${office.id},${person.id},'elected','2025-01-01') returning id`;service.push(s.id);
   const [vote]=await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage,visibility) values(${session.id},${body.id},${String(i)},'2025-02-01',${`Choice QA ${visibility} vote`},'passage','roll_call','not_reported','partial',${visibility}) returning id`;votes.push(vote.id);
  }
  for(const vote of votes)for(const s of service){const [choice]=await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice,membership_review_note) values(${vote},${s},'yes','Yea','Synthetic QA identity reconciled') returning id`;choices.push(choice.id);}
  await tx`update legislative_vote_choices set visibility='unlisted' where id=${choices[1]}`;
  const admin=crypto.randomUUID(),ordinary=crypto.randomUUID();
  for(const id of [admin,ordinary])await tx`insert into auth.users(id,email) values(${id},${`${id}@example.test`})`;
  await tx`insert into admins(user_id) values(${admin})`;
  const original=await Bun.file('supabase/migrations/20261123090000_legislation_bill_browse_performance.sql').text();
  const start=original.indexOf('create or replace function public.browse_legislation');
  await tx.unsafe(original.slice(start,original.indexOf('\ncreate or replace function public.get_person_legislative_record',start)));
  const read=async(args:any={})=>(await tx`select public.browse_legislation(p_table=>'legislative_vote_choices',p_id=>${args.direct??null}::uuid,p_person_id=>${args.person??null}::uuid,p_vote_id=>${args.vote??null}::uuid,p_query=>${args.query??''},p_filters=>${JSON.stringify(args.filters??{})}::text::jsonb,p_limit=>100,p_offset=>${args.offset??0}) data`)[0].data;
  const samples:any[]=[];
  for(const uid of ['',ordinary,admin]){
   await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
   await tx.unsafe(`set local role ${uid?'authenticated':'anon'}`);
   for(const args of [{filters:{vote_id:votes[0]}},{direct:choices[1]},{direct:choices[1],person:people[1]},{direct:choices[3],vote:votes[1]},{person:people[1]},{vote:votes[1]},{query:'Choice QA'},{filters:{office_term_id:service[0]}}]) samples.push({uid,args,data:await read(args)});
   await tx.unsafe('reset role');
  }
  await tx`select set_config('request.jwt.claim.sub','',true)`;
  await tx.unsafe(await Bun.file('supabase/migrations/20261124000200_vote_choice_browse_performance.sql').text());
  for(const sample of samples){
   await tx`select set_config('request.jwt.claim.sub',${sample.uid},true)`;
   await tx.unsafe(`set local role ${sample.uid?'authenticated':'anon'}`);
   expect(await read(sample.args)).toEqual(sample.data);
   await tx.unsafe('reset role');
  }
  await tx`select set_config('request.jwt.claim.sub','',true)`;
  // Synthetic capacity rows do not need audit revisions or import validation.
  // This setting is connection-local and restored before exercising reads.
  await tx.unsafe("set local session_replication_role=replica");
  await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage)
   select ${session.id}::uuid,${body.id}::uuid,'bulk-'||n,'2025-02-01'::date,'Bulk QA '||n,case when n%2=0 then 'attendance' else 'passage' end,'roll_call','not_reported','partial' from generate_series(1,35000) n`;
  await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice,membership_review_note)
   select id,${service[0]}::uuid,'yes','Yea','Synthetic QA identity reconciled' from legislative_votes where session_id=${session.id} and identifier like 'bulk-%'`;
  await tx.unsafe("set local session_replication_role=origin");
  await tx.unsafe("set local statement_timeout='3s'");
  for(const uid of ['',ordinary,admin]){
   await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
   await tx.unsafe(`set local role ${uid?'authenticated':'anon'}`);
   const started=performance.now(),result=await read({filters:{office_term_id:service[0]}});
   expect(result.total).toBe(35000+samples.find(sample=>sample.uid===uid&&sample.args.filters?.office_term_id).data.total);
   expect(result.rows).toHaveLength(100);
   expect((await read({filters:{office_term_id:service[0]},offset:34950})).rows.length).toBeGreaterThan(0);
   console.log(`35,000-choice browse (${uid===admin?'admin':uid?'user':'anon'}): ${Math.round(performance.now()-started)}ms`);
   await tx.unsafe("reset role");
   expect((await tx`select has_function_privilege(${uid?'authenticated':'anon'},'legislative_private.visible_vote_choice_ids(uuid,uuid,uuid)','execute') allowed`)[0].allowed).toBe(false);
   await tx.unsafe('reset role');
  }
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
},120000);

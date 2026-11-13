import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('bill browsing preserves visibility and handles 4,000 bills and links',async()=>{
 const sql=new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);const rollback=Error('rollback');
 try{await sql.begin(async tx=>{
  const suffix=crypto.randomUUID();const [org]=await tx`insert into organizations(name,slug) values ('Directory QA',${suffix}) returning id`;
  const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values (${org.id},'qa','QA term','2025-01-01') returning id`;
  const [session]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on,ends_on) values (${term.id},'qa','QA session','2025-01-01','2025-12-31') returning id`;
  const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
  const [vote]=await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage) values (${session.id},${body.id},'1','2025-02-01','QA passage','passage','roll_call','not_reported','partial') returning id`;
  const bills:any[]=[];
  for(const [i,visibility] of ['public','unlisted','private','public'].entries()){
   const [b]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values (${term.id},${session.id},${body.id},'qa',${`HB ${i}`},${`QA title ${i}`},'2025-01-02',${visibility}) returning id`;bills.push(b);
   if(i!==3)await tx`insert into legislative_vote_bills(vote_id,bill_id) values (${vote.id},${b.id})`;
  }
  const [version]=await tx`insert into bill_versions(bill_id,identifier,title,published_on,text_url,visibility) values (${bills[3].id},'private','Private version','2025-01-03','https://example.test/version','private') returning id`;
  await tx`insert into legislative_vote_bills(vote_id,bill_id,version_id) values (${vote.id},${bills[3].id},${version.id})`;
  const [person]=await tx`insert into people(full_name,slug,kind) values ('QA Member',${`qa-${suffix}`},'other') returning id`;
  const [office]=await tx`insert into offices(organization_id,name) values (${org.id},'QA office') returning id`;
  const [service]=await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values (${office.id},${person.id},'elected','2025-01-01') returning id`;
  await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice,membership_review_note) values (${vote.id},${service.id},'yes','Yea','QA reconciled source identity')`;
  const admin=crypto.randomUUID(),ordinary=crypto.randomUUID();
  for(const id of [admin,ordinary])await tx`insert into auth.users(id,email) values (${id},${`${id}@example.test`})`;
  await tx`insert into admins(user_id) values (${admin})`;
  const browse=async(table:string,direct:string|null=null,context:string|null=null,query='')=>{
   const [r]=await tx`select public.browse_legislation(p_table=>${table},p_id=>${direct}::uuid,p_bill_id=>${context}::uuid,p_filters=>${JSON.stringify(table==='bills'?{term_id:term.id}:{vote_id:vote.id})}::text::jsonb,p_query=>${query},p_limit=>100) as data`;return r.data;
  };
  // Snapshot the previous RPC's exact projections for all caller types and direct contexts.
  const snapshots:any[]=[];
  for(const id of ['',ordinary,admin]){
   await tx`select set_config('request.jwt.claim.sub',${id},true)`;
   for(const [table,direct,context,query] of [
    ['bills',null,null,''],['bills',null,null,'QA term'],['bills',bills[1].id,null,''],
    ['legislative_vote_bills',null,null,''],['legislative_vote_bills',null,bills[1].id,''],
   ] as const)snapshots.push({id,table,direct,context,query,data:await browse(table,direct,context,query)});
  }
  await tx`select set_config('request.jwt.claim.sub','',true)`;
  // The current fresh DB may lack the hosted compatibility helper; main's earlier migration creates it.
  if(!(await tx`select to_regprocedure('legislative_private.visible_vote_ids(uuid,uuid,uuid)') as f`)[0].f){
   await tx.unsafe(await Bun.file(new URL('../../supabase/migrations/20261123080000_person_legislative_bill_groups.sql',import.meta.url)).text());
  }
  await tx.unsafe(await Bun.file(new URL('../../supabase/migrations/20261123090000_legislation_bill_browse_performance.sql',import.meta.url)).text());
  for(const sample of snapshots){
   await tx`select set_config('request.jwt.claim.sub',${sample.id},true)`;
   expect(await browse(sample.table,sample.direct,sample.context,sample.query)).toEqual(sample.data);
  }
  await tx`select set_config('request.jwt.claim.sub','',true)`;
  for(const role of ["anon","authenticated"]) {
   const [privilege]=await tx`select has_function_privilege(${role},'legislative_private.visible_bill_ids(uuid,uuid,uuid,uuid)','EXECUTE') as allowed`;
   expect(privilege.allowed).toBe(false);
  }
  await tx`update legislative_votes set visibility='private' where id=${vote.id}`;
  expect((await browse('legislative_vote_bills')).total).toBe(0);
  await tx`update legislative_votes set visibility='public' where id=${vote.id}`;
  // Unlisted parents stay hidden even for a directly addressed public bill.
  await tx`update legislative_terms set visibility='unlisted' where id=${term.id}`;
  expect((await browse('bills',bills[0].id)).total).toBe(0);
  await tx`update legislative_terms set visibility='public' where id=${term.id}`;
  const [link]=await tx`select id from legislative_vote_bills where bill_id=${bills[0].id}`;
  await tx`update legislative_vote_bills set visibility='unlisted' where id=${link.id}`;
  expect((await browse('legislative_vote_bills')).total).toBe(0);
  expect((await browse('legislative_vote_bills',link.id)).total).toBe(1);
  await tx`update legislative_vote_bills set visibility='public' where id=${link.id}`;
  // Statement timeout is a meaningful regression check for the production-sized import.
  await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on)
    select ${term.id}::uuid,${session.id}::uuid,${body.id}::uuid,'bulk','QA '||n,'Bulk QA '||n,'2025-01-02'::date from generate_series(1,4000) n`;
  await tx`insert into legislative_vote_bills(vote_id,bill_id) select ${vote.id}::uuid,id from bills where term_id=${term.id} and numbering_context='bulk'`;
  await tx.unsafe("set local statement_timeout='5s'");
  for(const id of ['',ordinary,admin]){
   await tx`select set_config('request.jwt.claim.sub',${id},true)`;
   await tx.unsafe(`set local role ${id?'authenticated':'anon'}`);
   const started=performance.now();
   expect((await browse('bills')).total).toBe(id===admin?4004:4002);
   expect((await browse('bills',null,null,'Bulk QA')).total).toBe(4000);
   expect((await browse('legislative_vote_bills')).total).toBe(id===admin?4004:4001);
   const [grouped]=await tx`select public.get_person_legislative_bill_groups(${person.id}) as data`;
   expect(grouped.data.total).toBe(id===admin?4004:4001);
   console.log(`4,000-row browse/search/links/profile checks (${id===admin?'admin':id?'user':'anon'}): ${Math.round(performance.now()-started)}ms`);
   await tx.unsafe('reset role');
  }
  await tx.unsafe("set local statement_timeout='60s'");
  await tx.unsafe(await Bun.file(new URL('../../supabase/migrations/20261123090100_legislative_prefiling.sql',import.meta.url)).text());
  const reject=async(query:()=>Promise<unknown>)=>{await tx.unsafe('savepoint invalid_date');try{await query();throw Error('Expected date rejection')}catch(error){expect((error as any).errno).toBe('23514')}finally{await tx.unsafe('rollback to savepoint invalid_date')}};
  await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values (${term.id},${session.id},${body.id},'prefiled','SR 1','Prefiled resolution','2024-12-31')`;
  await reject(()=>tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values (${term.id},${session.id},${body.id},'invalid','HB 1','After session','2026-01-01')`);
  await reject(()=>tx`update legislative_votes set occurred_on='2024-12-31' where id=${vote.id}`);
  await reject(()=>tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage) values (${session.id},${body.id},'early','2024-12-31','Early vote','passage','voice','not_reported','no_individual_record')`);
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close()}
},120000);

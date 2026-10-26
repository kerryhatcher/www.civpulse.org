import {expect,test} from 'bun:test';
import {SQL} from 'bun';
import {emptyProfileSections,groupProfileVotes} from '../../apps/web/src/lib/profile-sections';

test.skipIf(!process.env.PROFILE_TEST_DATABASE_URL)('public export matches gated readers and excludes hidden profiles, articles, elections, calendars and legislative parents',async()=>{
 const sql=new SQL(process.env.PROFILE_TEST_DATABASE_URL!);const rollback=Error('rollback profile fixtures');
 try{await sql.begin(async tx=>{
  if(!(await tx`select to_regprocedure('export_public_profile_rows(text,integer,integer)') fn`)[0].fn) await tx.unsafe(await Bun.file('supabase/migrations/20261123120000_public_profile_sections.sql').text());
  const suffix=crypto.randomUUID();
  const [org]=await tx`insert into organizations(name,slug) values ('Profile snapshot QA',${suffix}) returning id`;
  const [office]=await tx`insert into offices(organization_id,name) values (${org.id},'Representative') returning id`;
  const people:string[]=[],services:string[]=[];
  for(const visibility of ['public','unlisted','private']){
   const [p]=await tx`insert into people(full_name,slug,kind,visibility) values (${`QA ${visibility}`},${`${suffix}-${visibility}`},'other',${visibility}) returning id`;people.push(p.id);
   const [t]=await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values (${office.id},${p.id},'elected','2026-01-01') returning id`;services.push(t.id);
   for(const articleVisibility of ['public','unlisted','private']){
    const [a]=await tx`insert into articles(title,url,visibility) values (${`QA ${articleVisibility}`},${`https://example.test/${suffix}/${visibility}/${articleVisibility}`},${articleVisibility}) returning id`;
    await tx`insert into article_people(article_id,person_id) values (${a.id},${p.id})`;
    await tx`insert into article_organizations(article_id,organization_id) values (${a.id},${org.id})`;
   }
  }
  const [calendar]=await tx`insert into calendars(name,slug,organization_id) values ('QA',${suffix},${org.id}) returning id`;
  const events:string[]=[];
  for(const visibility of ['public','unlisted','private']){
   const [e]=await tx`insert into events(calendar_id,title,starts_at,is_meeting,visibility) values (${calendar.id},'QA meeting','2026-02-01Z',true,${visibility}) returning id`;events.push(e.id);
   await tx`insert into meeting_attendance(meeting_id,person_id,status) values (${e.id},${people[0]},'present')`;
   for(let i=0;i<(visibility==='public'?55:1);i++){
    const [v]=await tx`insert into meeting_votes(meeting_id,subject,position) values (${e.id},${`QA motion ${i}`},${i}) returning id`;
    await tx`insert into meeting_vote_choices(vote_id,meeting_id,person_id,choice) values (${v.id},${e.id},${people[0]},'yes')`;
   }
   const [el]=await tx`insert into elections(name,slug,election_date,kind,visibility) values ('QA election',${`${suffix}-${visibility}`},'2026-11-03','general',${visibility}) returning id`;
   const [c]=await tx`insert into contests(election_id,office) values (${el.id},'QA office') returning id`;
   await tx`insert into contest_candidates(contest_id,person_id) values (${c.id},${people[0]})`;
  }
  const [term]=await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values (${org.id},'qa','QA','2026-01-01') returning id`;
  const [session]=await tx`insert into legislative_sessions(term_id,identifier,name,starts_on) values (${term.id},'qa','QA','2026-01-01') returning id`;
  const [body]=await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
  await tx`insert into legislative_body_memberships(body_id,office_term_id,starts_on) values (${body.id},${services[0]},'2026-01-01')`;
  const bills:string[]=[];
  for(const visibility of ['public','unlisted','private']){
   const [b]=await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values (${term.id},${session.id},${body.id},${visibility},'HB 1',${`QA ${visibility}`},'2026-01-01',${visibility}) returning id`;bills.push(b.id);
  }
  for(let i=0;i<32;i++){
   const [v]=await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,occurred_at,question,category,method,outcome,visibility)
    values (${session.id},${body.id},${String(i)},'2026-02-01',${`2026-02-01T${String(i%24).padStart(2,'0')}:00:00Z`},${`QA vote ${i}`},${i===0?'amendment':'passage'},'roll_call','passed',${i===23?'private':'public'}) returning id`;
   await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${v.id},${services[0]},'yes','Yea')`;
   if(i<30)for(const bill of bills)await tx`insert into legislative_vote_bills(vote_id,bill_id) values (${v.id},${bill})`;
  }
  const role=async(name:string,id='')=>{await tx.unsafe(`set local role ${name}`);await tx`select set_config('request.jwt.claim.sub',${id},true)`;};
  await role('anon');
  const exported=async(section:string)=>{
   const rows:any[]=[];
   for(let offset=0;;offset+=7){const page=await tx`select * from export_public_profile_rows(${section},${offset},7)`;rows.push(...page);if(page.length<7)break;}
   return rows;
  };
  for(const section of ['offices','person_articles','candidacies','votes','legislative_votes']){
   const rows=await exported(section);
   expect(rows.some(r=>people.slice(1).includes(r.owner_id))).toBe(false);
  }
  const own=async(section:string)=>(await exported(section)).filter(r=>r.owner_id===people[0]).map(r=>r.data);
  expect(await own('offices')).toEqual([...(await tx`select * from get_office_terms(${people[0]})`)].map(r=>({...r,starts_on:r.starts_on instanceof Date?r.starts_on.toISOString().slice(0,10):r.starts_on})));
  expect(await own('person_articles')).toEqual([...(await tx`select * from get_person_articles(${people[0]})`)]);
  expect((await own('candidacies')).map(r=>r.election_id)).toEqual((await tx`select * from get_person_candidacies(${people[0]})`).map(r=>r.election_id));
  const votes=[...(await tx`select * from get_person_votes(${people[0]},0,50)`),...(await tx`select * from get_person_votes(${people[0]},50,50)`)];
  expect((await own('votes')).map(r=>r.vote_id)).toEqual(votes.map(r=>r.vote_id));expect(votes).toHaveLength(55);
  const snapshot=emptyProfileSections();snapshot.legislativeVotes=await own('legislative_votes');
  const keys=(rows:any[])=>rows.map(({group_id,vote_id,vote_count}:any)=>({group_id,vote_id,vote_count}));
  for(const category of [null,'passage','amendment'])for(const query of [null,'HB','public','unlisted','missing','HB _','QA %']){
   const expected=(await tx`select get_person_legislative_bill_groups(${people[0]},null,null,${category},100,0,${term.id},${query}) result`)[0].result;
   const actual=groupProfileVotes(snapshot,{p_term_id:term.id,p_category:category,p_bill_query:query,p_limit:100});
   expect(actual.total).toBe(expected.total);expect(keys(actual.rows)).toEqual(keys(expected.rows));
  }
  expect(snapshot.legislativeVotes.every(v=>(v.bills as any[]).every(b=>b.id===bills[0]))).toBe(true);
  await tx.unsafe('reset role');await tx`update calendars set visibility='unlisted' where id=${calendar.id}`;await role('anon');expect(await own('votes')).toHaveLength(0);
  await tx.unsafe('reset role');await tx`update legislative_terms set visibility='private' where id=${term.id}`;await role('anon');expect(await own('legislative_votes')).toHaveLength(0);
  expect((await tx`select has_function_privilege('authenticated','export_public_profile_rows(text,integer,integer)','execute') allowed`)[0].allowed).toBe(false);
  await tx.unsafe('reset role');await tx`update people set visibility='unlisted' where id=${people[0]}`;await role('anon');expect(await own('offices')).toHaveLength(0);expect(await own('person_articles')).toHaveLength(0);expect(await own('candidacies')).toHaveLength(0);
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
},30000);

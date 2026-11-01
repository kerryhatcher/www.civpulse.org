import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const previous='supabase/migrations/20261125001300_profile_office_export_scale.sql';
const migration='supabase/migrations/20261125001400_profile_related_export_eligible_owners.sql';
const sections=['person_articles','organization_articles','candidacies'];

test.skipIf(!process.env.PROFILE_TEST_DATABASE_URL)('eligible-owner export preserves payloads/visibility/paging and bounds sparse-owner work',async()=>{
 const url=process.env.PROFILE_TEST_DATABASE_URL!;
 if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))throw Error('Use a local database for rollback-only profile export verification.');
 const db=new SQL(url),rollback=Error('rollback related export');
 try{await db.begin(async tx=>{
  const beforeSql=await Bun.file(previous).text(),afterSql=await Bun.file(migration).text();
  await tx.unsafe(beforeSql);
  const suffix=crypto.randomUUID();
  await tx`insert into people(full_name,slug,visibility) select 'Synthetic sparse owner '||n,${suffix}||'-empty-person-'||n,'public' from generate_series(1,7000)n`;
  await tx`insert into organizations(name,slug) select 'Synthetic sparse organization '||n,${suffix}||'-empty-org-'||n from generate_series(1,5000)n`;
  await tx`insert into people(full_name,slug,visibility) select 'Synthetic linked owner '||n,${suffix}||'-linked-person-'||n,'public' from generate_series(1,100)n`;
  await tx`insert into organizations(name,slug) select 'Synthetic linked organization '||n,${suffix}||'-linked-org-'||n from generate_series(1,100)n`;
  await tx`insert into articles(title,url,visibility,fetched_on,published_on) select 'Synthetic article '||n,'https://example.test/'||${suffix}||'/article-'||n,'public','2026-10-01'::date,case when n%2=0 then '2026-09-01'::date end from generate_series(1,6)n`;
  await tx`insert into article_people(article_id,person_id,role) select a.id,p.id,'Subject' from articles a cross join people p where a.url like ${'https://example.test/'+suffix+'/%'} and p.slug like ${suffix+'-linked-person-%'}`;
  await tx`insert into article_organizations(article_id,organization_id,role) select a.id,o.id,'Publisher' from articles a cross join organizations o where a.url like ${'https://example.test/'+suffix+'/%'} and o.slug like ${suffix+'-linked-org-%'}`;
  const[election]=await tx`insert into elections(name,slug,election_date,kind,visibility) values('Synthetic election',${suffix},'2026-11-03','general','public') returning id`;
  await tx`insert into contests(election_id,office,seat) select ${election.id}::uuid,'Synthetic office',n::text from generate_series(1,6)n`;
  await tx`insert into contest_candidates(contest_id,person_id,status) select c.id,p.id,'running' from contests c cross join people p where c.election_id=${election.id} and p.slug like ${suffix+'-linked-person-%'}`;
  // A single dense owner crosses a 500-row page in every changed branch.
  const[dense]=await tx`insert into people(full_name,slug) values('Synthetic dense owner',${suffix+'-dense'}) returning id`;
  const[denseOrg]=await tx`insert into organizations(name,slug) values('Synthetic dense organization',${suffix+'-dense-org'}) returning id`;
  await tx`insert into articles(title,url,visibility,fetched_on,published_on) select 'Dense article '||n,'https://example.test/'||${suffix}||'/dense-'||n,'public','2026-10-01'::date,case when n%2=0 then '2026-09-01'::date end from generate_series(1,650)n`;
  await tx`insert into article_people(article_id,person_id,role) select id,${dense.id}::uuid,'Author' from articles where url like ${'https://example.test/'+suffix+'/dense-%'}`;
  await tx`insert into article_organizations(article_id,organization_id,role) select id,${denseOrg.id}::uuid,'Publisher' from articles where url like ${'https://example.test/'+suffix+'/dense-%'}`;
  await tx`insert into contests(election_id,office,seat) select ${election.id}::uuid,'Dense office',n::text from generate_series(1,650)n`;
  await tx`insert into contest_candidates(contest_id,person_id,status,is_write_in) select id,${dense.id}::uuid,'withdrawn',true from contests where election_id=${election.id} and office='Dense office'`;
  const people:string[]=[],articles:string[]=[],contests:string[]=[];
  const[visibilityOrg]=await tx`insert into organizations(name,slug) values('Visibility organization',${suffix+'-visibility-org'}) returning id`;
  for(const visibility of ['public','unlisted','private']){
   const[p]=await tx`insert into people(full_name,slug,visibility) values('Visibility owner',${suffix+'-'+visibility},${visibility}) returning id`;people.push(p.id);
   const[a]=await tx`insert into articles(title,url,visibility,published_on,fetched_on) values('Visibility article',${'https://example.test/'+suffix+'/'+visibility},${visibility},null,'2026-10-01') returning id`;articles.push(a.id);
   const[e]=await tx`insert into elections(name,slug,election_date,kind,visibility) values('Visibility election',${suffix+'-election-'+visibility},'2024-11-05','general',${visibility}) returning id`;
   const[c]=await tx`insert into contests(election_id,office,district,seat) values(${e.id},'Visibility office','District','Seat') returning id`;contests.push(c.id);
  }
  for(const person of people){for(const article of articles)await tx`insert into article_people(article_id,person_id,role) values(${article},${person},'Mentioned')`;for(const contest of contests)await tx`insert into contest_candidates(contest_id,person_id,party,status,is_write_in) values(${contest},${person},'Synthetic party','lost',false)`;}
  for(const article of articles)await tx`insert into article_organizations(article_id,organization_id,role) values(${article},${visibilityOrg.id},'Subject')`;
  const[hiddenOnly]=await tx`insert into people(full_name,slug) values('Hidden-related-only owner',${suffix+'-hidden-only'}) returning id`;
  await tx`insert into article_people(article_id,person_id) values(${articles[2]},${hiddenOnly.id})`;
  await tx`insert into contest_candidates(contest_id,person_id) values(${contests[2]},${hiddenOnly.id})`;
  for(const table of ['people','organizations','article_people','article_organizations','articles','contest_candidates','contests','elections'])await tx.unsafe('analyze public.'+table);
  await tx`select set_config('request.jwt.claim.sub','',true)`;
  const role=async(name:string,subject='')=>{await tx.unsafe('reset role');await tx`select set_config('request.jwt.claim.sub',${subject},true)`;await tx.unsafe('set local role '+name);};
  const read=async(section:string,offset=0,limit=500)=>[...await tx`select * from public.export_public_profile_rows(${section},${offset},${limit})`];
  const all=async(section:string)=>{const rows:any[]=[];for(let offset=0;;offset+=500){const page=await read(section,offset);rows.push(...page);if(page.length<500)return rows;}};
  const expected=new Map<string,any[]>();
  await role('anon');for(const section of sections)expected.set(section,await all(section));
  const directBefore={
   publicArticles:[...await tx`select * from public.get_person_articles(${people[0]})`],
   unlistedArticles:[...await tx`select * from public.get_person_articles(${people[1]})`],
   privateArticles:[...await tx`select * from public.get_person_articles(${people[2]})`],
   organizationArticles:[...await tx`select * from public.get_organization_articles(${visibilityOrg.id})`],
   candidacies:[...await tx`select * from public.get_person_candidacies(${people[1]})`],
  };
  expect(directBefore.publicArticles).toHaveLength(1);expect(directBefore.unlistedArticles).toHaveLength(1);expect(directBefore.privateArticles).toHaveLength(0);
  await role('postgres');
  const metrics:any[]=[];
  async function measure(stage:string,source:string){
   for(const section of sections)for(const offset of [0,500]){
    await role('postgres');
    const branch=source.match(new RegExp(`elsif p_section='${section}' then\\s+return query ([\\s\\S]*?);`))![1].replace(/limit p_limit offset p_offset\s*$/,`limit 500 offset ${offset}`);
    const plan=(await tx.unsafe('explain(analyze,buffers,format json) '+branch))[0]['QUERY PLAN'][0];
    const functions:any[]=[];const visit=(node:any)=>{if(node['Node Type']==='Function Scan')functions.push({name:node['Function Name'],loops:node['Actual Loops']});for(const child of node.Plans??[])visit(child);};visit(plan.Plan);
    if(stage==='after')expect(functions.reduce((sum,row)=>sum+row.loops,0)).toBeLessThanOrEqual(new Set(expected.get(section)!.map(row=>row.owner_id)).size);
    if(process.env.PROFILE_EXPORT_PLAN_DIR)await Bun.write(`${process.env.PROFILE_EXPORT_PLAN_DIR}/${stage}-${section}-${offset}.json`,JSON.stringify(plan,null,2));
    await role('anon');const start=performance.now();const rows=await read(section,offset);metrics.push({stage,section,offset,rows:rows.length,rpcMs:performance.now()-start,planMs:plan['Execution Time'],functions});
   }
  }
  await measure('before',beforeSql);await role('postgres');await tx.unsafe(afterSql);
  await role('anon');await tx.unsafe("set local statement_timeout='3s'");
  for(const section of sections){
   const rows=await all(section);expect(rows).toEqual(expected.get(section)!);
   expect(rows.some(row=>people.slice(1).includes(row.owner_id)||row.owner_id===hiddenOnly.id)).toBe(false);
   expect(new Set(rows.map(row=>`${row.owner_id}/${row.ordinal}`)).size).toBe(rows.length);
   const denseRows=rows.filter(row=>row.owner_id===(section==='organization_articles'?denseOrg.id:dense.id));
   expect(denseRows).toHaveLength(650);expect(denseRows.map(row=>Number(row.ordinal))).toEqual(Array.from({length:650},(_,i)=>i+1));
   expect(await read(section,499,7)).toEqual(rows.slice(499,506));
   expect(await read(section,rows.length,7)).toEqual([]);
  }
  expect([...await tx`select * from public.get_person_articles(${people[0]})`]).toEqual(directBefore.publicArticles);
  expect([...await tx`select * from public.get_person_articles(${people[1]})`]).toEqual(directBefore.unlistedArticles);
  expect([...await tx`select * from public.get_person_articles(${people[2]})`]).toEqual(directBefore.privateArticles);
  expect([...await tx`select * from public.get_organization_articles(${visibilityOrg.id})`]).toEqual(directBefore.organizationArticles);
  expect([...await tx`select * from public.get_person_candidacies(${people[1]})`]).toEqual(directBefore.candidacies);
  expect((await tx`select has_function_privilege('authenticated','public.export_public_profile_rows(text,integer,integer)','execute') allowed`)[0].allowed).toBe(false);
  expect((await tx`select has_function_privilege('anon','public.export_public_profile_rows(text,integer,integer)','execute') allowed`)[0].allowed).toBe(true);
  await measure('after',afterSql);
  await role('postgres',crypto.randomUUID());
  await tx.unsafe('savepoint denied');let denied=false;try{await read('person_articles');}catch(error){denied=String(error).includes('anonymous build client');}await tx.unsafe('rollback to savepoint denied');expect(denied).toBe(true);
  await role('postgres');
  const summaries=metrics.map(row=>({...row,rpcMs:Math.round(row.rpcMs*100)/100}));console.log(JSON.stringify(summaries));
  if(process.env.PROFILE_EXPORT_PLAN_DIR)await Bun.write(`${process.env.PROFILE_EXPORT_PLAN_DIR}/timings.json`,JSON.stringify(metrics,null,2));
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}finally{await db.close();}
},120000);

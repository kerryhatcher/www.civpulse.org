import {test,expect} from 'bun:test';
import {SQL} from 'bun';
import bibbBaseline from './fixtures/bibb-statistic-values.json';
const url=process.env.COUNTY_STATISTICS_TEST_DATABASE_URL;
test.skipIf(!url)('all county profiles are complete, searchable, sourced, public-read and admin-write with rebuild invalidation',async()=>{
 const db=new SQL(url!),rollback=new Error('rollback county-statistic fixtures');
 try{await db.begin(async tx=>{
  const [exists]=await tx`select to_regclass('public.county_statistics') as name`;
  if(!exists.name)await tx.unsafe(await Bun.file('supabase/migrations/20261125000800_county_statistics.sql').text());
  expect((await tx`select count(*)::int as n from public.county_statistics`)[0].n).toBe(9440);
  expect(await tx`select county_fips from public.county_statistics group by county_fips having count(*)<>59`).toHaveLength(0);
  expect((await tx`select count(*)::int as n from public.county_geographies where kind='county'`)[0].n).toBe(159);
  expect((await tx`select value::text from public.county_statistics where county_fips='13021' and indicator_code='PST045225'`)[0].value).toBe('157556');
  const baselineRows=await tx`select county_fips,indicator_code,value::float8 as value from public.county_statistics where county_fips in ('13021','13000')`;
  for(const stat of bibbBaseline){expect(baselineRows.find(r=>r.county_fips==='13021'&&r.indicator_code===stat.code)?.value).toBe(stat.county);expect(baselineRows.find(r=>r.county_fips==='13000'&&r.indicator_code===stat.code)?.value).toBe(stat.georgia);}
  const ages=await tx`select county_fips,sum(numerator)::text as n from public.county_statistic_records where topic_id='age' group by county_fips`;
  for(const age of ages){const [population]=await tx`select value::text as n from public.county_statistics where county_fips=${age.county_fips} and indicator_code='PST045225'`;expect(Number(age.n)).toBe(Number(population.n));}
  const admin=crypto.randomUUID(),user=crypto.randomUUID();for(const id of [admin,user])await tx`insert into auth.users(id,email) values (${id},${`${id}@example.test`})`;await tx`insert into public.admins(user_id) values (${admin})`;
  async function denied(run:()=>Promise<unknown>,code:string){await tx.unsafe('savepoint county_denied');try{await run();throw Error('Expected database rejection');}catch(e){expect((e as {errno:string}).errno).toBe(code);}finally{await tx.unsafe('rollback to savepoint county_denied');}}
  await tx.unsafe('set local role anon');
  const [anon]=await tx`select public.search_county_statistics('Bibb household income') as result`;
  expect(anon.result.total_count).toBe(1);expect(anon.result.results[0].value).toBe(51234);expect(anon.result.results[0].source_url).toContain('census.gov');expect(anon.result.results[0].margin_of_error).toBe(2220);
  expect((await tx`select public.search_county_statistics('', '13001') as r`)[0].r.total_count).toBe(59);
  expect((await tx`select public.search_county_statistics('',null,'PST045225',null,500,0) as r`)[0].r.results).toHaveLength(160);
  expect((await tx`select public.search_county_statistics('',null,null,'age',10,10) as r`)[0].r.results).toHaveLength(10);
  await denied(()=>tx`update public.county_statistics set value=0 where county_fips='13021'`,'42501');
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${user},true)`;
  expect(await tx`update public.county_statistics set value=0 where county_fips='13021' returning *`).toHaveLength(0);
  expect(await tx`delete from public.county_statistics where county_fips='13021' returning *`).toHaveLength(0);
  await denied(()=>tx`insert into public.county_statistic_sources(id,publisher,title,source_url,retrieved_on,sha256) values ('unauthorized','Census','Unauthorized','https://example.test','2026-11-01',${'a'.repeat(64)})`,'42501');
  await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const [old]=await tx`select updated_at::text as stamp from public.county_statistics where county_fips='13021' and indicator_code='PST045225'`;
  await tx.unsafe('reset role');const [before]=await tx`select revision::text as revision from public.frontend_rebuild_state`;await tx.unsafe('set local role authenticated');
  await tx`update public.county_statistics set value=157557 where county_fips='13021' and indicator_code='PST045225'`;
  expect((await tx`select value::int as n from public.county_statistics where county_fips='13021' and indicator_code='PST045225'`)[0].n).toBe(157557);
  expect(await tx`update public.county_statistics set value=1 where county_fips='13021' and indicator_code='PST045225' and updated_at=${old.stamp}::timestamptz returning *`).toHaveLength(0);
  await denied(()=>tx`update public.county_statistics set value=101 where county_fips='13021' and indicator_code='EDU685224'`,'23514');
  await denied(()=>tx`update public.county_statistics set value='NaN'::numeric where county_fips='13021' and indicator_code='PST045225'`,'23514');
  await denied(()=>tx`update public.county_statistics set status='suppressed' where county_fips='13021' and indicator_code='PST045225'`,'23514');
  await denied(()=>tx`update public.county_statistic_sources set source_url='javascript:alert(1)' where id='population'`,'23514');
  await tx`update public.county_statistics set status='unavailable',value=null where county_fips='13021' and indicator_code='PST045225'`;
  expect((await tx`select public.search_county_statistics('', '13021','PST045225') as r`)[0].r.results[0].value).toBeNull();
  await tx.unsafe('reset role');const [after]=await tx`select revision::text as revision,needs_rebuild from public.frontend_rebuild_state`;expect(BigInt(after.revision)).toBeGreaterThan(BigInt(before.revision));expect(after.needs_rebuild).toBe(true);
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}finally{await db.close();}
},60000);

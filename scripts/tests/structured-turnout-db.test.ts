import {expect,test} from 'bun:test';
import {SQL} from 'bun';
import {fixture} from './fixtures/structured-turnout';
const url=process.env.ELECTION_RESULTS_TEST_DATABASE_URL;
test.skipIf(!url)('structured turnout: 636 rows, strict evidence, atomic revisions, authorization and readback',async()=>{
 const db=new SQL(url!);const rollback=new Error('rollback');
 try{await db.begin(async tx=>{
  if(!(await tx`select to_regclass('public.structured_turnout_reports') t`)[0].t) await tx.unsafe(await Bun.file('supabase/migrations/20261124010900_structured_turnout.sql').text());
  const admin=crypto.randomUUID(),election=crypto.randomUUID();
  await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;
  await tx`insert into public.admins(user_id) values (${admin})`;
  await tx`insert into public.elections(id,slug,name,election_date,visibility) values (${election},${`qa-${election}`},'Synthetic turnout test','2026-11-03','public')`;
  const data=fixture(election);
  const call=async(d:any=data,previous:string|null=null,dry=true,sha?:string)=>{const text=JSON.stringify(d);return (await tx`select public.import_structured_turnout(${text},${sha??new Bun.CryptoHasher('sha256').update(text).digest('hex')},${previous}::uuid,${dry}) r`)[0].r;};
  const fail=async(fn:()=>Promise<unknown>,message:string)=>{await tx.unsafe('savepoint bad');let caught=false;try{await fn();}catch(e){caught=true;expect(String(e)).toContain(message);}finally{await tx.unsafe('rollback to savepoint bad');}expect(caught).toBe(true);};
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  expect((await call()).row_count).toBe(636);
  expect((await tx`select count(*)::int n from public.structured_turnout_reports where election_id=${election}`)[0].n).toBe(0);
  await fail(()=>call(data,null,true,'b'.repeat(64)),'checksum');
  for(const mutate of [
   (d:any)=>d.token='private', (d:any)=>d.status='certified',(d:any)=>d.tables[0].rows[0].measures.accepted.value=-1,
   (d:any)=>d.tables[1].rows[0].measures.acceptance_ratio.value=50,(d:any)=>d.tables[0].rows[0].county_fips='13000',
   (d:any)=>d.tables[0].rows.push(d.tables[0].rows[0]),(d:any)=>d.tables[0].rows[0].measures.extra={value:0,display:'0'},
   (d:any)=>d.tables[0].object_id='wrong',(d:any)=>d.election_date='2026-11-04',
  ]){const d=structuredClone(data);mutate(d);await fail(()=>call(d),'');}
  const saved=await call(data,null,false);expect(saved.status).toBe('saved');
  expect((await call(data,null,false)).report_id).toBe(saved.report_id);
  const next=structuredClone(data);next.captured_at='2026-10-27T00:19:37Z';next.tables[0].rows[0].measures.accepted.value=90;
  await fail(()=>call(next),'Report changed');
  const revision=await call(next,saved.report_id,false);expect(revision.supersedes).toBe(saved.report_id);
  const stale=structuredClone(data);stale.capture_run_id=crypto.randomUUID();await fail(()=>call(stale,revision.report_id),'Stale capture');
  const known=structuredClone(next);known.captured_at='2026-10-27T00:22:37Z';
  known.tables[0].as_of='2026-10-26T18:34:58-04:00';known.tables[0].as_of_label='*Data as of : 10/26/2026 6:34:58 PM';
  expect((await call(known,revision.report_id)).status).toBe('validated');
  const conflict=structuredClone(known);conflict.tables[0].as_of_label='*Data as of : 10/26/2026 6:34:59 PM';
  await fail(()=>call(conflict,revision.report_id),'Source as-of');
  const missing=structuredClone(known);missing.tables[0].as_of_label='';
  await fail(()=>call(missing,revision.report_id),'Missing source time');
  for(const key of ['status','provider','source_url','schema_version']){const broken:any=structuredClone(next);broken[key]=null;await fail(()=>call(broken),'');}
  await fail(()=>tx`select public.import_structured_turnout('{',repeat('a',64))`,'JSON evidence');
  await fail(()=>tx`select public.import_structured_turnout(repeat('x',2097153),repeat('a',64))`,'2 MiB');
  await fail(()=>tx`delete from public.structured_turnout_reports`,'permission denied');
  const read=async(offset=0,id:string|null=null)=>(await tx`select public.get_structured_turnout(${election},${id}::uuid,${offset},100) r`)[0].r;
  const first=await read();expect(first.total).toBe(636);expect(first.history).toHaveLength(2);expect(first.report.supersedes).toBe(saved.report_id);
  let all:any[]=[];for(let i=0;i<636;i+=100)all.push(...(await read(i)).rows);expect(all).toHaveLength(636);
  expect(all.find(r=>r.table==='early').measures.accepted.value).toBe(90);expect((await read(0,saved.report_id)).report.id).toBe(saved.report_id);
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;await fail(()=>call(),'Admin access required');expect((await read()).rows).toHaveLength(100);
  await tx.unsafe('set local role anon');expect((await read()).rows).toHaveLength(100);await fail(()=>call(),'permission denied');
  await tx.unsafe('reset role');await tx`update public.elections set visibility='private' where id=${election}`;
  await tx.unsafe('set local role anon');expect((await read()).status).toBe('missing');
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await db.close();}
},30000);

test.skipIf(!url||!process.env.TURNOUT_PREPARED_JSON)('saved source bundle: exact 159/159/318 rows and source times validate locally',async()=>{
 const db=new SQL(url!);const rollback=new Error('rollback');
 try{await db.begin(async tx=>{
  if(!(await tx`select to_regclass('public.structured_turnout_reports') t`)[0].t) await tx.unsafe(await Bun.file('supabase/migrations/20261124010900_structured_turnout.sql').text());
  const admin=crypto.randomUUID(),election=crypto.randomUUID();
  await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;
  await tx`insert into public.admins(user_id) values (${admin})`;
  await tx`insert into public.elections(id,slug,name,election_date) values (${election},${`qa-${election}`},'Synthetic identity for saved source validation','2026-11-03')`;
  const data=await Bun.file(process.env.TURNOUT_PREPARED_JSON!).json();data.election_id=election;
  const document=JSON.stringify(data),sha=new Bun.CryptoHasher('sha256').update(document).digest('hex');
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const result=(await tx`select public.import_structured_turnout(${document},${sha},null,false) r`)[0].r;expect(result.row_count).toBe(636);
  const rows:any[]=[];for(let offset=0;offset<636;offset+=100)rows.push(...(await tx`select public.get_structured_turnout(${election},${result.report_id},${offset},100) r`)[0].r.rows);
  expect(rows.filter(r=>r.table==='early')).toHaveLength(159);expect(rows.filter(r=>r.table==='absentee')).toHaveLength(159);expect(rows.filter(r=>r.table==='turnout')).toHaveLength(318);
  expect(rows.find(r=>r.table==='early'&&r.county_fips==='13021').measures.accepted.value).toBe(22851);
  expect(rows.filter(r=>r.table==='turnout').every(r=>r.as_of===null)).toBe(true);
  expect(rows.find(r=>r.table==='absentee').as_of).toBe('2026-10-26T18:34:58-04:00');
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await db.close();}
});

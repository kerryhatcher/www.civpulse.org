import {expect,test} from 'bun:test';
import {SQL} from 'bun';
const url=process.env.ELECTION_RESULTS_TEST_DATABASE_URL;
test.skipIf(!url)('SOS staged snapshots: atomic publication, resume, history and visibility',async()=>{
 const db=new SQL(url!),rollback=Error('rollback');
 try{await db.begin(async tx=>{
  if (!(await tx`select to_regclass('public.sos_result_snapshots') t`)[0].t)
   await tx.unsafe(await Bun.file('supabase/migrations/20261125000400_sos_results_feeds.sql').text());
  const admin=crypto.randomUUID(),id=crypto.randomUUID();
  await tx`insert into auth.users(id,email) values(${admin},${`${admin}@example.test`})`;
  await tx`insert into public.admins(user_id) values(${admin})`;
  const source='https://results.sos.ga.gov/cdn/results/Georgia/export-Example.json';
  await tx`insert into public.elections(id,slug,name,election_date,results_json_url) values(${id},${id},'Synthetic feed','2026-02-17',${source})`;
  const header={electionDate:'2026-02-17',electionName:'Synthetic',createdAt:'2026-02-25T19:20:28Z'};
  const manifest=[{id:'ga',name:'Georgia',reportingStatuses:[],item_count:1}];
  const items=[{jurisdiction_index:0,item_index:0,data:{id:'race',name:'Race',ballotOptions:[{voteCount:0}]}}];
  const begin=async(hash='a'.repeat(64),h:any=header)=>(await tx`select public.begin_sos_results(${id},${source},${hash},${JSON.stringify(h)}::text::jsonb,${JSON.stringify(manifest)}::text::jsonb) r`)[0].r;
  const stage=async(s:string,data:any=items)=>tx`select public.stage_sos_results(${s},${JSON.stringify(data)}::text::jsonb)`;
  const publish=async(s:string,previous:string|null=null)=>(await tx`select public.publish_sos_results(${s},${previous}::uuid) r`)[0].r;
  const read=async(s:string|null=null)=>(await tx`select public.get_sos_results(${id},${s}::uuid,0,0,10) r`)[0].r;
  const fail=async(fn:()=>Promise<unknown>,message:string)=>{await tx.unsafe('savepoint bad');let caught=false;try{await fn();}catch(e){caught=true;expect(String(e)).toContain(message);}finally{await tx.unsafe('rollback to savepoint bad');}expect(caught).toBe(true);};
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  await fail(()=>begin('b'.repeat(64),{...header,electionDate:'2026-11-03'}),'identity');
  const first=await begin();expect(await begin()).toBe(first);expect((await read()).status).toBe('empty');
  await fail(()=>publish(first),'Incomplete');await stage(first);await stage(first);
  await fail(()=>stage(first,[{...items[0],data:{...items[0].data,name:'Changed'}}]),'conflict');
  expect(await publish(first)).toBe(first);expect(await publish(first)).toBe(first);
  await fail(()=>stage(first),'not staging');
  const second=await begin('c'.repeat(64),{...header,createdAt:'2026-02-26T00:00:00Z'});await stage(second);
  await fail(()=>publish(second),'Current snapshot changed');expect(await publish(second,first)).toBe(second);
  const older=await begin('d'.repeat(64));await stage(older);await fail(()=>publish(older,second),'Stale');
  expect((await read()).supersedes).toBe(first);expect((await read(first)).snapshot_id).toBe(first);
  await fail(()=>tx`delete from public.sos_result_items`,'permission denied');
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;await fail(()=>begin(),'Admin access required');
  await tx.unsafe('set local role anon');expect((await read()).items[0].data.ballotOptions[0].voteCount).toBe(0);await fail(()=>begin(),'permission denied');
  await tx.unsafe('reset role');await tx`update public.elections set visibility='unlisted' where id=${id}`;
  await tx.unsafe('set local role anon');expect((await read()).status).toBe('ok');
  await tx.unsafe('reset role');await tx`update public.elections set visibility='private' where id=${id}`;
  await tx.unsafe('set local role anon');expect((await read()).status).toBe('missing');
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  expect((await read()).status).toBe('ok');
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await db.close();}
},30000);

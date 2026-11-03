import { expect, test } from 'bun:test';
import { SQL } from 'bun';
const url=process.env.ELECTION_RESULTS_TEST_DATABASE_URL;
test.skipIf(!url)('fresh GET authorization uses database window, role and lease; archive/pointer drain after STOP',async()=>{
 const origin=new URL(url!);if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw Error('Isolated local database required');
 const db=new SQL(url!),rollback=Error('rollback');
 try{await db.begin(async tx=>{
  if(!(await tx`select to_regprocedure('public.authorize_sos_results_download(uuid,uuid)') r`)[0].r)await tx.unsafe(await Bun.file('supabase/migrations/20261125003800_sos_download_stop.sql').text());
  await tx`update public.sos_automation_feeds set enabled=false`;
  const election=crypto.randomUUID(),source='https://results.sos.ga.gov/cdn/results/Georgia/export-StopFixture.json';
  await tx`insert into public.elections(id,slug,name,election_date,results_json_url) values(${election},${election},'Stop fixture','2026-11-03',${source})`;
  await tx`insert into public.sos_automation_feeds(election_id,source_url,enabled,starts_at,ends_at) values(${election},${source},true,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '2 hours')`;
  const job=(await tx`insert into public.sos_automation_jobs(election_id) values(${election}) returning id`)[0].id;
  const fails=async(fn:()=>Promise<unknown>,message:string)=>{await tx.unsafe('savepoint stop_error');try{await fn();throw Error('Expected failure');}catch(error){expect(String(error)).toContain(message);}finally{await tx.unsafe('rollback to savepoint stop_error');}};
  // Deterministic exact boundaries for the predicate used by claim and preflight.
  for(const [at,open] of [['2026-11-03T09:59:59.999999Z',false],['2026-11-03T10:00:00Z',true],['2026-11-03T10:59:59.999999Z',true],['2026-11-03T11:00:00Z',false]] as const){expect((await tx`select frontend_private.sos_download_window_open('2026-11-03T10:00:00Z','2026-11-03T11:00:00Z',${at}::timestamptz) r`)[0].r).toBe(open);}
  expect((await tx`select public.claim_sos_results_job() r`)[0].r).toBeNull();
  await tx`update public.sos_automation_feeds set starts_at=clock_timestamp()-interval '1 hour',ends_at=clock_timestamp()-interval '1 second' where election_id=${election}`;
  expect((await tx`select public.claim_sos_results_job() r`)[0].r).toBeNull();
  await tx`update public.sos_automation_feeds set ends_at=clock_timestamp()+interval '1 hour' where election_id=${election}`;
  await tx.unsafe('set local role service_role');
  const claimed=(await tx`select public.claim_sos_results_job() r`)[0].r;
  expect(claimed.job_id).toBe(job);
  const authorize=()=>tx`select public.authorize_sos_results_download(${job},${claimed.lease_id}) r`;
  const authorized=(await authorize())[0].r;
  expect(authorized.schema_version).toBe(1);expect(authorized.job_id).toBe(job);expect(authorized.election_id).toBe(election);expect(authorized.source_url).toBe(source);expect(Date.parse(authorized.ends_at)).toBeGreaterThan(Date.parse(authorized.server_now));
  for(const role of ['anon','authenticated']){await tx.unsafe('set local role '+role);await fails(authorize,'permission denied');await fails(()=>tx`select * from public.sos_automation_jobs`,'permission denied');}
  await tx.unsafe('reset role');
  for(const patch of ["enabled=false","starts_at=clock_timestamp()+interval '30 minutes'","ends_at=clock_timestamp()-interval '1 second'"]){await tx.unsafe('savepoint invalid_feed');await tx.unsafe(`update public.sos_automation_feeds set ${patch} where election_id='${election}'`);await fails(authorize,patch==='enabled=false'?'Feed disabled':'window closed');await tx.unsafe('rollback to savepoint invalid_feed');}
  for(const visibility of ['private','unlisted']){await tx.unsafe('savepoint invalid_visibility');await tx`update public.elections set visibility=${visibility} where id=${election}`;await fails(authorize,'Feed disabled');await tx.unsafe('rollback to savepoint invalid_visibility');}
  await tx.unsafe('savepoint invalid_source');await tx`update public.elections set results_json_url='https://results.sos.ga.gov/cdn/results/Georgia/export-Changed.json' where id=${election}`;await fails(authorize,'Feed disabled');await tx.unsafe('rollback to savepoint invalid_source');
  await fails(()=>tx`select public.authorize_sos_results_download(${job},${crypto.randomUUID()})`,'Expired job lease');
  await tx.unsafe('savepoint expired_lease');await tx`update public.sos_automation_jobs set lease_until=clock_timestamp()-interval '1 second' where id=${job}`;await fails(authorize,'Expired job lease');await tx.unsafe('rollback to savepoint expired_lease');
  // Legacy no-end rows retain their existing bounded-download behavior.
  await tx`update public.sos_automation_feeds set ends_at=null where election_id=${election}`;expect((await authorize())[0].r.ends_at).toBeNull();
  // A valid claim does not authorize a GET after STOP. Failure acknowledgement remains usable.
  await tx`update public.sos_automation_feeds set ends_at=clock_timestamp()-interval '1 second' where election_id=${election}`;await fails(authorize,'window closed');
  await tx`select public.fail_sos_results_job(${job},${claimed.lease_id},'window closed',60)`;
  await tx`update public.sos_automation_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=${job}`;
  expect((await tx`select public.claim_sos_results_job() r`)[0].r).toBeNull();
  // Create the archived job while open, then close before staging/publication.
  await tx`update public.sos_automation_feeds set ends_at=clock_timestamp()+interval '1 hour' where election_id=${election}`;
  const resumed=(await tx`select public.claim_sos_results_job() r`)[0].r;
  const header={electionDate:'2026-11-03',electionName:'Stop fixture',createdAt:'2026-11-03T00:00:00Z'},scopes=[{id:'001',name:'Scope',reportingStatuses:null,item_count:1}],hash='e'.repeat(64),receipt={raw_key:`elections/${election}/raw/${hash}.json`,bytes:100,retrieved_at:'2026-11-03T00:00:00Z'};
  const begun=(await tx`select public.begin_sos_results_job(${job},${resumed.lease_id},${hash},${JSON.stringify(header)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb,${JSON.stringify(receipt)}::text::jsonb) r`)[0].r;
  await tx`update public.sos_automation_feeds set ends_at=clock_timestamp()-interval '1 second' where election_id=${election}`;
  await fails(()=>tx`select public.authorize_sos_results_download(${job},${resumed.lease_id})`,'not valid for this job');
  await tx`update public.sos_automation_jobs set lease_until=clock_timestamp()-interval '1 second' where id=${job}`;
  const archived=(await tx`select public.claim_sos_results_job() r`)[0].r;expect(archived.snapshot_id).toBe(begun.snapshot_id);expect(archived.receipt).toEqual(receipt);
  expect((await tx`select public.renew_sos_results_job(${job},${archived.lease_id}) r`)[0].r).toBe(true);
  const items=[{jurisdiction_index:0,item_index:0,data:{id:'race',name:'Race',ballotOptions:[{id:'choice',name:'Choice',voteCount:0}]}}];
  await tx`select public.stage_sos_results_job(${job},${archived.lease_id},${begun.snapshot_id},${JSON.stringify(items)}::text::jsonb)`;
  const manifest=`elections/${election}/revisions/${begun.snapshot_id}/manifest.json`;
  const revision=(await tx`select public.publish_sos_results_job(${job},${archived.lease_id},${begun.snapshot_id},${'f'.repeat(64)},${manifest}) r`)[0].r;
  await tx`update public.sos_automation_jobs set lease_until=clock_timestamp()-interval '1 second' where id=${job}`;
  const pointer=(await tx`select public.claim_sos_results_job() r`)[0].r;expect(pointer.phase).toBe('pointer');
  expect((await tx`select public.confirm_sos_results_pointer(${job},${pointer.lease_id}) r`)[0].r.revision).toBe(revision);
  await tx`select public.complete_sos_results_pointer(${job},${pointer.lease_id},${revision})`;
  expect((await tx`select state from public.sos_automation_jobs where id=${job}`)[0].state).toBe('done');
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}finally{await db.close();}
},30_000);

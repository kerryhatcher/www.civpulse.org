import { expect, test } from 'bun:test';
import { SQL } from 'bun';
const url = process.env.ELECTION_RESULTS_TEST_DATABASE_URL;

test.skipIf(!url)('SOS automation fences leases and publishes complete snapshots once', async () => {
 const db = new SQL(url!), rollback = Error('rollback');
 try { await db.begin(async tx => {
  if (!(await tx`select to_regclass('public.sos_ballot_links') t`)[0].t) await tx.unsafe(await Bun.file('supabase/migrations/20261125003400_sos_ballot_crosswalk.sql').text());
  const id=crypto.randomUUID(), source='https://results.sos.ga.gov/cdn/results/Georgia/export-Test.json';
  await tx`insert into public.elections(id,slug,name,election_date,results_json_url) values(${id},${id},'Test','2026-11-03',${source})`;
  await tx`insert into public.sos_automation_feeds(election_id,source_url,enabled) values(${id},${source},true)`;
  const [poll]=await tx`select public.claim_sos_results_poll() r`;
  expect(poll.r.election_id).toBe(id);
  await tx`select public.finish_sos_results_poll(${id},${poll.r.lease_id},true,null)`;
  const [claimed]=await tx`select public.claim_sos_results_job() r`; const j=claimed.r;
  expect((await tx`select public.claim_sos_results_job() r`)[0].r).toBeNull();
  const hash='a'.repeat(64), fingerprint='b'.repeat(64);
  const header={electionDate:'2026-11-03',electionName:'Test',createdAt:'2026-11-03T00:00:00Z'};
  const scopes=[{id:'011',name:'Bibb',reportingStatuses:null,item_count:1}];
  const receipt={raw_key:`elections/${id}/raw/${hash}.json`,bytes:100,retrieved_at:'2026-11-03T00:00:00Z'};
  const begin=()=>tx`select public.begin_sos_results_job(${j.job_id},${j.lease_id},${hash},${JSON.stringify(header)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb,${JSON.stringify(receipt)}::text::jsonb) r`;
  const snapshot=(await begin())[0].r.snapshot_id;
  expect((await begin())[0].r.receipt).toEqual(receipt);
  const manifest=`elections/${id}/revisions/${snapshot}/manifest.json`;
  const publish=()=>tx`select public.publish_sos_results_job(${j.job_id},${j.lease_id},${snapshot},${fingerprint},${manifest}) r`;
  const fails=async(fn:()=>Promise<unknown>,message:string)=>{ await tx.unsafe('savepoint test_error'); try { await fn(); throw Error('Expected failure'); } catch (e) { expect(String(e)).toContain(message); } finally { await tx.unsafe('rollback to savepoint test_error'); } };
  await fails(publish,'Incomplete snapshot');
  const items=[{jurisdiction_index:0,item_index:0,data:{id:'1',name:'Race',ballotOptions:[{id:'a',name:'Choice'}]}}];
  await tx`select public.stage_sos_results_job(${j.job_id},${j.lease_id},${snapshot},${JSON.stringify(items)}::text::jsonb)`;
  const before=(await tx`select revision from public.frontend_rebuild_state where id`)[0].revision;
  expect((await publish())[0].r).toBe('1');
  expect(BigInt((await tx`select revision from public.frontend_rebuild_state where id`)[0].revision)).toBe(BigInt(before)+1n);
  expect((await tx`select public.confirm_sos_results_pointer(${j.job_id},${j.lease_id}) r`)[0].r.revision).toBe('1');
  await tx`select public.complete_sos_results_pointer(${j.job_id},${j.lease_id},'1')`;
  await fails(()=>tx`select public.renew_sos_results_job(${j.job_id},${j.lease_id})`,'Expired job lease');
  // A later receipt with identical semantic results advances history but not rebuild revision.
  await tx`insert into public.sos_automation_jobs(election_id) values(${id})`;
  const [secondClaim]=await tx`select public.claim_sos_results_job() r`; const k=secondClaim.r;
  const hash2='c'.repeat(64), header2={...header};
  const receipt2={...receipt,raw_key:`elections/${id}/raw/${hash2}.json`};
  const [second]=await tx`select public.begin_sos_results_job(${k.job_id},${k.lease_id},${hash2},${JSON.stringify(header2)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb,${JSON.stringify(receipt2)}::text::jsonb) r`;
  await tx`select public.stage_sos_results_job(${k.job_id},${k.lease_id},${second.r.snapshot_id},${JSON.stringify(items)}::text::jsonb)`;
  const buildRevision=(await tx`select revision from public.frontend_rebuild_state where id`)[0].revision;
  const nextPath=`elections/${id}/revisions/${second.r.snapshot_id}/manifest.json`;
  expect((await tx`select public.publish_sos_results_job(${k.job_id},${k.lease_id},${second.r.snapshot_id},${fingerprint},${nextPath}) r`)[0].r).toBe('2');
  expect((await tx`select revision from public.frontend_rebuild_state where id`)[0].revision).toBe(buildRevision);
  await tx`update public.sos_automation_jobs set lease_until=clock_timestamp()-interval '1 second' where id=${k.job_id}`;
  await fails(()=>tx`select public.complete_sos_results_pointer(${k.job_id},${k.lease_id},'2')`,'Expired job lease');
  await tx.unsafe('set local role service_role');
  const [reclaimed]=await tx`select public.claim_sos_results_job() r`;
  expect(reclaimed.r.lease_id).not.toBe(k.lease_id);
  await fails(()=>tx`select public.confirm_sos_results_pointer(${k.job_id},${k.lease_id})`,'Expired job lease');
  await tx`select public.complete_sos_results_pointer(${k.job_id},${reclaimed.r.lease_id},'2')`;
  await tx.unsafe('reset role');
  // Equal timestamps with changed results, and any older timestamp, remain conflicts.
  const conflicting=async(createdAt:string,fp:string)=>{
   await tx.unsafe('savepoint source_conflict');
   try {
    await tx`insert into public.sos_automation_jobs(election_id) values(${id})`;
    const [q]=await tx`select public.claim_sos_results_job() r`; const job=q.r;
    const sha='d'.repeat(64), hdr={...header,createdAt}, rcpt={...receipt,raw_key:`elections/${id}/raw/${sha}.json`};
    const [b]=await tx`select public.begin_sos_results_job(${job.job_id},${job.lease_id},${sha},${JSON.stringify(hdr)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb,${JSON.stringify(rcpt)}::text::jsonb) r`;
    await tx`select public.stage_sos_results_job(${job.job_id},${job.lease_id},${b.r.snapshot_id},${JSON.stringify(items)}::text::jsonb)`;
    const path=`elections/${id}/revisions/${b.r.snapshot_id}/manifest.json`;
    await tx`select public.publish_sos_results_job(${job.job_id},${job.lease_id},${b.r.snapshot_id},${fp},${path})`;
    throw Error('Expected source conflict');
   }catch(e){expect(String(e)).toContain('Stale or conflicting source timestamp');}
   finally{await tx.unsafe('rollback to savepoint source_conflict');}
  };
  await conflicting(header.createdAt,'e'.repeat(64));
  await conflicting('2026-11-02T23:59:59Z',fingerprint);
  const admin=crypto.randomUUID(); await tx`insert into auth.users(id,email) values(${admin},${admin+'@example.test'})`;
  await tx`insert into public.admins(user_id) values(${admin})`;
  await tx.unsafe('set local role authenticated');
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
  await fails(()=>tx`select public.configure_sos_results_feed(${id},false)`,'Admin access required');
  await fails(()=>tx`select public.recover_sos_results_job(${id},'retry')`,'Admin access required');
  await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  expect((await tx`select public.configure_sos_results_feed(${id},false) r`)[0].r.enabled).toBe(false);
  await tx.unsafe('reset role');
  await tx`update public.elections set visibility='unlisted' where id=${id}`;
  await tx.unsafe('set local role anon');
  expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('missing');
  await tx.unsafe('reset role');
  await tx`update public.elections set visibility='private' where id=${id}`;
  await tx.unsafe('set local role authenticated');
  expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.status).toBe('missing');
  await tx.unsafe('reset role');
  await tx`update public.elections set visibility='public' where id=${id}`;
  await tx.unsafe('set local role anon');
  expect((await tx`select public.get_sos_results_health(${id}) r`)[0].r.current_revision).toBe('2');
  await fails(()=>tx`select public.claim_sos_results_job()`,'permission denied');
  throw rollback;
 }); } catch (e) { if(e!==rollback) throw e; } finally { await db.close(); }
}, 30000);

test.skipIf(!url)('automation adopts a previously admin-published snapshot', async () => {
 const db=new SQL(url!), rollback=Error('rollback');
 try { await db.begin(async tx=>{
  await tx.unsafe(await Bun.file('supabase/migrations/20261125003300_sos_results_manual_publication_guard.sql').text());
  const id=crypto.randomUUID(), admin=crypto.randomUUID(),source='https://results.sos.ga.gov/cdn/results/Georgia/export-Adoption.json';
  await tx`insert into auth.users(id,email) values(${admin},${admin+'@example.test'})`;
  await tx`insert into public.admins(user_id) values(${admin})`;
  await tx`insert into public.elections(id,slug,name,election_date,results_json_url) values(${id},${id},'Adoption','2026-11-03',${source})`;
  const hash='d'.repeat(64), header={electionDate:'2026-11-03',electionName:'Adoption',createdAt:'2026-11-03T00:00:00Z'};
  const scopes=[{id:'011',name:'Bibb',reportingStatuses:null,item_count:1}];
  const items=[{jurisdiction_index:0,item_index:0,data:{id:'1',name:'Race',ballotOptions:[{id:'a',name:'Choice'}]}}];
  await tx.unsafe('set local role authenticated'); await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const [manual]=await tx`select public.begin_sos_results(${id},${source},${hash},${JSON.stringify(header)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb) r`;
  await tx`select public.stage_sos_results(${manual.r},${JSON.stringify(items)}::text::jsonb)`;
  await tx`select public.publish_sos_results(${manual.r},null)`;
  await tx`select public.configure_sos_results_feed(${id},true)`;
  const enabledHeader={...header,createdAt:'2026-11-03T00:00:01Z'};
  const [enabledSnapshot]=await tx`select public.begin_sos_results(${id},${source},${'f'.repeat(64)},${JSON.stringify(enabledHeader)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb) r`;
  await tx`select public.stage_sos_results(${enabledSnapshot.r},${JSON.stringify(items)}::text::jsonb)`;
  await tx.unsafe('savepoint before_adoption');
  try { await tx`select public.publish_sos_results(${enabledSnapshot.r},${manual.r})`; throw Error('Expected guard rejection'); }
  catch(e){expect(String(e)).toContain('Use the automated collector');}
  finally{await tx.unsafe('rollback to savepoint before_adoption');}
  await tx.unsafe('reset role'); await tx`insert into public.sos_automation_jobs(election_id) values(${id})`;
  await tx.unsafe('set local role service_role'); const [claim]=await tx`select public.claim_sos_results_job() r`; const j=claim.r;
  const receipt={raw_key:`elections/${id}/raw/${hash}.json`,bytes:100,retrieved_at:'2026-11-03T00:00:00Z'};
  const [begin]=await tx`select public.begin_sos_results_job(${j.job_id},${j.lease_id},${hash},${JSON.stringify(header)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb,${JSON.stringify(receipt)}::text::jsonb) r`;
  expect(begin.r.snapshot_id).toBe(manual.r); expect(begin.r.published).toBe(false);
  await tx`select public.stage_sos_results_job(${j.job_id},${j.lease_id},${manual.r},${JSON.stringify(items)}::text::jsonb)`;
  const path=`elections/${id}/revisions/${manual.r}/manifest.json`;
  expect((await tx`select public.publish_sos_results_job(${j.job_id},${j.lease_id},${manual.r},${'e'.repeat(64)},${path}) r`)[0].r).toBe('1');
  expect((await tx`select public.confirm_sos_results_pointer(${j.job_id},${j.lease_id}) r`)[0].r.snapshot_id).toBe(manual.r);
  await tx.unsafe('set local role authenticated');
  // Replaying a snapshot already published remains idempotent after adoption.
  expect((await tx`select public.publish_sos_results(${manual.r},null) r`)[0].r).toBe(manual.r);
  const nextHeader={...header,createdAt:'2026-11-03T00:00:01Z'};
  const [next]=await tx`select public.begin_sos_results(${id},${source},${'f'.repeat(64)},${JSON.stringify(nextHeader)}::text::jsonb,${JSON.stringify(scopes)}::text::jsonb) r`;
  await tx`select public.stage_sos_results(${next.r},${JSON.stringify(items)}::text::jsonb)`;
  const rejectManual=async()=>{
   await tx.unsafe('savepoint guarded_publish');
   try { await tx`select public.publish_sos_results(${next.r},${manual.r})`; throw Error('Expected guard rejection'); }
   catch(e){expect(String(e)).toContain('Use the automated collector');}
   finally{await tx.unsafe('rollback to savepoint guarded_publish');}
  };
  await rejectManual();
  await tx`select public.configure_sos_results_feed(${id},false)`;
  await rejectManual();
  expect((await tx`select public.publish_sos_results(${manual.r},null) r`)[0].r).toBe(manual.r);
  await tx.unsafe('reset role');
  expect((await tx`select published_at from public.sos_result_snapshots where id=${next.r}`)[0].published_at).toBeNull();
  throw rollback;
 }); } catch(e){if(e!==rollback)throw e;}finally{await db.close();}
},30000);

test.skipIf(!url)('reviewed SOS ballot mappings validate targets and respect visibility', async () => {
 const db=new SQL(url!), rollback=Error('rollback');
 try { await db.begin(async tx=>{
  if (!(await tx`select to_regclass('public.sos_ballot_links') t`)[0].t) await tx.unsafe(await Bun.file('supabase/migrations/20261125003400_sos_ballot_crosswalk.sql').text());
  const id=crypto.randomUUID(),other=crypto.randomUUID(),contest=crypto.randomUUID(),question=crypto.randomUUID(),admin=crypto.randomUUID(),pub=crypto.randomUUID(),hidden=crypto.randomUUID(),outside=crypto.randomUUID();
  await tx`insert into auth.users(id,email) values(${admin},${admin+'@example.test'})`;
  await tx`insert into public.admins(user_id) values(${admin})`;
  await tx`insert into public.elections(id,slug,name,election_date) values(${id},${id},'Mapped','2026-11-03'),(${other},${other},'Other','2026-11-03')`;
  await tx`insert into public.contests(id,election_id,office) values(${contest},${id},'Office')`;
  await tx`insert into public.ballot_questions(id,election_id,title,question_text) values(${question},${id},'Question','Question?')`;
  await tx`insert into public.people(id,slug,full_name,visibility) values(${pub},${pub},'Public','public'),(${hidden},${hidden},'Private','private'),(${outside},${outside},'Other','public')`;
  await tx`insert into public.contest_candidates(contest_id,person_id) values(${contest},${pub}),(${contest},${hidden})`;
  await tx.unsafe('set local role authenticated'); await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const good=[{source_choice_id:'1',person_id:pub},{source_choice_id:'2',person_id:hidden}];
  const put=(e:string,c:string|null,q:string|null,choices:unknown[])=>tx`select public.put_sos_results_mapping(${e},'011','race',${c}::uuid,${q}::uuid,${JSON.stringify(choices)}::text::jsonb)`;
  const fails=async(fn:()=>Promise<unknown>,message:string)=>{await tx.unsafe('savepoint invalid_mapping');try{await fn();throw Error('Expected rejection');}catch(e){expect(String(e)).toContain(message);}finally{await tx.unsafe('rollback to savepoint invalid_mapping');}};
  await fails(()=>put(other,contest,null,good),'Contest belongs to another election');
  await fails(()=>put(id,contest,null,[{source_choice_id:'1',person_id:outside}]),'Candidate not in contest');
  await fails(()=>put(id,contest,null,[good[0],good[0]]),'duplicate source choice');
  await put(id,contest,null,good);
  await tx`select public.put_sos_results_mapping(${id},'011','question',null,${question},${JSON.stringify([{source_choice_id:'yes',choice_label:'Yes'}])}::text::jsonb)`;
  await fails(()=>tx`select public.put_sos_results_mapping(${id},'011','question',null,${question},${JSON.stringify([{source_choice_id:'maybe',choice_label:'Maybe'}])}::text::jsonb)`,'Invalid question choice');
  expect((await tx`select public.get_sos_results_mappings(${id}) r`)[0].r.mappings.find((m:any)=>m.source_contest_id==='race').choices).toHaveLength(2);
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
  await fails(()=>put(id,contest,null,good),'Admin access required');
  expect((await tx`select public.get_sos_results_mappings(${id}) r`)[0].r.mappings.find((m:any)=>m.source_contest_id==='race').choices).toEqual([good[0]]);
  await tx.unsafe('set local role anon');
  expect((await tx`select public.get_sos_results_mappings(${id}) r`)[0].r.mappings.find((m:any)=>m.source_contest_id==='race').choices).toEqual([good[0]]);
  await fails(()=>tx`select * from public.sos_ballot_links`,'permission denied');
  await tx.unsafe('reset role'); await tx`update public.elections set visibility='private' where id=${id}`;
  await tx.unsafe('set local role anon'); expect((await tx`select public.get_sos_results_mappings(${id}) r`)[0].r.status).toBe('missing');
  await tx.unsafe('set local role authenticated'); await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  expect((await tx`select public.get_sos_results_mappings(${id}) r`)[0].r.status).toBe('ok');
  throw rollback;
 }); }catch(e){if(e!==rollback)throw e;}finally{await db.close();}
},30000);

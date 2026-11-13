import {expect,test} from 'bun:test';
import {SQL} from 'bun';
const url=process.env.ELECTION_RESULTS_TEST_DATABASE_URL;
test.skipIf(!url)('results: OCR validation, semantic dedup, cumulative revision, future turnout and visibility',async()=>{
 const sql=new SQL(url!);const rollback=new Error('rollback');
 try{await sql.begin(async tx=>{
  if(!(await tx`select to_regclass('public.election_result_reports') t`)[0].t)
   await tx.unsafe(await Bun.file('supabase/migrations/20261124010000_election_results.sql').text());
  const admin=crypto.randomUUID(),election=crypto.randomUUID(),contest=crypto.randomUUID(),person=crypto.randomUUID();
  await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;
  await tx`insert into public.admins(user_id) values (${admin})`;
  await tx`insert into public.elections(id,slug,name,election_date,visibility) values (${election},${`qa-${election}`},'Results QA','2026-04-14','public')`;
  await tx`insert into public.contests(id,election_id,office) values (${contest},${election},'Commissioner')`;
  await tx`insert into public.people(id,slug,full_name) values (${person},${`qa-${person}`},'QA Candidate')`;
  await tx`insert into public.contest_candidates(contest_id,person_id) values (${contest},${person})`;
  const path='a'.repeat(64)+'.jpg';
  await tx`insert into storage.objects(bucket_id,name) values ('election-evidence',${path})`;
  const scope={county:'Bibb',unit_type:'county',unit:'all',counting_group:'all',ballot_style:'all'};
  const snapshot={election_date:'2026-04-14',status:'unofficial',turnout:{ballots:300,voters:300,registered:17944,precincts_reported:6,precincts_total:31},contests:[{contest_id:contest,choices:[{person_id:person,label:'QA Candidate',votes:300}],total_votes:300,ballots:300,registered:10298,precincts_reported:6,precincts_total:6}]};
  const sources=[{path,locator:'Photo 8, page 1',transcription:'April 14, 2026; 300 ballots'}];
  const call=async(s:any=snapshot, time='2026-04-14T19:27:28-04:00',expected:string|null=null,dry=true,sc:any=scope,src:any=sources)=>
   (await tx`select public.import_election_result(${election},${sc}::jsonb,${time}::timestamptz,${s}::jsonb,${src}::jsonb,${expected}::uuid,${dry}) r`)[0].r;
  const denied=async(fn:()=>Promise<unknown>,message:string)=>{
   await tx.unsafe('savepoint invalid');let caught=false;
   try{await fn();}catch(e){caught=true;expect(String(e)).toContain(message);}
   finally{await tx.unsafe('rollback to savepoint invalid');}expect(caught).toBe(true);
  };
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  expect((await call()).status).toBe('validated');
  expect((await tx`select count(*)::int n from public.election_result_reports where election_id=${election}`)[0].n).toBe(0);
  const saved=await call(snapshot,undefined,null,false);expect(saved.status).toBe('saved');
  expect((await call(snapshot,undefined,null,false,scope,[{...sources[0],locator:'Photo 9, same paper'}])).report_id).toBe(saved.report_id);
  const changed=structuredClone(snapshot);changed.turnout.ballots=301;
  await denied(()=>call(changed),'Conflicting transcription');
  await denied(()=>call(changed,'2026-04-14T20:00:00-04:00'),'Report changed');
  const revision=await call(changed,'2026-04-14T20:00:00-04:00',saved.report_id,false);
  expect(revision.supersedes).toBe(saved.report_id);
  expect((await call(snapshot,undefined,null,false)).status).toBe('duplicate');
  await denied(()=>call(snapshot,'2026-04-14T18:00:00-04:00',revision.report_id),'Older reports');
  const invalid=structuredClone(changed);invalid.contests[0].choices[0].votes=299;
  await denied(()=>call(invalid,'2026-04-14T21:00:00-04:00',revision.report_id),'Choice sum');
  const wrong=structuredClone(changed);wrong.election_date='2026-05-19';
  await denied(()=>call(wrong),'Printed election date');
  await denied(()=>call({...changed,turnout:{ballots:-1}}),'Counts must');
  await denied(()=>call({...changed,turnout:{ballots:'300'}}),'Counts must');
  await denied(()=>call({...changed,turnout:{precincts_reported:32,precincts_total:31}}),'Reporting exceeds');
  await denied(()=>call({...changed,contests:[...changed.contests,...changed.contests]}),'Duplicate contest');
  const other=structuredClone(changed);other.contests[0].choices[0].person_id=crypto.randomUUID();
  await denied(()=>call(other),'Candidate not in contest');
  await denied(()=>call(changed,undefined,null,true,scope,[{...sources[0],path:'b'.repeat(64)+'.jpg'}]),'Upload original');
  await denied(()=>tx`delete from public.election_result_reports where id=${saved.report_id}`,'permission denied');
  const read=async(history=false)=>(await tx`select public.get_election_results(${election},${history}) r`)[0].r;
  expect((await read()).reports).toHaveLength(1);expect((await read(true)).reports).toHaveLength(2);
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
  await denied(()=>call(),'Admin access required');expect((await read()).reports[0].sources).toBeNull();
  expect(await tx`select * from public.election_result_reports where election_id=${election}`).toHaveLength(0);
  await tx.unsafe('set local role anon');expect((await read()).reports[0].snapshot.turnout.ballots).toBe(301);
  await denied(()=>tx`select * from public.election_result_reports`,'permission denied');
  await tx.unsafe('reset role');await tx`update public.elections set visibility='private' where id=${election}`;
  await tx.unsafe('set local role anon');expect((await read()).status).toBe('missing');
  await tx.unsafe('set local role authenticated');expect((await read()).status).toBe('missing');
  await tx`select set_config('request.jwt.claim.sub',${admin},true)`;expect((await read()).status).toBe('ok');
  await tx.unsafe('reset role');await tx`update public.elections set visibility='unlisted' where id=${election}`;
  await tx.unsafe('set local role anon');expect((await read()).status).toBe('ok');
  await tx.unsafe('reset role');await tx`update public.elections set election_date=current_date+30 where id=${election}`;
  const future=(await tx`select (current_date+30)::text date`)[0].date;
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  await denied(()=>call({...snapshot,election_date:future}),'Cannot publish vote results');
  expect((await call({...snapshot,election_date:future,contests:[]},'2026-04-14T21:00:00-04:00',revision.report_id)).status).toBe('validated');
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
},30000);

import {expect,test} from 'bun:test';
import {SQL} from 'bun';
import {fixture} from './fixtures/structured-turnout';
import {parseStructuredTurnout} from '../../apps/mcp/src/structured-turnout';

function electionDayFixture(election=crypto.randomUUID()) {
 const data=fixture(election);
 const turnout=data.tables.find(t=>t.table==='turnout')!;
 turnout.rows.push(...turnout.rows.filter(r=>r.ballot_style==='Early In-Person').map(r=>({...r,
  ballot_style:'Election Day In-Person',counting_group:'election_day',
  locator:`QDFdpV: County=${r.county_label}; Ballot Style=Election Day In-Person`,
  measures:{turnout:{value:0,display:'0'}},
 })));
 return data;
}

test('Election Day source rows parse alongside existing views, including explicit zero and unavailable values',()=>{
 const data=electionDayFixture();
 data.tables[2].rows.at(-1)!.measures.turnout={value:null as any,display:'Unavailable'};
 const parsed=parseStructuredTurnout(JSON.stringify(data));
 expect(parsed.tables.flatMap(t=>t.rows)).toHaveLength(795);
 const rows=parsed.tables[2].rows.filter(r=>r.counting_group==='election_day');
 expect(rows).toHaveLength(159);expect(rows[0].measures.turnout.value).toBe(0);
 expect(rows.at(-1)!.measures.turnout.value).toBeNull();
 expect(parseStructuredTurnout(JSON.stringify(fixture(crypto.randomUUID()))).tables[2].rows).toHaveLength(318);
});

test('Election Day parser rejects wrong styles, groups, tables, measures and row overflow',()=>{
 for(const mutate of [
  (d:any)=>d.tables[2].rows.at(-1).ballot_style='Election Day',
  (d:any)=>d.tables[2].rows.at(-1).counting_group='advance',
  (d:any)=>d.tables[0].rows.push(d.tables[2].rows.at(-1)),
  (d:any)=>d.tables[1].rows.push(d.tables[2].rows.at(-1)),
  (d:any)=>d.tables[2].rows.at(-1).measures={accepted:{value:1,display:'1'}},
  (d:any)=>d.tables[2].rows.at(-1).measures.turnout.value=0.5,
  (d:any)=>d.tables[2].rows.push(d.tables[2].rows.at(-1)),
 ]){const data=electionDayFixture();mutate(data);expect(()=>parseStructuredTurnout(JSON.stringify(data))).toThrow();}
});

const url=process.env.ELECTION_RESULTS_TEST_DATABASE_URL;
test('source preparation preserves reported Election Day cells and provenance',async()=>{
 const data=electionDayFixture();data.tables[2].rows.at(-1)!.measures.turnout={value:null as any,display:'Unavailable'};
 const mapping=[{name:'early-voting-by-county',measures:{accepted:'Ballots Accepted'}},
  {name:'absentee-by-county',measures:{requested:'Ballots Requested',issued:'Ballots Issued',returned:'Ballots Returned',accepted:'Ballots Accepted',rejected:'Ballots Rejected',spoiled_canceled:'Other (Spoiled & Canceled)',outstanding:'Ballots Outstanding',acceptance_ratio:'% Accepted of Returned'}},
  {name:'turnout-by-county-and-ballot-style',measures:{turnout:'Turnout'}}];
 const bundle={...data,snapshot_sha256:data.upstream_sha256,tables:data.tables.map((table,index)=>({
  schema_version:1,source_id:data.provider,election_date:data.election_date,source_url:data.source_url,unofficial:true,
  data:{table:mapping[index].name,object_id:table.object_id,source_title:table.source_title,source_as_of:'',
   measures:Object.values(mapping[index].measures),dimensions:index===2?['County','Ballot Style']:['County'],
   rows:table.rows.map(row=>({dimensions:{County:row.county_label,...(index===2?{'Ballot Style':row.ballot_style}:{})},
    measures:Object.fromEntries(Object.entries(row.measures).map(([key,value])=>[(mapping[index].measures as Record<string,string>)[key],value]))}))}}))};
 const input=`/tmp/election-day-source-${crypto.randomUUID()}.json`,output=`${input}.prepared`;
 try{
  await Bun.write(input,JSON.stringify(bundle));
  const child=Bun.spawn(['bun','run','scripts/prepare-georgia-turnout.ts',input,output],{stdout:'pipe',stderr:'pipe'});
  const [code,stderr]=await Promise.all([child.exited,new Response(child.stderr).text()]);
  expect(stderr).toBe('');expect(code).toBe(0);
  const prepared=parseStructuredTurnout(await Bun.file(output).text());
  expect(prepared.upstream_sha256).toBe(data.upstream_sha256);
  expect(prepared.tables[2].object_id).toBe('QDFdpV');expect(prepared.tables[2].as_of).toBeNull();
  const rows=prepared.tables[2].rows.filter(r=>r.counting_group==='election_day');
  expect(rows).toHaveLength(159);expect(rows[0].measures.turnout).toEqual({value:0,display:'0'});
  expect(rows.at(-1)!.measures.turnout).toEqual({value:null,display:'Unavailable'});
  expect(rows[0].locator).toContain('Ballot Style=Election Day In-Person');
 }finally{await Bun.file(input).delete();if(await Bun.file(output).exists())await Bun.file(output).delete();}
});

test.skipIf(!url)('Election Day DB acceptance preserves evidence, revisions, pagination and visibility (rollback only)',async()=>{
 const endpoint=new URL(url!);
 if(!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||endpoint.port!=='54342')throw new Error('Only isolated loopback DB 54342 allowed');
 const db=new SQL(url!);const rollback=new Error('rollback');
 try{await db.begin(async tx=>{
  // Apply this append-only function replacement transactionally; rollback restores the old function too.
  await tx.unsafe(await Bun.file('supabase/migrations/20261125003700_structured_turnout_election_day.sql').text());
  const admin=crypto.randomUUID(),election=crypto.randomUUID();
  await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;
  await tx`insert into public.admins(user_id) values (${admin})`;
  await tx`insert into public.elections(id,slug,name,election_date,visibility) values (${election},${`qa-${election}`},'Synthetic Election Day turnout','2026-11-03','public')`;
  const call=async(data:any,previous:string|null=null,dry=true,sha?:string)=>{const text=JSON.stringify(data);return (await tx`select public.import_structured_turnout(${text},${sha??new Bun.CryptoHasher('sha256').update(text).digest('hex')},${previous}::uuid,${dry}) r`)[0].r;};
  const fail=async(fn:()=>Promise<unknown>,message:string)=>{await tx.unsafe('savepoint bad');let caught=false;try{await fn();}catch(e){caught=true;expect(String(e)).toContain(message);}finally{await tx.unsafe('rollback to savepoint bad');}expect(caught).toBe(true);};
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const original=await call(fixture(election),null,false);
  const data=electionDayFixture(election);data.captured_at='2026-10-27T00:19:37Z';
  data.tables[2].rows.at(-1)!.measures.turnout={value:null as any,display:'Unavailable'};
  expect((await call(data,original.report_id)).row_count).toBe(795);
  await fail(()=>call(data,original.report_id,true,'b'.repeat(64)),'checksum');
  await fail(()=>call(data),'Report changed');
  for(const mutate of [
   (d:any)=>d.tables[2].rows.at(-1).counting_group='advance',
   (d:any)=>d.tables[2].rows.at(-1).ballot_style='Election Day',
   (d:any)=>d.tables[0].rows[0]={...d.tables[2].rows.at(-1),measures:{accepted:{value:0,display:'0'}}},
   (d:any)=>d.tables[1].rows[0].ballot_style='Election Day In-Person',
   (d:any)=>d.tables[2].rows.push(d.tables[2].rows.at(-1)),
   (d:any)=>d.tables[2].rows.at(-1).measures.turnout.value=0.5,
   (d:any)=>d.tables[2].rows.at(-1).measures.turnout.value=-1,
   (d:any)=>d.tables[2].object_id='unreviewed-object',
  ]){const bad=structuredClone(data);mutate(bad);await fail(()=>call(bad,original.report_id),'');}
  const saved=await call(data,original.report_id,false);expect(saved.row_count).toBe(795);
  expect((await call(data,null,false)).report_id).toBe(saved.report_id);
  const stale=structuredClone(data);stale.captured_at='2026-10-27T00:18:37Z';stale.tables[2].rows.at(-1)!.measures.turnout.value=1;
  await fail(()=>call(stale,saved.report_id),'Stale capture');
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
  await tx.unsafe('set local role anon');
  const rows:any[]=[];for(let offset=0;offset<795;offset+=100){const page=(await tx`select public.get_structured_turnout(${election},null,${offset},100) r`)[0].r;expect(page.total).toBe(795);rows.push(...page.rows);}
  expect(rows.filter(r=>r.counting_group==='election_day')).toHaveLength(159);
  expect(rows.filter(r=>r.counting_group==='election_day'&&r.measures.turnout.value===null)).toHaveLength(1);
  expect((await tx`select public.get_structured_turnout(${election},${original.report_id},0,100) r`)[0].r.total).toBe(636);
  await fail(()=>call(data),'permission denied');
  await tx.unsafe('reset role');await tx`update public.elections set visibility='private' where id=${election}`;
  await tx.unsafe('set local role anon');expect((await tx`select public.get_structured_turnout(${election}) r`)[0].r.status).toBe('missing');
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}finally{await db.close();}
},30000);

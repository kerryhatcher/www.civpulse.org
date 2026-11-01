import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import { prepareSchoolRows, decimalUnits } from '../lib/school-finances';
const url=process.env.FINANCE_TEST_DATABASE_URL;
test.skipIf(!url)('finance release import, retries, atomic publication, correction, search and role gates',async()=>{
 const db=new SQL(url!),rollback=new Error('rollback');
 try { await db.begin(async tx=>{
  if (!(await tx`select to_regclass('public.school_finance_releases') t`)[0].t) await tx.unsafe(await Bun.file('supabase/migrations/20261125001000_school_finances.sql').text());
  const admin=crypto.randomUUID();await tx`insert into auth.users(id,email) values(${admin},${`${admin}@example.test`})`;await tx`insert into public.admins(user_id) values(${admin})`;
  const fail=async(fn:()=>Promise<unknown>,message:string)=>{await tx.unsafe('savepoint bad');let caught=false;try{await fn()}catch(e){caught=true;expect(String(e)).toContain(message)}finally{await tx.unsafe('rollback to savepoint bad')}expect(caught).toBe(true)};
  const call=async(action:string,payload:unknown)=>(await tx`select public.manage_school_finances(${action},${JSON.stringify(payload)}::text::jsonb) r`)[0].r;
  const read=async(dataset='payments',year:number|null=2025,q='',offset=0,limit=50,sort='amount')=>(await tx`select public.browse_school_finances(${dataset},${year},${q},${offset},${limit},${sort}) r`)[0].r;
  const manifest={dataset:'payments',fiscal_year:2025,organization_id:null,source_url:'https://open.ga.gov/openga/payment/index',source_sha256:'a'.repeat(64),source_filename:'original.csv',source_filters:{organization:'BIBB COUNTY BOARD OF EDUCATION'},retrieved_at:'2026-11-01T00:00:00Z',parser_version:'test-v1',expected_rows:2,expected_amount:'125.00',expected_travel:null};
  await tx.unsafe("set local statement_timeout='3s'");
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const first=await call('begin',manifest); expect((await call('begin',manifest)).release_id).toBe(first.release_id);
  await fail(()=>call('begin',{...manifest,expected_rows:3}),'different metadata');
  const rows=[{row_number:1,source_row_number:1,name:'SALARY',amount:'100.00',payment_count:2},{row_number:2,source_row_number:2,name:'Example vendor',amount:'25.00',payment_count:1}];
  await call('append',{release_id:first.release_id,rows:[rows[0]]});
  await fail(()=>call('publish',{release_id:first.release_id,confirm_publication:true,expected_current_id:null}),'reconcile');
  expect((await read()).release).toBeNull();
  await call('append',{release_id:first.release_id,rows});expect((await call('append',{release_id:first.release_id,rows})).row_count).toBe(2);
  await fail(()=>call('append',{release_id:first.release_id,rows:[{...rows[0],amount:'1.00'}]}),'Conflicting retry');
  await fail(()=>call('append',{release_id:first.release_id,rows:[{...rows[0],amount:'1.0000000000000000001'}]}),'decimal');
  await fail(()=>call('append',{release_id:first.release_id,rows:[{...rows[0],amount:1}]}),'decimal');
  await fail(()=>call('append',{release_id:first.release_id,rows:[{...rows[0],title:'Invalid payroll field'}]}),'Payments require');
  await fail(()=>call('publish',{release_id:first.release_id}),'Confirm publication');
  await call('publish',{release_id:first.release_id,confirm_publication:true,expected_current_id:null});
  expect((await call('begin',manifest)).release_id).toBe(first.release_id);
  const result=await read();expect(result.total).toBe(2);expect(result.rows[0].category).toBe('payroll_aggregate');expect(result.release.created_by).toBeUndefined();
  expect((await read('payments',2025,'example')).total).toBe(1);expect((await read('payments',2025,'example')).filtered_amount).toBe('25.00');
  expect((await read('payments',2025,'',1,1)).rows[0].name).toBe('Example vendor');expect((await read('payments',2025,'',0,1,'name')).rows[0].name).toBe('Example vendor');
  expect((await read('payments',2024)).release).toBeNull();await fail(()=>read('payments',2025,'',-1),'Invalid finance');
  await fail(()=>tx`insert into public.school_finance_rows(release_id,row_number,source_row_number,name,amount) values(${first.release_id},3,3,'Bypass',1)`,'permission denied');
  const second=await call('begin',{...manifest,source_sha256:'b'.repeat(64),retrieved_at:'2026-11-02T00:00:00Z'});
  await call('append',{release_id:second.release_id,rows});
  await fail(()=>call('publish',{release_id:second.release_id,confirm_publication:true}),'Current release changed');
  await call('publish',{release_id:second.release_id,confirm_publication:true,expected_current_id:first.release_id});
  await call('publish',{release_id:second.release_id,confirm_publication:true,expected_current_id:first.release_id});
  await fail(()=>call('append',{release_id:second.release_id,rows}),'Only staging');
  await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
  await fail(()=>call('begin',manifest),'Admin access');expect((await read()).release.id).toBe(second.release_id);
  await tx.unsafe('set local role anon');expect((await read()).total).toBe(2);await fail(()=>tx`select * from public.school_finance_releases`,'permission denied');
  await fail(()=>tx`select * from public.school_finance_rows`,'permission denied');
  await fail(()=>call('begin',manifest),'permission denied');
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;await call('withdraw',{release_id:second.release_id});expect((await read()).release).toBeNull();
  // Payroll uses separate salary and travel totals; identical names remain distinct.
  const payroll=await call('begin',{...manifest,dataset:'payroll',source_sha256:'c'.repeat(64),expected_amount:'200.00',expected_travel:'4.00'});
  await call('append',{release_id:payroll.release_id,rows:[1,2].map(i=>({row_number:i,source_row_number:i+10,name:'DOE, JANE',title:'TEACHER',amount:'100.00',travel:'2.00'}))});
  await call('publish',{release_id:payroll.release_id,confirm_publication:true});const people=await read('payroll',2025,'teacher');expect(people.total).toBe(2);expect(new Set(people.rows.map((r:any)=>r.person_id)).size).toBe(2);expect(people.rows.every((r:any)=>r.identity_review_required)).toBe(true);
  const person=people.rows[0];await call('review_person',{release_id:payroll.release_id,row_number:person.row_number,person_id:person.person_id,confirm_identity:true,review_note:'Synthetic identity verification fixture'});expect((await read('payroll',2025,'teacher')).rows.find((r:any)=>r.person_id===person.person_id).identity_review_required).toBe(false);
  await tx.unsafe('reset role');await tx`update public.people set visibility='private' where id=${person.person_id}`;await tx.unsafe('set local role anon');
  expect((await read('payroll',2025,'teacher')).rows.find((r:any)=>r.row_number===person.row_number).person_id).toBeNull();
  throw rollback;
 }); } catch(e){if(e!==rollback)throw e}finally{await db.close()}
},30000);

test.skipIf(!url||!process.env.FINANCE_SOURCE_DIR)('saved Bibb exports reconcile in rollback-only database import',async()=>{
 const db=new SQL(url!),rollback=new Error('rollback');
 try{await db.begin(async tx=>{
  if (!(await tx`select to_regclass('public.school_finance_releases') t`)[0].t) await tx.unsafe(await Bun.file('supabase/migrations/20261125001000_school_finances.sql').text());
  const admin=crypto.randomUUID();await tx`insert into auth.users(id,email) values(${admin},${`${admin}@example.test`})`;await tx`insert into public.admins(user_id) values(${admin})`;
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  for(const [dataset,year,file,count] of [['payments',2025,'payments-2025.csv',2586],['payments',2024,'payments-2024.csv',2749],['payroll',2025,'SalaryTravelDataExport2025.txt',4260]] as const){
   const bytes=new Uint8Array(await Bun.file(`${process.env.FINANCE_SOURCE_DIR}/${file}`).arrayBuffer());const prepared=prepareSchoolRows(bytes,dataset,year);expect(prepared.rows).toHaveLength(count);
   const manifest={dataset,fiscal_year:year,source_url:'https://open.ga.gov/openga/payment/index',source_filename:file,source_sha256:new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),source_filters:{organization:'BIBB COUNTY BOARD OF EDUCATION'},retrieved_at:'2026-11-01T00:00:00Z',parser_version:'v1',expected_rows:prepared.expected_rows,expected_amount:prepared.expected_amount,expected_travel:prepared.expected_travel};
   const call=async(a:string,p:unknown)=>(await tx`select public.manage_school_finances(${a},${JSON.stringify(p)}::text::jsonb) r`)[0].r;
   const release=await call('begin',manifest);
   for(let i=0;i<prepared.rows.length;i+=500)await call('append',{release_id:release.release_id,rows:prepared.rows.slice(i,i+500)});
   await call('publish',{release_id:release.release_id,confirm_publication:true});
   const read=(await tx`select public.browse_school_finances(${dataset},${year}) r`)[0].r;expect(read.total).toBe(count);expect(decimalUnits(read.filtered_amount)).toBe(decimalUnits(prepared.expected_amount));if(prepared.expected_travel!==null)expect(decimalUnits(read.filtered_travel)).toBe(decimalUnits(prepared.expected_travel));else expect(read.filtered_travel).toBeNull();
  }
  throw rollback;
 })}catch(e){if(e!==rollback)throw e}finally{await db.close()}
},60000);

import {expect,test} from 'bun:test';
import {SQL} from 'bun';
const url=process.env.FINANCE_TEST_DATABASE_URL;
test.skipIf(!url)('payment recipients: exact reuse, ambiguous stubs, stable aliases, review, visibility and atomic retry',async()=>{
 const db=new SQL(url!),rollback=new Error('rollback');
 try{await db.begin(async tx=>{
  for(const [table,file] of [['school_finance_releases','20261125001000_school_finances.sql'],['school_finance_recipients','20261125001100_school_finance_recipients.sql']]){
   if(!(await tx`select to_regclass(${`public.${table}`}) t`)[0].t)await tx.unsafe(await Bun.file(`supabase/migrations/${file}`).text());
  }
  const admin=crypto.randomUUID(),org=crypto.randomUUID(),person=crypto.randomUUID();
  await tx`insert into auth.users(id,email) values(${admin},${`${admin}@example.test`})`;await tx`insert into public.admins(user_id) values(${admin})`;
  await tx`insert into public.organizations(id,slug,name) values(${org},${`qa-${org}`},'Existing QA Vendor')`;
  await tx`insert into public.people(id,slug,full_name,visibility) values(${person},${`qa-${person}`},'Unique QA Person','public')`;
  for(const id of [crypto.randomUUID(),crypto.randomUUID()])await tx`insert into public.people(id,slug,full_name) values(${id},${`qa-${id}`},'Ambiguous QA Name')`;
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const call=async(action:string,payload:unknown)=>(await tx`select public.manage_school_finances(${action},${JSON.stringify(payload)}::text::jsonb) r`)[0].r;
  const read=async(year=2025)=>(await tx`select public.browse_school_finances('payments',${year},'',0,100,'name') r`)[0].r;
  const fail=async(fn:()=>Promise<unknown>,message:string)=>{await tx.unsafe('savepoint bad');let caught=false;try{await fn()}catch(e){caught=true;expect(String(e)).toContain(message)}finally{await tx.unsafe('rollback to savepoint bad')}expect(caught).toBe(true)};
  const names=['SALARY','Existing QA Vendor','Unique QA Person','Ambiguous QA Name','New QA Recipient','  New QA  Recipient '];
  const rows=names.map((name,i)=>({row_number:i+1,source_row_number:i+1,name,amount:'10.00',payment_count:1}));
  const manifest={dataset:'payments',fiscal_year:2025,source_url:'https://open.ga.gov/openga/payment/index',source_sha256:'d'.repeat(64),source_filename:'qa.csv',source_filters:{organization:'BIBB COUNTY BOARD OF EDUCATION'},retrieved_at:'2026-11-01T00:00:00Z',parser_version:'qa',expected_rows:6,expected_amount:'60.00',expected_travel:null};
  const first=await call('begin',manifest);await call('append',{release_id:first.release_id,rows});expect((await read()).release).toBeNull();
  await call('publish',{release_id:first.release_id,confirm_publication:true});
  const result=await read(),find=(n:string)=>result.rows.find((r:any)=>r.name===n);
  expect(find('SALARY').recipient).toBeNull();expect(find('Existing QA Vendor').recipient.record_id).toBe(org);expect(find('Existing QA Vendor').recipient.is_stub).toBe(false);
  expect(find('Unique QA Person').recipient.record_id).toBe(person);expect(find('Unique QA Person').recipient.kind).toBe('person');
  expect(find('Ambiguous QA Name').recipient.kind).toBe('organization');expect(find('Ambiguous QA Name').recipient.is_stub).toBe(true);
  const stub=find('New QA Recipient').recipient;expect(stub.identity_review_required).toBe(true);expect(stub.kind).toBe('organization');expect(find('  New QA  Recipient ').recipient.id).toBe(stub.id);
  await call('publish',{release_id:first.release_id,confirm_publication:true});expect((await read()).rows.find((r:any)=>r.name==='New QA Recipient').recipient.record_id).toBe(stub.record_id);
  const second=await call('begin',{...manifest,fiscal_year:2024,source_sha256:'e'.repeat(64)});await call('append',{release_id:second.release_id,rows});await call('publish',{release_id:second.release_id,confirm_publication:true});
  expect((await read(2024)).rows.find((r:any)=>r.name==='New QA Recipient').recipient.id).toBe(stub.id);
  await fail(()=>call('resolve_recipient',{recipient_id:stub.id,kind:'person',target_id:person,review_note:'short'}),'review note');
  await call('resolve_recipient',{recipient_id:stub.id,kind:'person',target_id:person,review_note:'Synthetic explicit identity review with supporting evidence'});
  const reviewed=(await read()).rows.find((r:any)=>r.name==='New QA Recipient');expect(reviewed.recipient.record_id).toBe(person);expect(reviewed.recipient.identity_review_required).toBe(false);expect(reviewed.name).toBe('New QA Recipient');expect(reviewed.amount).toBe('10.00');
  await tx.unsafe('reset role');await tx`update public.people set visibility='private' where id=${person}`;
  await tx.unsafe('set local role anon');const hidden=await read();expect(hidden.rows.find((r:any)=>r.name==='Unique QA Person').recipient).toBeNull();expect(hidden.rows.find((r:any)=>r.name==='New QA Recipient').recipient).toBeNull();expect(JSON.stringify(hidden)).not.toContain(person);
  await fail(()=>tx`select * from public.school_finance_recipients`,'permission denied');
  await fail(()=>tx`select school_finance_private.link_recipients(${first.release_id})`,'permission denied');
  await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;await fail(()=>call('resolve_recipient',{recipient_id:stub.id}),'Admin access');
  await tx`select set_config('request.jwt.claim.sub',${admin},true)`;const created=await call('resolve_recipient',{recipient_id:stub.id,kind:'person',review_note:'Classified as a person; new source stub still needs identity review'});expect(created.is_stub).toBe(true);expect((await read()).rows.find((r:any)=>r.name==='New QA Recipient').recipient.identity_review_required).toBe(true);
  await tx.unsafe('set constraints all immediate');throw rollback;
 })}catch(e){if(e!==rollback)throw e}finally{await db.close()}
},30000);

import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.RECORDS_TEST_DATABASE_URL)('records requests protect ownership, visibility, fees and files across transfers', async()=>{
 const sql=new SQL(process.env.RECORDS_TEST_DATABASE_URL!); const rollback=new Error('rollback fixtures');
 try {await sql.begin(async tx=>{
  const admin=crypto.randomUUID(),owner=crypto.randomUUID(),outsider=crypto.randomUUID();
  for(const id of [admin,owner,outsider])await tx`insert into auth.users(id,email) values(${id},${`${id}@example.test`})`;
  await tx`insert into public.admins(user_id) values(${admin})`;
  const [org]=await tx`insert into public.organizations(name,slug) values('Records QA',${crypto.randomUUID()}) returning id`;
  async function role(id:string|null) {await tx.unsafe(id?'set local role authenticated':'set local role anon');await tx`select set_config('request.jwt.claim.sub',${id??''},true)`;}
  async function denied(run:()=>Promise<unknown>) {await tx.unsafe('savepoint rejected');let failed=false;try{await run();}catch{failed=true;}finally{await tx.unsafe('rollback to savepoint rejected');}expect(failed).toBe(true);}
  const payload=(visibility:string)=>({title:'Records QA transparency',target_organization_id:org.id,visibility,stage:'submitted',description:'Correspondence about schools'});
  await role(outsider);await denied(()=>tx`select public.save_records_request(null,${payload('private')}::jsonb)`);
  await role(admin);
  const ids:Record<string,string>={};
  for(const visibility of ['public','unlisted','private']) {const [row]=await tx`select public.save_records_request(null,${payload(visibility)}::jsonb) id`;ids[visibility]=row.id;}
  await tx`select public.add_records_request_item(${ids.public},'fee','{"kind":"estimated","amount":"125.25","occurred_on":"2026-10-23"}'::jsonb)`;
  await tx`select public.add_records_request_item(${ids.public},'fee','{"kind":"paid","amount":"25.00","occurred_on":"2026-10-23"}'::jsonb)`;
  await denied(()=>tx`select public.add_records_request_item(${ids.public},'fee','{"kind":"paid","amount":"-1","occurred_on":"2026-10-23"}'::jsonb)`);
  await denied(()=>tx`select public.add_records_request_item(${ids.public},'link','{"title":"Unsafe","url":"javascript:alert(1)"}'::jsonb)`);
  await tx`select public.add_records_request_item(${ids.public},'update','{"kind":"delay","body":"Response delayed","occurred_on":"2026-10-23"}'::jsonb)`;
  // Storage fixture metadata is created as the database owner; API permissions checked below.
  await tx.unsafe('reset role');
  const sharedPath=`${ids.unlisted}/${crypto.randomUUID()}.pdf`,privatePath=`${ids.public}/${crypto.randomUUID()}.pdf`;
  for(const [rid,path,privacy] of [[ids.unlisted,sharedPath,false],[ids.public,privatePath,true]] as const){
   await tx`insert into storage.objects(bucket_id,name) values('records-request-files',${path})`;
   await tx`insert into public.records_request_files(request_id,file_name,storage_path,mime_type,size_bytes,is_private) values(${rid},'record.pdf',${path},'application/pdf',100,${privacy})`;
  }
  for(const user of [null,outsider]) {
   await role(user);
   const rows=await tx`select * from public.search_records_requests('transparency')`;expect(rows.map(r=>r.id)).toEqual([ids.public]);
   for(const visibility of ['public','unlisted']) {
    const [{result}]=await tx`select public.get_records_request(${ids[visibility]}) result`;expect(result.status).toBe('ok');expect(result.owner_id).toBeUndefined();expect(result.transfers).toBeUndefined();expect(result.can_manage).toBe(false);
   }
   const [{result}]=await tx`select public.get_records_request(${ids.public}) result`;expect(result.files).toHaveLength(0);expect(result.fees).toHaveLength(2);expect(result.updates).toHaveLength(1);
   expect((await tx`select public.get_records_request(${ids.private}) result`)[0].result.status).toBe('unavailable');
   await denied(()=>tx`select * from public.records_request_owners`);
   await denied(()=>tx`select public.transfer_records_request(${ids.private},${outsider},'steal')`);
   await denied(()=>tx`select public.save_records_request(${ids.public},${payload('public')}::jsonb)`);
   await denied(()=>tx`select public.add_records_request_item(${ids.public},'update','{"kind":"note","body":"bad","occurred_on":"2026-10-23"}'::jsonb)`);
   await tx`select set_config('storage.operation','storage.object.list',true)`;
   expect(await tx`select name from storage.objects where bucket_id='records-request-files'`).toHaveLength(0);
   expect((await tx`select public.can_read_records_file(${sharedPath}) allowed`)[0].allowed).toBe(true);
   expect((await tx`select public.can_read_records_file(${privatePath}) allowed`)[0].allowed).toBe(false);
  }
  await role(admin);await tx`select public.transfer_records_request(${ids.private},${owner},'Assign case')`;
  await role(owner);
  expect((await tx`select public.get_records_request(${ids.private}) result`)[0].result.transfers).toHaveLength(2);
  await tx`select public.save_records_request(${ids.private},${payload('private')}::jsonb)`;
  await denied(()=>tx`update public.records_request_owners set user_id=${outsider} where request_id=${ids.private}`);
  await tx`select public.transfer_records_request(${ids.private},${outsider},'Handoff')`;
  expect((await tx`select public.get_records_request(${ids.private}) result`)[0].result.status).toBe('unavailable');
  await denied(()=>tx`select public.save_records_request(${ids.private},${payload('public')}::jsonb)`);
  await role(outsider);const [{result}]=await tx`select public.get_records_request(${ids.private}) result`;expect(result.owner_id).toBe(outsider);expect(result.transfers).toHaveLength(3);
  expect((await tx`select * from public.search_records_requests('',null,null,true)`).map(r=>r.id)).toEqual([ids.private]);
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await sql.close();}
});

import {expect,test} from 'bun:test';
import {SQL} from 'bun';
import {loadPublicRequests} from '../../apps/web/src/lib/request-build-data';
import {browsePublicRequests,requestDirectoryRow} from '../../apps/web/src/lib/request-snapshot';
test.skipIf(!process.env.RECORDS_TEST_DATABASE_URL)('public request snapshots match search/filter pages and exclude private identities/files across access changes',async()=>{
 const sql=new SQL(process.env.RECORDS_TEST_DATABASE_URL!);const rollback=Error('rollback request snapshot fixtures');
 try{await sql.begin(async tx=>{
  const tag=crypto.randomUUID(),owner=crypto.randomUUID(),outsider=crypto.randomUUID();
  for(const id of [owner,outsider])await tx`insert into auth.users(id,email) values(${id},${id+'@example.test'})`;
  const [org]=await tx`insert into organizations(name,slug) values('Snapshot request QA',${tag}) returning id`;
  const ids:Record<string,string>={};
  for(const visibility of ['public','unlisted','private']) {
   const [r]=await tx`insert into records_requests(title,description,target_organization_id,visibility,stage) values(${tag+' '+visibility+' school records'},'Public correspondence about school funding',${org.id},${visibility},'submitted') returning id`;ids[visibility]=r.id;
   await tx`insert into records_request_owners(request_id,user_id) values(${r.id},${owner})`;
   await tx`insert into records_request_transfers(request_id,to_user_id,actor_id,reason) values(${r.id},${owner},${owner},'Private ownership provenance')`;
  }
  for(let i=0;i<31;i++)await tx`insert into records_requests(title,description,target_organization_id,visibility,stage) values(${tag+' school request '+i},${i%2?'Board of records: school funding and correspondence':'Road repairs and after-school programs'},${org.id},'public',${i%2?'submitted':'closed'})`;
  await tx`insert into records_request_updates(request_id,occurred_on,kind,body) values(${ids.public},'2026-10-01','response','Agency acknowledged the request')`;
  await tx`insert into records_request_fees(request_id,kind,amount) values(${ids.public},'estimated',125.25),(${ids.public},'paid',25)`;
  const paths:Record<string,string>={},files:Record<string,string>={};
  for(const privacy of ['public','private']) {
   const path=ids.public+'/'+crypto.randomUUID()+'.pdf';paths[privacy]=path;
   const [f]=await tx`insert into records_request_files(request_id,file_name,storage_path,mime_type,size_bytes,is_private) values(${ids.public},${privacy+'-evidence.pdf'},${path},'application/pdf',100,${privacy==='private'}) returning id`;files[privacy]=f.id;
  }
  const client={rpc:async(name:string,a:any)=>{
   if(name==='get_records_request'){const [r]=await tx`select public.get_records_request(${a.p_id}) data`;return {data:r.data,error:null};}
   return {data:await tx`select * from public.search_records_requests(p_managed=>false,p_offset=>${a.p_offset})`,error:null};
  }} as any;
  await tx.unsafe('set local role anon');
  const snapshot=await loadPublicRequests(client),rows=snapshot.map(requestDirectoryRow),serialized=JSON.stringify(snapshot);
  expect(snapshot.some(r=>r.request.id===ids.public)).toBe(true);
  for(const secret of [ids.private,ids.unlisted,owner,outsider,paths.public,paths.private,files.private,'Private ownership provenance','private-evidence.pdf'])expect(serialized).not.toContain(secret);
  expect(snapshot.find(r=>r.request.id===ids.public)?.files).toEqual([{id:files.public,file_name:'public-evidence.pdf',size_bytes:100}]);
  for(const query of [tag,'school','schools','school -funding','school OR repairs','"school funding"','"board the records"','the','-school'])for(const stage of [null,'submitted','closed'])for(const offset of [0,25]) {
   const live=await tx`select * from public.search_records_requests(${query},${stage},${org.id}::uuid,false,${offset})`;
   const published=browsePublicRequests(rows,query,stage??'',org.id,offset).rows;
   expect(published.map(r=>r.id)).toEqual(live.map(r=>r.id));
  }
  expect((await tx`select public.can_read_records_file(${paths.public}) allowed`)[0].allowed).toBe(true);
  expect((await tx`select public.can_read_records_file(${paths.private}) allowed`)[0].allowed).toBe(false);
  expect((await tx`select public.get_records_request(${ids.unlisted}) data`)[0].data.status).toBe('ok');
  expect((await tx`select public.get_records_request(${ids.private}) data`)[0].data.status).toBe('unavailable');
  await tx.unsafe('reset role');await tx`update records_request_files set is_private=true where id=${files.public}`;
  await tx.unsafe('set local role anon');
  expect((await tx`select public.get_records_request(${ids.public}) data`)[0].data.files).toHaveLength(0);
  expect((await tx`select public.can_read_records_file(${paths.public}) allowed`)[0].allowed).toBe(false);
  await tx.unsafe('reset role');await tx`update records_request_files set is_private=false where id=${files.public}`;await tx`update records_requests set visibility='private' where id=${ids.public}`;
  await tx.unsafe('set local role anon');expect((await tx`select public.can_read_records_file(${paths.public}) allowed`)[0].allowed).toBe(false);
  await tx.unsafe('reset role');await tx`select set_config('request.jwt.claim.sub',${owner},true)`;await tx.unsafe('set local role authenticated');
  expect((await tx`select public.get_records_request(${ids.private}) data`)[0].data.can_manage).toBe(true);
  await tx`select public.transfer_records_request(${ids.private},${outsider},'Transfer snapshot QA')`;
  expect((await tx`select public.get_records_request(${ids.private}) data`)[0].data.status).toBe('unavailable');
  await tx`select set_config('request.jwt.claim.sub',${outsider},true)`;
  expect((await tx`select public.get_records_request(${ids.private}) data`)[0].data.owner_id).toBe(outsider);
  expect((await tx`select public.can_read_records_file(${paths.private}) allowed`)[0].allowed).toBe(false);
  await tx`select set_config('request.jwt.claim.sub',${owner},true)`;
  expect((await tx`select public.can_read_records_file(${paths.private}) allowed`)[0].allowed).toBe(true);
  await tx`select public.transfer_records_request(${ids.public},${outsider},'Transfer private file custody')`;
  expect((await tx`select public.can_read_records_file(${paths.private}) allowed`)[0].allowed).toBe(false);
  await tx`select set_config('request.jwt.claim.sub',${outsider},true)`;
  expect((await tx`select public.can_read_records_file(${paths.private}) allowed`)[0].allowed).toBe(true);
  await tx.unsafe('reset role');throw rollback;
 });}catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
},30000);

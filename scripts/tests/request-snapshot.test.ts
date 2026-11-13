import {expect,test} from 'bun:test';
import {browsePublicRequests,publicRequestDetail,requestFeeTotals} from '../../apps/web/src/lib/request-snapshot';
import {loadPublicRequests,readPublicRequests} from '../../apps/web/src/lib/request-build-data';
import {publicRequestTarget,readPublicRequestDirectory,requestFileDownload} from '../../apps/web/src/scripts/request-data';
import type {RequestDetail} from '../../apps/web/src/lib/records-requests';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const raw=(n:number):RequestDetail=>({status:'ok',can_manage:false,request:{id:id(n),title:'School records '+n,description:'Public correspondence about school funding',visibility:'public',stage:n%2?'submitted':'closed',outcome:null,request_type:'orr',target_organization_id:id(n%2?500:501),source_organization_id:null,submitted_on:'2026-10-01',next_follow_up_on:null,reference_number:null,updated_at:'2026-10-01T00:00:00+00:00'},organizations:[],updates:[],fees:[],links:[],files:[]});
test('public projection excludes account data, paths, private files and raw metadata',()=>{
 const detail=raw(1);detail.files=[{id:id(10),file_name:'public.pdf',storage_path:id(1)+'/'+id(10)+'.pdf',size_bytes:123,is_private:false}];
 const snapshot=publicRequestDetail(detail);expect(snapshot.files).toEqual([{id:id(10),file_name:'public.pdf',size_bytes:123}]);expect(JSON.stringify(snapshot)).not.toContain('storage_path');
 expect(()=>publicRequestDetail({...detail,owner_id:id(88)})).toThrow('privileged');expect(()=>publicRequestDetail({...detail,can_manage:true})).toThrow('privileged');
 for(const visibility of ['private','unlisted'] as const)expect(()=>publicRequestDetail({...detail,request:{...detail.request,visibility}})).toThrow('Non-public');
 detail.files[0].is_private=true;expect(()=>publicRequestDetail(detail)).toThrow('Private file');
 expect(requestFeeTotals([{id:id(1),kind:'estimated',amount:0.1,occurred_on:'2026-01-01',note:''},{id:id(2),kind:'estimated',amount:0.2,occurred_on:'2026-01-01',note:''},{id:id(3),kind:'paid',amount:25,occurred_on:'2026-01-01',note:''}])).toEqual({estimated:0.3,billed:0,paid:25});
});
test('public directory keeps complete-dataset filters, English search, ordering and paging',()=>{
 const rows=Array.from({length:56},(_,i)=>({...raw(i+1).request,target_name:null,source_name:null}));
 expect(browsePublicRequests(rows).total).toBe(56);expect(browsePublicRequests(rows,'schools').total).toBe(56);
 expect(browsePublicRequests(rows,'"school funding"').total).toBe(56);expect(browsePublicRequests(rows,'school -funding').total).toBe(0);
 expect(browsePublicRequests(rows,'missing OR schools').total).toBe(56);expect(browsePublicRequests(rows,'the').total).toBe(0);
 expect(browsePublicRequests(rows,'schools','submitted',id(500)).total).toBe(28);
 expect(browsePublicRequests(rows,'schools','closed',id(500)).total).toBe(0);
 const a=browsePublicRequests(rows).rows,b=browsePublicRequests(rows,'','','',25).rows,c=browsePublicRequests(rows,'','','',50).rows;
 expect(new Set([...a,...b,...c].map(r=>r.id)).size).toBe(56);expect(c).toHaveLength(6);
});
test('shared anonymous build reads page and project only discovered public requests',async()=>{
 let calls=0;const records=Array.from({length:31},(_,i)=>raw(i+1));
 const client={rpc:async(name:string,args:any)=>{calls++;return {error:null,data:name==='search_records_requests'?records.slice(args.p_offset,args.p_offset+25).map(r=>r.request):records.find(r=>r.request.id===args.p_id)};}} as any;
 const [a,b]=await Promise.all([readPublicRequests(client),readPublicRequests(client)]);expect(a).toBe(b);expect(a).toHaveLength(31);expect(calls).toBe(33);
 await expect(loadPublicRequests({rpc:async()=>({data:[{...raw(1).request,visibility:'private'}],error:null})} as any)).rejects.toThrow('Non-public');
});
test('public assets cache, fail visibly and retry; signed-in and explicit live readers bypass snapshots',async()=>{
 const before=globalThis.fetch;let session:any=null,fail=true,fetches=0;
 const client={auth:{getSession:async()=>({data:{session},error:null})}} as any;
 const index='/directory-data/requests-index-'+'a'.repeat(64)+'.json',directory='/directory-data/requests-directory-'+'b'.repeat(64)+'.json';
 globalThis.fetch=(async(url)=>{fetches++;return fail?new Response('',{status:503}):Response.json(String(url).includes('-index-')?[id(1)]:{version:1,requests:[],organizations:[]});}) as typeof fetch;
 try{
  session={};expect(await readPublicRequestDirectory(client,undefined)).toBeNull();expect(await publicRequestTarget(client,undefined,id(1))).toBeNull();expect(fetches).toBe(0);
  session=null;await expect(publicRequestTarget(client,index,id(1))).rejects.toThrow('unavailable');fail=false;
  expect(await publicRequestTarget(client,index,id(1))).toBe(`/records/requests/${id(1)}/`);expect(await publicRequestTarget(client,index,id(2))).toBeNull();expect(fetches).toBe(2);
  expect(await publicRequestTarget(client,undefined,id(1),true)).toBeNull();expect(await readPublicRequestDirectory(client,directory)).toEqual({version:1,requests:[],organizations:[]});
 }finally{globalThis.fetch=before;}
});
test('downloads recheck current access before signing and reject removed/private files and foreign URLs',async()=>{
 let detail=raw(1),signatures=0,signedUrl='https://api.example/storage/v1/object/sign/records-request-files/test?token=test';
 const file={id:id(10),file_name:'evidence.pdf',storage_path:id(1)+'/'+id(10)+'.pdf',size_bytes:123,is_private:false};detail.files=[file];
 const client={auth:{getSession:async()=>({data:{session:null},error:null})},rpc:async()=>({data:detail,error:null}),storage:{from:()=>({createSignedUrl:async(path:string,ttl:number)=>{expect(path).toBe(file.storage_path);expect(ttl).toBe(60);signatures++;return {data:{signedUrl},error:null};}})}} as any;
 expect((await requestFileDownload(client,id(1),id(10),'https://api.example')).name).toBe('evidence.pdf');expect(signatures).toBe(1);
 detail.files=[];await expect(requestFileDownload(client,id(1),id(10),'https://api.example')).rejects.toThrow('unavailable');expect(signatures).toBe(1);
 detail.files=[{...file,is_private:true}];await expect(requestFileDownload(client,id(1),id(10),'https://api.example')).rejects.toThrow('unavailable');expect(signatures).toBe(1);
 detail.files=[file];signedUrl='https://evil.example/storage/v1/object/sign/records-request-files/test';await expect(requestFileDownload(client,id(1),id(10),'https://api.example')).rejects.toThrow('Invalid download URL');
});

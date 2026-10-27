import {expect,test} from 'bun:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readPublicLegislationTable} from '../../apps/web/src/lib/legislation-build-data';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=(size:number)=>Array.from({length:size},(_,i)=>({id:id(i),visibility:'public',title:`Row ${i}`}));
function mock(reply:(args:any)=>any){return {rpc:async(name:string,args:any)=>{expect(name).toBe('export_public_legislation_page');return reply(args);}} as unknown as SupabaseClient;}
test('one large stream uses two page slots, restores out-of-order responses, and shares pending/completed reads',async()=>{
 const source=rows(3751),calls:any[]=[];let active=0,peak=0;
 const client=mock(async args=>{
  calls.push(args);active++;peak=Math.max(peak,active);
  await new Promise(r=>setTimeout(r,args.p_offset===500?15:1));active--;
  return {data:{total:source.length,rows:source.slice(args.p_offset,args.p_offset+500)},error:null};
 });
 const first=readPublicLegislationTable(client,'bills');
 expect(readPublicLegislationTable(client,'bills')).toBe(first);
 const result=await first;
 expect(result).toEqual(source);expect(peak).toBe(2);expect(calls.length).toBe(8);
 expect(await readPublicLegislationTable(client,'bills')).toBe(result);expect(calls.length).toBe(8);
 expect(calls.every(a=>Object.keys(a).sort().join(',')==='p_limit,p_offset,p_table')).toBe(true);
});
test('several streams share a global two-request limit and do not mix clients',async()=>{
 let active=0,peak=0;
 const client=mock(async args=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;return {data:{total:1501,rows:rows(1501).slice(args.p_offset,args.p_offset+500)},error:null};});
 const data=await Promise.all(['bills','legislative_votes','bill_actions','bill_sponsorships'].map(t=>readPublicLegislationTable(client,t)));
 expect(peak).toBe(2);expect(data.map(d=>d.length)).toEqual([1501,1501,1501,1501]);
 const other=mock(()=>({data:{total:0,rows:[]},error:null}));expect(await readPublicLegislationTable(other,'bills')).toEqual([]);
});
test('fails closed on changed totals, hidden rows, duplicate pages, invalid IDs, oversized/truncated pages, and errors',async()=>{
 const source=rows(1001);
 for(const reply of [
  (a:any)=>({data:{total:a.p_offset?1002:1001,rows:source.slice(a.p_offset,a.p_offset+500)},error:null}),
  (a:any)=>({data:{total:1001,rows:source.slice(a.p_offset,a.p_offset+500).map(r=>({...r,visibility:a.p_offset?'unlisted':'public'}))},error:null}),
  (a:any)=>({data:{total:1001,rows:source.slice(a.p_offset,a.p_offset+500).map(r=>({...r,visibility:a.p_offset?'private':'public'}))},error:null}),
  (a:any)=>({data:{total:1001,rows:source.slice(a.p_offset?0:0,a.p_offset===1000?1:500)},error:null}),
  ()=>({data:{total:1,rows:[{id:'bad',visibility:'public'}]},error:null}),
  ()=>({data:{total:501,rows:source.slice(0,501)},error:null}),
  ()=>({data:{total:501,rows:source.slice(0,499)},error:null}),
  ()=>({data:{total:100001,rows:[]},error:null}),
  ()=>({data:{total:-1,rows:[]},error:null}),
  ()=>({data:null,error:{message:'offline'}}),
 ]) await expect(readPublicLegislationTable(mock(reply),'bills')).rejects.toThrow();
});
test('failed requests do not poison a later read or leave the limiter occupied',async()=>{
 let failed=true;
 const client=mock(()=>failed?{data:null,error:{message:'offline'}}:{data:{total:0,rows:[]},error:null});
 await expect(readPublicLegislationTable(client,'bills')).rejects.toThrow('offline');failed=false;
 expect(await readPublicLegislationTable(client,'bills')).toEqual([]);
 expect(await Promise.all(['bill_actions','bill_sponsorships','legislative_votes'].map(t=>readPublicLegislationTable(client,t)))).toEqual([[],[],[]]);
});

test('profile and archive consumers share complete sponsorship pages on the same client',async()=>{
 const {loadProfileSectionBuildData}=await import('../../apps/web/src/lib/profile-section-build-data');
 const {loadPublicRecords}=await import('../../apps/web/src/lib/public-record-build-data');
 const source=rows(1001),offsets:number[]=[];
 const client={rpc:async(name:string,args:any)=>{
  if(name!=='export_public_legislation_page')return {data:[],error:null};
  if(args.p_table!=='bill_sponsorships')return {data:{rows:[],total:0},error:null};
  offsets.push(args.p_offset);await new Promise(r=>setTimeout(r,1));
  return {data:{rows:source.slice(args.p_offset,args.p_offset+500),total:source.length},error:null};
 }} as unknown as SupabaseClient;
 await Promise.all([loadProfileSectionBuildData(client),loadPublicRecords(client)]);
 expect(offsets.sort((a,b)=>a-b)).toEqual([0,500,1000]);
});

test('only confirmed statement timeouts retry, preserving the exact anonymous discovery arguments',async()=>{
 const calls:any[]=[];
 const client=mock(args=>{calls.push(args);return calls.length<3?{data:null,error:{code:'57014',message:'canceling statement due to statement timeout'}}:{data:{total:0,rows:[]},error:null};});
 expect(await readPublicLegislationTable(client,'bills')).toEqual([]);expect(calls.length).toBe(3);expect(calls.every(a=>JSON.stringify(a)===JSON.stringify(calls[0]))).toBe(true);
 for(const error of [{code:'42501',message:'permission denied'},{code:'57014',message:'canceling statement due to user request'}]){
  let attempts=0;const denied=mock(()=>{attempts++;return {data:null,error};});
  await expect(readPublicLegislationTable(denied,'bills')).rejects.toThrow(error.message);expect(attempts).toBe(1);
 }
 let attempts=0;const persistent=mock(()=>{attempts++;return {data:null,error:{code:'57014',message:'statement timeout'}};});
 await expect(readPublicLegislationTable(persistent,'bills')).rejects.toThrow('statement timeout');expect(attempts).toBe(3);
});

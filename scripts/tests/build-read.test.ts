import {expect,test} from 'bun:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readPublicProfileBuildPage} from '../../apps/web/src/lib/build-read';
const timeout={code:'57014',message:'canceling statement due to statement timeout'};
const source=Array.from({length:2300},(_,i)=>({owner_id:`owner-${i}`,ordinal:i,data:{text:`Public row ${i}`}}));
function mock(reply:(args:any)=>any){return {rpc:async(name:string,args:any)=>{expect(name).toBe('export_public_profile_rows');return reply(args)}} as unknown as SupabaseClient;}
test('successful profile pages keep the existing single 500-row request',async()=>{
 const calls:any[]=[];const c=mock(a=>{calls.push(a);return {data:source.slice(a.p_offset,a.p_offset+a.p_limit),error:null}});
 expect((await readPublicProfileBuildPage(c,'legislative_votes',1000)).data).toEqual(source.slice(1000,1500));
 expect(calls).toEqual([{p_section:'legislative_votes',p_offset:1000,p_limit:500}]);
});
test('confirmed profile timeout splits exactly the same ordered range and handles the final short page',async()=>{
 for(const offset of [1000,2000]){
  const calls:any[]=[];const c=mock(a=>{calls.push(a);return a.p_limit===500?{data:null,error:timeout}:{data:source.slice(a.p_offset,a.p_offset+a.p_limit),error:null}});
  expect((await readPublicProfileBuildPage(c,'legislative_votes',offset)).data).toEqual(source.slice(offset,offset+500));
  expect(calls.slice(1).every(a=>a.p_limit===100&&a.p_section==='legislative_votes')).toBe(true);
  expect(calls.map(a=>a.p_offset)).toEqual(offset===1000?[1000,1000,1100,1200,1300,1400]:[2000,2000,2100,2200,2300]);
 }
});
test('permission errors and manual cancellation never split or retry',async()=>{
 for(const error of [{code:'42501',message:'permission denied'},{code:'57014',message:'canceling statement due to user request'}]){
  let calls=0;const c=mock(()=>{calls++;return {data:null,error}});
  expect((await readPublicProfileBuildPage(c,'legislative_votes',0)).error).toEqual(error);expect(calls).toBe(1);
 }
});
test('failed or malformed subpages stop the whole profile export',async()=>{
 let calls=0;const c=mock(a=>{calls++;return a.p_limit===500?{data:null,error:timeout}:{data:null,error:{code:'42501',message:'permission denied'}}});
 expect((await readPublicProfileBuildPage(c,'legislative_votes',0)).error?.code).toBe('42501');expect(calls).toBe(2);
 const malformed=mock(a=>a.p_limit===500?{data:null,error:timeout}:{data:source.slice(0,101),error:null});
 await expect(readPublicProfileBuildPage(malformed,'legislative_votes',0)).rejects.toThrow('Invalid');
});

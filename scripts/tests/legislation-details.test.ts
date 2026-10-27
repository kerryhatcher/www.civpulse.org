import {expect,test} from 'bun:test';
import {assembleLegislationDetails,detailRow,recordedVoteTotals} from '../../apps/web/src/lib/legislation-details';
import {publicLegislationTarget} from '../../apps/web/src/scripts/legislation-detail-target';
import {readDetailPage} from '../../apps/web/src/scripts/legislation-detail';
import type {LegislativeRow} from '../../apps/web/src/lib/legislation';
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row=(id:number,extra:Record<string,unknown>={}):LegislativeRow=>({id:uuid(id),visibility:'public',...extra});
test('full public details group parent relations, preserve order and project safe fields/links',()=>{
 const bill=row(1,{title:'Public bill',term_id:uuid(20),session_id:uuid(3),source_payload:{secret:'raw import'},source_url:'javascript:alert(1)'});
 const vote=row(2,{session_id:uuid(3),coverage:'complete',reported_yes:2,reported_no:0,reported_other:0});
 const session=row(3);
 const actions=Array.from({length:51},(_,i)=>row(100+i,{bill_id:bill.id,session_id:session.id,description:`Action ${i}`}));
 const tables=new Map([['bills',[bill]],['legislative_votes',[vote]],['legislative_sessions',[session]],['bill_actions',actions],['legislative_vote_choices',[row(4,{vote_id:vote.id,choice:'yes'}),row(5,{vote_id:vote.id,choice:'absent'})]],['legislative_vote_bills',[row(6,{bill_id:bill.id,vote_id:vote.id})]],['legislative_event_links',[row(7,{session_id:session.id,event_id:uuid(80)})]]]);
 const details=assembleLegislationDetails(tables);
 const b=details.get(`bills/${bill.id}`)!;expect(b.sections[0].total).toBe(51);expect(b.sections[0].rows.map(r=>r.id)).toEqual(actions.map(r=>r.id));
 expect(b.sections[1].rows[0].links?.vote_id).toBe(`/records/votes/${vote.id}/`);
 expect(b.row.links?.record).toBe(`/records/bills/${bill.id}/`);
 expect(b.row.source_url).toBeNull();expect(JSON.stringify(details.get(`bills/${bill.id}`))).not.toContain('raw import');
 expect(details.get(`legislative_sessions/${session.id}`)?.sections.map(s=>s.total)).toEqual([1,1,51,1]);
 expect(details.get(`legislative_sessions/${session.id}`)?.sections.at(-1)?.rows[0].links?.event_id).toBe(`/records/events/${uuid(80)}/`);
 expect(details.get(`legislative_votes/${vote.id}`)?.totals).toEqual({recorded:{total:2,yes:1,no:0,other:1},matchesReported:false});
 for(const visibility of ['private','unlisted']) expect(()=>assembleLegislationDetails(new Map([['bills',[{...bill,visibility}]]]))).toThrow('Non-public');
 expect(detailRow('legislative_vote_choices',row(99,{membership_review_note:'not a public display field'}),new Map())).not.toHaveProperty('membership_review_note');
});
test('vote tally counts only provided public choices and retains unknown coverage semantics',()=>{
 expect(recordedVoteTotals(row(1,{coverage:'partial',reported_yes:4}),[]).matchesReported).toBeNull();
 expect(recordedVoteTotals(row(1,{coverage:'complete',reported_yes:1,reported_no:1,reported_other:1}),[row(2,{choice:'yes'}),row(3,{choice:'no'}),row(4,{choice:'not_voting'})])).toEqual({recorded:{total:3,yes:1,no:1,other:1},matchesReported:true});
});
test('published-ID resolution caches public indexes; signed-in/live/hidden records keep RPC paths; failures retry',async()=>{
 const before=globalThis.fetch;let signedIn=false,authError=false,fail=false,fetches=0;
 const client={auth:{getSession:async()=>({data:{session:signedIn?{}:null},error:authError?Error('auth failed'):null})}} as unknown as Parameters<typeof publicLegislationTarget>[0];
 const url='/directory-data/legislation/details-index-bills-'+'a'.repeat(64)+'.json';
 globalThis.fetch=(async()=>{fetches++;return fail?new Response('',{status:503}):Response.json([uuid(1)]);}) as typeof fetch;
 try {
  signedIn=true;expect(await publicLegislationTarget(client,undefined,'bills',uuid(1))).toBeNull();expect(fetches).toBe(0);
  signedIn=false;expect(await publicLegislationTarget(client,undefined,'bills',uuid(1),true)).toBeNull();
  fail=true;await expect(publicLegislationTarget(client,url,'bills',uuid(1))).rejects.toThrow('unavailable');
  fail=false;expect(await publicLegislationTarget(client,url,'bills',uuid(1))).toBe(`/records/bills/${uuid(1)}/`);
  expect(await publicLegislationTarget(client,url,'bills',uuid(2))).toBeNull();expect(fetches).toBe(2);
  authError=true;await expect(publicLegislationTarget(client,url,'bills',uuid(1))).rejects.toThrow('auth failed');
  authError=false;await expect(publicLegislationTarget(client,url,'legislative_votes',uuid(1))).rejects.toThrow('index');
 }finally{globalThis.fetch=before;}
});
test('static detail pages validate URLs, status and public rows without backend fallback',async()=>{
 const before=globalThis.fetch;let response=Response.json([row(1)]);
 globalThis.fetch=(async()=>response.clone()) as typeof fetch;
 try {
  expect(await readDetailPage('/directory-data/legislation/details-test.json')).toEqual([row(1)]);
  await expect(readDetailPage('https://evil.test/data.json')).rejects.toThrow('URL');
  response=new Response('',{status:404});await expect(readDetailPage('/directory-data/legislation/details-test.json')).rejects.toThrow('404');
  response=Response.json([row(1,{visibility:'unlisted'})]);await expect(readDetailPage('/directory-data/legislation/details-test.json')).rejects.toThrow('Invalid');
 }finally{globalThis.fetch=before;}
});

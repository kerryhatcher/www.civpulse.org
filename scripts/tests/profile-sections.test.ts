import { expect,test } from 'bun:test';
import { currentCandidacies,currentOfficeTerms,emptyProfileSections,groupProfileVotes,profileToday } from '../../apps/web/src/lib/profile-sections';
import { loadProfileSectionBuildData } from '../../apps/web/src/lib/profile-section-build-data';

test('profile date groups follow New York dates and preserve year-only service rules',()=>{
 expect(profileToday(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
 const terms=currentOfficeTerms([
  {starts_on:'2027-01-01',ends_on:null}, {starts_on:'2020-01-01',ends_on:'2026-12-31',ends_on_precision:'year'},
  {starts_on:'2020-01-01',ends_on:'2026-12-31',ends_on_precision:'day'},
 ] as Parameters<typeof currentOfficeTerms>[0],'2026-10-26');
 expect(terms.map(t=>t.service_status)).toEqual(['upcoming','former','current']);
 const races=currentCandidacies([{election_name:"Election",office:"Office",contest_id:"a",election_date:'2026-11-03',status:'running'},{election_name:"Election",office:"Office",contest_id:"b",election_date:'2026-11-03',status:'won'}] as Parameters<typeof currentCandidacies>[0],'2026-11-04');
 expect(races.every(r=>!r.is_current)).toBe(true);
});

test('static legislative grouping counts distinct votes per bill and filters before picking the latest choice',()=>{
 const snapshot=emptyProfileSections();
 const bill={id:'bill',identifier:'HB 1',title:'Public safety'};
 snapshot.legislativeVotes=[
  {id:'attendance-linked',vote_id:'attendance-linked',occurred_on:'2026-02-03',category:'attendance',term_id:'term',bills:[bill]},
  {id:'attendance-unlinked',vote_id:'attendance-unlinked',occurred_on:'2026-02-03',category:'attendance',term_id:'term',bills:[]},
  {id:'a',vote_id:'vote-new',occurred_on:'2026-02-02',category:'passage',term_id:'term',bills:[bill,bill]},
  {id:'b',vote_id:'vote-old',occurred_on:'2026-02-01',category:'amendment',term_id:'term',bills:[bill]},
  {id:'c',vote_id:'unlinked',occurred_on:'2026-01-01',category:'passage',term_id:'other',bills:[]},
 ];
 expect(groupProfileVotes(snapshot,{}).rows.map(r=>[r.vote_id,r.vote_count])).toEqual([['vote-new',2],['unlinked',1]]);
 expect(groupProfileVotes(snapshot,{p_category:'amendment'}).rows[0]).toMatchObject({vote_id:'vote-old',vote_count:1});
 expect(groupProfileVotes(snapshot,{p_bill_query:'public%'}).total).toBe(1);
 expect(groupProfileVotes(snapshot,{p_term_id:'missing'}).total).toBe(0);
 expect(groupProfileVotes(snapshot,{p_offset:1,p_limit:1}).rows[0].vote_id).toBe('unlinked');
 expect(groupProfileVotes(snapshot,{p_category:'attendance'})).toEqual({total:0,rows:[]});
 expect(snapshot.legislativeVotes.filter(v=>v.category==='attendance')).toHaveLength(2);
});

test('profile exports page sequentially, bound concurrency and share office terms with organizations',async()=>{
 let active=0,peak=0;const offsets:number[]=[];
 const client={rpc:async(name:string,args:Record<string,unknown>)=>{
  peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,1));active--;
  if(name==='export_public_legislation_page')return {data:{rows:[],total:0},error:null};
  if(args.p_section!=='offices')return {data:[],error:null};
  const offset=Number(args.p_offset);offsets.push(offset);
  return {data:Array.from({length:Math.min(500,501-offset)},(_,i)=>({owner_id:'person',data:{id:`term-${offset+i}`,organization_id:'org',starts_on:'2020-01-01',office_name:'Office',person_name:'Person'}})),error:null};
 }} as unknown as Parameters<typeof loadProfileSectionBuildData>[0];
 const data=await loadProfileSectionBuildData(client);
 expect(data.people.get('person')?.officeTerms).toHaveLength(501);
 expect(data.organizations.get('org')?.officeTerms).toHaveLength(501);
 expect(offsets).toEqual([0,500]);expect(peak).toBe(3);
});

test('configured backend failures stop the public profile export',async()=>{
 const client={rpc:async()=>({error:{message:'unavailable'},data:null})} as unknown as Parameters<typeof loadProfileSectionBuildData>[0];
 await expect(loadProfileSectionBuildData(client)).rejects.toThrow('unavailable');
});

import {expect,test} from 'bun:test';
import {searchDirectory,browsePeople,orderElections} from '../../apps/web/src/lib/directories';
import {assembleDirectoryData} from '../../apps/web/src/lib/directory-build-data';
import {readRows} from '../../apps/web/src/lib/profile-build-data';
import type {Person} from '../../apps/web/src/lib/people';
import type {Organization} from '../../apps/web/src/lib/organizations';
import type {Election} from '../../apps/web/src/lib/elections';
const person=(id:string,visibility='public',full_name=id)=>({id,slug:id,full_name,visibility,kind:'candidate',title:'Council member',description:'Education policy',image_path:null}) as Person;
const org={id:'org',slug:'org',name:'Community council',description:'Schools',logo_path:null} as Organization;
const election=(id:string,visibility='public',election_date='2026-11-03')=>({id,slug:id,name:id,visibility,election_date,kind:'general',description:null,organization_id:'org'}) as Election;

test('static search preserves words, English endings, phrases, OR, exclusions, literal punctuation and exact-title priority',()=>{
 const entries=['School board','School boards education','County council','County education board'].map(name=>({record:{name},search:name}));
 expect(searchDirectory(entries,'schools').map(row=>row.name)).toEqual(['School board','School boards education']);
 expect(searchDirectory(entries,'"school board" -education').map(row=>row.name)).toEqual(['School board']);
 expect(searchDirectory(entries,'council OR schools').length).toBe(3);
 expect(searchDirectory(entries,'county education').length).toBe(1);
 expect(searchDirectory(entries,'council -county')).toEqual([]);
 expect(searchDirectory(entries,'[')).toEqual([]);
 expect(()=>searchDirectory(entries,'x'.repeat(501))).toThrow('500');
});

test('public directory assembly removes hidden parents, people and search-only relationship facts',()=>{
 const data=assembleDirectoryData({people:[person('public'),person('private','private'),person('unlisted','unlisted')],organizations:[org],elections:[election('public-election'),election('private-election','private'),election('unlisted-election','unlisted')]},{
 affiliations:[{person_id:'public',organization_id:'org',role:'Treasurer'},{person_id:'private',organization_id:'org',role:'secret-role'}],
 contests:[{id:'contest',election_id:'public-election',office:'Mayor',district:null,seat:null,description:'Mayoral race'},{id:'hidden-contest',election_id:'private-election',office:'secret-office',district:null,seat:null,description:null}],
 candidates:[{contest_id:'contest',person_id:'public',party:'Green',status:'running',is_write_in:true},{contest_id:'contest',person_id:'private',party:'secret-party',status:'won',is_write_in:false},{contest_id:'hidden-contest',person_id:'public',party:'secret-party',status:'won',is_write_in:false}],
 questions:[{election_id:'public-election',title:'Bond',question_text:'School buildings',description:null,jurisdiction:'Bibb',choices:['Yes','No']},{election_id:'private-election',title:'secret-question',question_text:'secret-text',description:null,jurisdiction:null,choices:[]}],
 });
 const serialized=JSON.stringify(data);
 for(const hidden of ['private','unlisted','secret-','hidden-contest']) expect(serialized).not.toContain(hidden);
 expect(data.people).toHaveLength(1);expect(data.elections).toHaveLength(1);
 expect(searchDirectory(data.organizations,'treasurer')).toHaveLength(1);
 for(const query of ['mayor','green','write-in','buildings','bibb','community']) expect(searchDirectory(data.elections,query)).toHaveLength(1);
 expect(data.people[0].record).not.toHaveProperty('email');
});

test('people paginate completely, filter kinds and sort first/last names ignoring suffixes',()=>{
 const entries=Array.from({length:55},(_,i)=>({record:person(String(i),'public',`Name${String(i).padStart(2,'0')} Surname${String(54-i).padStart(2,'0')}${i===54?', Jr.':''}`),search:'education'}));
 const pages=[0,24,48].map(offset=>browsePeople(entries,'education','candidate','first_asc',offset));
 expect(pages.map(page=>page.people.length)).toEqual([24,24,7]);expect(new Set(pages.flatMap(page=>page.people.map(person=>person.id))).size).toBe(55);
 expect(browsePeople(entries,'','','last_asc').people[0].id).toBe('54');
 expect(browsePeople(entries,'','','last_desc').people[0].id).toBe('0');
 expect(browsePeople(entries,'','','first_desc').people[0].id).toBe('54');
 expect(browsePeople(entries,'','other','first_asc').total).toBe(0);
});

test('upcoming/past elections reorder with the current date without rebuilding',()=>{
 const rows=[election('old','public','2026-01-01'),election('near','public','2026-10-26'),election('far','public','2026-11-03')];
 expect(orderElections(rows,'2026-10-26').map(row=>row.id)).toEqual(['near','far','old']);
 expect(orderElections(rows,'2026-10-27').map(row=>row.id)).toEqual(['far','near','old']);
});

test('build reads every stable page beyond the Data API cap and fails on partial read errors',async()=>{
 const offsets:number[]=[];let fail=false;
 const client={from:()=>({select:()=>({order(){return this;},range:async(start:number,end:number)=>{offsets.push(start);return {data:Array.from({length:Math.max(0,Math.min(end+1,1201)-start)},(_,i)=>({id:start+i})),error:fail&&start===500?{message:'offline'}:null};}})})} as unknown as Parameters<typeof readRows>[0];
 expect(await readRows(client,'organizations','id',['id'])).toHaveLength(1201);expect(offsets).toEqual([0,500,1000]);
 fail=true;await expect(readRows(client,'organizations','id',['id'])).rejects.toThrow('offline');
});

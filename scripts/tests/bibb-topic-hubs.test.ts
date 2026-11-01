import {expect,test} from 'bun:test';
import {projectBibbTopics,BIBB_TOPIC_LINK_REVIEW,BIBB_TOPIC_RESOURCES,type TopicInputs} from '../../apps/web/src/lib/bibb-topic-hubs';

test('topic projection uses curated public relationships, preserves dates/roles and bounds previews',()=>{
 const input={organizations:[{id:'boe',slug:'bibb-county-board-of-elections',name:'Recorded elections office'},{id:'other',slug:'elsewhere',name:'SECRET unrelated'}],
  people:new Map([['boe',[{person:{full_name:'Recorded affiliation',slug:'recorded',visibility:'public'},role:'Historical role'},{person:{full_name:'SECRET person',visibility:'private'},role:'SECRET'}]]]),
  maps:[{slug:'commissioners',name:'Recorded districts',visibility:'public'},{slug:'voting',name:'SECRET map',visibility:'private'}],
  elections:Array.from({length:5},(_,index)=>({election:{id:'e'+index,slug:'e'+index,name:'Recorded election '+index,election_date:'2026-11-0'+(index+1),visibility:index===4?'private':'public',organization_id:'boe'},contests:Array.from({length:8},()=>({id:'contest',office:'Recorded contest',candidates:[{person:{full_name:'Public candidate',slug:'candidate',visibility:'public'}},{person:{full_name:'SECRET candidate',visibility:'unlisted'}}]}))})),events:[],
 } as unknown as TopicInputs;
 const base={id:'meeting',title:'Recorded meeting',starts_at:'2026-10-01T12:00:00Z',visibility:'public',calendar_visibility:'public',organization_id:'boe',is_meeting:true,election_id:null};
 input.events=[base,{...base,id:'hidden',title:'SECRET event',calendar_visibility:'private'},{...base,id:'other',title:'SECRET unrelated',organization_id:'other'},
  {...base,id:'date',is_meeting:false,election_id:'e3',election_visibility:'public',title:'Recorded deadline'},
  {...base,id:'hidden-date',is_meeting:false,election_id:'e3',election_visibility:'unlisted',title:'SECRET date'}] as TopicInputs['events'];
 const data=projectBibbTopics(input);
 expect(data.elections.map(election=>election.id)).toEqual(['e3','e2','e1']);expect(data.elections[0].contests).toHaveLength(6);expect(data.elections[0].contestCount).toBe(8);
 expect(data.elections[0].contests[0].candidates).toEqual([{name:'Public candidate',slug:'candidate'}]);
 expect(data.organizations[0].people).toEqual([{name:'Recorded affiliation',slug:'recorded',role:'Historical role'}]);
 expect(data.meetings.map(event=>event.id)).toEqual(['meeting']);expect(data.dates.map(event=>event.id)).toEqual(['date']);expect(data.maps).toHaveLength(1);expect(JSON.stringify(data)).not.toContain('SECRET');
 expect(projectBibbTopics({organizations:[],people:new Map(),maps:[],elections:[],events:[]})).toEqual({organizations:[],elections:[],maps:[],meetings:[],dates:[]});
});

const dist=process.env.BIBB_TOPICS_TEST_DIST;
test.skipIf(!dist)('distinct pilot guides are discoverable, canonical/indexable, sitemap-listed and local links resolve',async()=>{
 const hub=await Bun.file(`${dist}/counties/bibb/index.html`).text();
 const files=await Array.fromAsync(new Bun.Glob('sitemap-*.xml').scan({cwd:dist!,absolute:false}));
 const sitemap=(await Promise.all(files.map(file=>Bun.file(`${dist}/${file}`).text()))).join('');const titles:string[]=[];
 for(const topic of ['government','elections','property-taxes','districting']){
  const path=`/counties/bibb/${topic}/`,html=await Bun.file(`${dist}${path}index.html`).text();
  expect(hub).toContain(path);expect(sitemap).toContain(`https://www.civpulse.org${path}`);expect(html).toContain(`<link rel="canonical" href="https://www.civpulse.org${path}"`);expect(html).not.toContain('content="noindex, follow"');
  expect(html).toContain(`datetime="${BIBB_TOPIC_LINK_REVIEW}"`);expect(html).toContain('editor publishing a guide change');titles.push(html.match(/<title>(.*?)<\/title>/)?.[1]??'');
  for(const match of html.matchAll(/href="(\/(?!\/)[^"?#]*)(?:[?#][^"]*)?"/g)){const href=match[1];if(href.endsWith('/'))expect(await Bun.file(`${dist}${href}index.html`).exists(),`${path} -> ${href}`).toBe(true);}
 }
 expect(new Set(titles).size).toBe(4);
 const government=await Bun.file(`${dist}/counties/bibb/government/index.html`).text(),elections=await Bun.file(`${dist}/counties/bibb/elections/index.html`).text();
 expect(government).toContain(BIBB_TOPIC_RESOURCES.commission);expect(government).toContain(BIBB_TOPIC_RESOURCES.agendas);
 expect(elections).toContain(BIBB_TOPIC_RESOURCES.elections);expect(elections).toContain(BIBB_TOPIC_RESOURCES.stateCalendar);expect(elections).toContain(BIBB_TOPIC_RESOURCES.sampleBallot);
 const taxes=await Bun.file(`${dist}/counties/bibb/property-taxes/index.html`).text(),districting=await Bun.file(`${dist}/counties/bibb/districting/index.html`).text();
 for(const url of [BIBB_TOPIC_RESOURCES.assessors,BIBB_TOPIC_RESOURCES.assessmentNotices,BIBB_TOPIC_RESOURCES.assessmentAppeals,BIBB_TOPIC_RESOURCES.taxProperty,BIBB_TOPIC_RESOURCES.taxPayments])expect(taxes).toContain(url);
 for(const url of [BIBB_TOPIC_RESOURCES.apportionment,BIBB_TOPIC_RESOURCES.reapportionment,BIBB_TOPIC_RESOURCES.redistrictingProcess])expect(districting).toContain(url);
 expect(taxes).not.toMatch(/\b(?:45 days|40%|9\.575)\b/);expect(districting).toContain('does not designate any plan as legally current');
});

import {expect,test} from 'bun:test';
import {emptyProfileSections} from '../../apps/web/src/lib/profile-sections';
import {profileEvidence,profileHistoryHref,PROFILE_EVIDENCE_PAGE_SIZE} from '../../apps/web/src/lib/profile-evidence';
import {replacePublishedEvidence} from '../../apps/web/src/lib/profile-evidence-enhancement';

test('public evidence preserves source precision/roles/choices and excludes hidden related records',()=>{
 const profile=emptyProfileSections();
 profile.officeTerms=[{id:'term',office_name:'Recorded office',district:'District 1',seat:'',person_visibility:'public',person_name:'Recorded name',person_slug:'recorded',organization_name:'Public body',organization_slug:'body',starts_on:'2000-01-01',starts_on_precision:'year',ends_on:null,selection_method:'elected',source_url:'https://source.test/term'}] as typeof profile.officeTerms;
 profile.officeTerms.push({...profile.officeTerms[0],person_visibility:'private',person_name:'SECRET'});
 profile.articles=['public','private','unlisted'].map(visibility=>({id:visibility,title:visibility==='public'?'Visible article':'SECRET',visibility,url:'https://news.test/article',role:'Credited author',fetched_on:'2026-01-01',published_on:null})) as typeof profile.articles;
 profile.candidacies=['public','unlisted','private'].map(election_visibility=>({election_visibility,election_name:election_visibility==='public'?'Recorded election':'SECRET',office:'Office',election_slug:'election',election_date:'2026-11-03',status:'lost',is_write_in:false})) as typeof profile.candidacies;
 profile.votes=[{vote_id:'vote',meeting_id:'meeting',subject:'Recorded motion',choice:'abstain',outcome:null,meeting_title:'Public meeting',starts_at:'2026-01-01T12:00:00Z',organization_name:'Body',description:null}];
 profile.legislativeVotes=[{vote_id:'vote',question:'Recorded question',category:'passage',choice:'yes',occurred_on:'2026-01-01',source_url:'https://source.test/vote',coverage:'partial',bills:[{id:'bill',identifier:'HB 1',title:'Recorded bill'}]}, {vote_id:'attendance',category:'attendance',question:'SECRET'}];
 const sections=profileEvidence(profile,'people');
 expect(sections.offices.rows[0].lines).toContain('2000 – end not recorded');
 expect(sections.articles.rows[0].lines).toContain('Credited author');expect(sections.articles.rows[0].lines).toContain('Publication date: unknown');
 expect(sections.votes.rows[0].lines[0]).toBe('Vote: abstain · Outcome: Not recorded');
 expect(sections['legislative-votes'].rows[0].links).toContainEqual({label:'HB 1: Recorded bill',href:'/records/bills/bill/'});
 expect(JSON.stringify(sections)).not.toContain('SECRET');expect(JSON.stringify(sections)).not.toContain('is_current');
 expect(profileEvidence(profile,'orgs').offices.rows[0].links[0]).toEqual({label:'Recorded name',href:'/people/recorded/'});
 profile.articles[0].url='javascript:alert(1)';expect(profileEvidence(profile,'people').articles.rows).toHaveLength(0);
});

test('successful enhancement hides only its own fallback and repeated pagination cannot duplicate it',()=>{
 const evidence={hidden:false};let selector='';const root={querySelector:(value:string)=>{selector=value;return evidence}} as unknown as HTMLElement;
 replacePublishedEvidence(root);expect(evidence.hidden).toBe(true);expect(selector).toBe('[data-public-profile-evidence]');
 replacePublishedEvidence(root);expect(evidence.hidden).toBe(true);replacePublishedEvidence(null);
});

const dist=process.env.PROFILE_EVIDENCE_TEST_DIST;
const decode=(value:string)=>value.replace(/&#(\d+);|&#x([\da-f]+);|&(amp|lt|gt|quot|apos);/gi,(_,d,h,n)=>d||h?String.fromCodePoint(parseInt(d||h,d?10:16)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[n.toLowerCase() as 'amp']));
const titles=(html:string)=>[...html.matchAll(/<h3\b[^>]*data-profile-evidence-title[^>]*>(.*?)<\/h3>/gs)].map(match=>decode(match[1]));
test.skipIf(!dist)('all public profile HTML and history pages match their exact public snapshot, with bounded rows',async()=>{
 let owners=0,pages=0;
 for(const kind of ['people','orgs'] as const)for await(const file of new Bun.Glob(`${kind}/*/index.html`).scan({cwd:dist!,absolute:false})){
  const html=await Bun.file(`${dist}/${file}`).text();const url=html.match(/data-profile-snapshot="([^"]+)"/)?.[1];if(!url)continue;
  const profile=await Bun.file(`${dist}${url}`).json();if(profile.legislativeVotesUrl)profile.legislativeVotes=await Bun.file(`${dist}${profile.legislativeVotesUrl}`).json();
  const sections=profileEvidence(profile,kind),slug=file.split('/')[1];
  const keys=kind==='people'?['offices','legislative-votes','votes','candidacies','articles'] as const:['offices','articles'] as const;
  expect(titles(html),file).toEqual(keys.flatMap(key=>sections[key].rows.slice(0,sections[key].initial).map(row=>row.title)));
  for(const key of keys){const section=sections[key];if(section.rows.length<=section.initial)continue;const all:string[]=[];
   const count=Math.ceil(section.rows.length/PROFILE_EVIDENCE_PAGE_SIZE);
   for(let page=1;page<=count;page++){const href=profileHistoryHref(kind,slug,key,page),body=await Bun.file(`${dist}${href}index.html`).text();const rows=titles(body);expect(rows.length).toBeLessThanOrEqual(PROFILE_EVIDENCE_PAGE_SIZE);expect(body).toContain(`<link rel="canonical" href="https://www.civpulse.org${href}"`);expect(body).not.toContain('content="noindex, follow"');all.push(...rows);if(page<count)expect(body).toContain(profileHistoryHref(kind,slug,key,page+1));pages++;}
   expect(all).toEqual(section.rows.map(row=>row.title));
  }owners++;
 }
 expect(owners).toBeGreaterThan(0);console.log({owners,historyPages:pages});
});

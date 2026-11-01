import {expect,test} from 'bun:test';
import {biographySources,biographyCitations,electionSources,provenanceDates,recordSourceUrl,meetingVoteScope,legislativeVoteScope,voteDetailScope} from '../../apps/web/src/lib/record-provenance';
import type {ElectionDetail} from '../../apps/web/src/lib/elections';

test('publication and retrieval are separate source facts and never imply verification',()=>{
 expect(provenanceDates('2026-10-01','2026-10-20')).toEqual([
  {label:'Source publication date',value:'2026-10-01'},{label:'Source retrieval date',value:'2026-10-20'},{label:'Last verified',value:'Unknown'},
 ]);
 expect(provenanceDates().every(fact=>fact.value==='Unknown')).toBe(true);
 expect(provenanceDates('2026-02-30','invalid').every(fact=>fact.value==='Unknown')).toBe(true);
 expect(provenanceDates(null,'2026-10-20').at(-1)?.value).toBe('Unknown');
 for(const scope of [meetingVoteScope,legislativeVoteScope]){expect(scope).toContain('not absences or opposition');expect(scope).toContain('not a participation denominator');}
 expect(legislativeVoteScope).toContain('Attendance roll calls are excluded');
 expect(voteDetailScope('attendance')).toBeUndefined();expect(voteDetailScope('passage')).toBe(legislativeVoteScope);
});

test('biography provenance uses rendered public citations only, with safe URLs and reference links',()=>{
 const description='Cited [official biography](https://example.test/bio?a=1&b=2). [Again][source].\n\n[source]: https://example.test/bio?a=1&b=2\n\n[bad](javascript:alert%281%29) [mail](mailto:a@example.test) <a href="https://injected.test/">fake</a>';
 expect(biographySources({visibility:'public',description})).toEqual([{label:'Cited biography source: example.test',url:'https://example.test/bio?a=1&b=2'}]);
 expect(biographySources({visibility:'private',description})).toEqual([]);expect(biographySources({visibility:'unlisted',description})).toEqual([]);
 expect(biographyCitations(description)).toEqual(biographySources({visibility:'public',description}));expect(biographyCitations(null)).toEqual([]);
 expect(biographySources({visibility:'public',description:'No source recorded.'})).toEqual([]);
 for(const url of ['javascript:alert(1)','data:text/html,bad'])expect(recordSourceUrl(url)).toBe(null);
 const credentialed=new URL('https://example.test/');credentialed.username='fixture-user';credentialed.password='fixture-password';expect(recordSourceUrl(credentialed.href)).toBe(null);
});

test('election source labels retain claim context and exclude hidden dates/parents',()=>{
 const detail={election:{visibility:'public'},dates:[{visibility:'public',title:'Registration deadline',url:'https://source.test/deadline'},{visibility:'private',title:'SECRET',url:'https://secret.test/'},{visibility:'unlisted',title:'SECRET',url:'https://secret.test/'}],ballot_questions:[{title:'Question 1',source_url:'https://source.test/ballot'},{title:'Unsafe',source_url:'javascript:alert(1)'}]} as ElectionDetail;
 expect(electionSources(detail)).toEqual([{label:'Date/deadline source: Registration deadline',url:'https://source.test/deadline'},{label:'Ballot question source: Question 1',url:'https://source.test/ballot'}]);
 expect(electionSources({...detail,election:{...detail.election,visibility:'private'}})).toEqual([]);
});

const dist=process.env.PROVENANCE_TEST_DIST;
test.skipIf(!dist)('built public person/election provenance stays readable without scripts and distinguishes factual dates',async()=>{
 let people=0,elections=0;
 for(const kind of ['people','elections'])for await(const path of new Bun.Glob(`${kind}/*/index.html`).scan({cwd:dist!,absolute:false})){
  const html=await Bun.file(`${dist}/${path}`).text();if(!html.includes('record-provenance'))continue;
  expect(html,path).toContain('Source publication date');expect(html,path).toContain('Source retrieval date');expect(html,path).toContain('Last verified');
  expect(html.match(/<dt[^>]*>Last verified<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/)?.[1],path).toBe('Unknown');
  expect(/<dd[^>]*>\d{4}-\d{2}-\d{2}[^<]*<\/dd>/.test(html),path).toBe(false);
  if(kind==='people'){expect(html).toContain('Biography sources and verification');people++;}else{expect(html).toContain('Election date (not a verification date)');elections++;}
 }
 expect(people).toBeGreaterThan(0);expect(elections).toBeGreaterThan(0);console.log({people,elections});
});

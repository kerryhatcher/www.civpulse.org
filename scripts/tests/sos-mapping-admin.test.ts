import { expect, test } from 'bun:test';
import { describeMappingBatch, parseMappingBatch, sameMapping } from '../../apps/web/src/lib/sos-mapping-admin';
import type { ElectionDetail } from '../../apps/web/src/lib/elections';
const person = '03600000-0000-4000-8000-000000000002', contest = '03600000-0000-4000-8000-000000000003', question = '03600000-0000-4000-8000-000000000004';
const row = { jurisdiction_id:'011',source_contest_id:'race',contest_id:contest,choices:[{source_choice_id:'source-person',person_id:person}] };
test('batch requires explicit, unique source/target identities and compatible choice types', () => {
  expect(parseMappingBatch(JSON.stringify([row]))).toEqual([row]);
  for (const rows of [[],[row,row],[{...row,question_id:question}],[{...row,election_id:contest}],[{...row,choices:[{source_choice_id:'source-person',choice_label:'Yes'}]}],[{...row,choices:[row.choices[0],row.choices[0]]}],[{...row,jurisdiction_id:' 011'}],[{...row,source_contest_id:''}],[{...row,choices:[]}],[{...row,contest_id:null,question_id:question,choices:[{source_choice_id:'yes',choice_label:'Yes',person_id:person}]}]]) expect(() => parseMappingBatch(JSON.stringify(rows))).toThrow();
  expect(() => parseMappingBatch(' '.repeat(2097153))).toThrow('2 MiB');
  expect(() => parseMappingBatch(JSON.stringify(Array(1001).fill(row)))).toThrow('1,000');
});
test('preview checks exact jurisdiction/race/choice and canonical candidate membership, without name inference', () => {
  const ballot = {contests:[{id:contest,office:'Verified office',district:'District 2',candidates:[{person:{id:person,full_name:'Verified person'}}]}],ballot_questions:[{id:question,title:'Question',question_text:'Full wording',choices:['Yes','No']}]} as ElectionDetail;
  const sources = new Map([['011',{name:'Bibb County',items:[{data:{id:'race',name:'Source race',ballotOptions:[{id:'source-person',name:'Source person'}]}}]}]]);
  expect(describeMappingBatch([row],ballot,sources)).toContain('Source person [source-person] → Verified person');
  for (const invalid of [{...row,jurisdiction_id:'other'},{...row,source_contest_id:'different'},{...row,choices:[{source_choice_id:'Source person',person_id:person}]},{...row,choices:[{source_choice_id:'source-person',person_id:question}]}]) expect(() => describeMappingBatch([invalid],ballot,sources)).toThrow();
  const q = {jurisdiction_id:'011',source_contest_id:'race',question_id:question,choices:[{source_choice_id:'source-person',choice_label:'Yes'}]};
  expect(describeMappingBatch([q],ballot,sources)).toContain('Full wording');
  expect(() => describeMappingBatch([{...q,choices:[{source_choice_id:'source-person',choice_label:'yes'}]}],ballot,sources)).toThrow();
});
test('readback compares all IDs and choice mappings while allowing database choice ordering and nullable keys', () => {
  const second = {source_choice_id:'second',person_id:question};
  const a = {...row,choices:[...row.choices,second]};
  expect(sameMapping(a,{...a,question_id:null,choices:[second,...row.choices]})).toBe(true);
  expect(sameMapping(a,{...a,choices:[second]})).toBe(false);
  expect(sameMapping(a,{...a,jurisdiction_id:'012'})).toBe(false);
});

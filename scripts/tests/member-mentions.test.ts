import { expect, test } from 'bun:test';
import { memberMentions, memberProfileHref } from '../../apps/web/src/lib/member-mentions';

const members = [
  {person_id: 'henry', full_name: 'Henry C. Ficklin'},
  {person_id: 'lisa', full_name: 'Lisa W. Boyd'},
  {person_id: 'james', full_name: 'James M. Freeman'},
];
test('links exact names, short names and compound surnames without changing text', () => {
  const text = 'Henry C. Ficklin voted no. Henry Ficklin seconded Lisa Garrett-Boyd. James Freeman voted yes.';
  expect(memberMentions(text, members).map(m => [text.slice(m.start,m.end), m.personId])).toEqual([
    ['Henry C. Ficklin','henry'],['Henry Ficklin','henry'],['Lisa Garrett-Boyd','lisa'],['James Freeman','james'],
  ]);
});
test('repeated participants do not duplicate links; partial names and ambiguous names remain text', () => {
  expect(memberMentions('Henry C. Ficklin', [...members,...members])).toHaveLength(1);
  expect(memberMentions('Henry Fickliner, Henry or Ficklin',members)).toEqual([]);
  const ambiguous = [...members,{person_id:'other', full_name:'Henry D. Ficklin'}];
  expect(memberMentions('Henry Ficklin',ambiguous)).toEqual([]);
  expect(memberMentions('Henry C. Ficklin',ambiguous)).toHaveLength(1);
  expect(memberMentions('henry ficklin',[...members,{person_id:'other',full_name:'HENRY D. FICKLIN'}])).toEqual([]);
  expect(memberMentions('Lisa Garrett-Boyd',[...members,{person_id:'other',full_name:'Lisa Garrett-Boyd'}])).toEqual([]);
  expect(memberMentions('Henry Ficklin',[...members,{person_id:'other',full_name:'Henry Ficklin'}])).toEqual([]);
});
test('UUID viewer links encode IDs and never interpret input as a URL', () => {
  expect(memberProfileHref('x&next=https://example.test')).toBe('/people/view/?id=x%26next%3Dhttps%3A%2F%2Fexample.test');
});

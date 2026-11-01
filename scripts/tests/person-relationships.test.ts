import { expect, test } from 'bun:test';
import { groupPublicPersonRelationships } from '../../apps/web/src/lib/person-relationships';
import type { Person } from '../../apps/web/src/lib/people';

test('public relationship projection gates both endpoints and normalizes reciprocal labels in stable name order', () => {
  const people = [
    { id:'a',slug:'a',full_name:'Owner',visibility:'public' },
    { id:'b',slug:'b',full_name:'Zed',visibility:'public' },
    { id:'c',slug:'c',full_name:'Alpha',visibility:'public' },
    { id:'u',slug:'hidden-marker',full_name:'Unlisted marker',visibility:'unlisted' },
    { id:'p',slug:'private-marker',full_name:'Private marker',visibility:'private' },
  ] as Person[];
  const link=(target:string)=>({ id:`link-${target}`,person_id:'a',related_person_id:target,relationship:'Child of <script>',reverse_relationship:'Parent of',source_url:'https://example.test/source' });
  const rows=groupPublicPersonRelationships(people,['b','u','p','missing','c'].map(link));
  expect(rows.get('a')?.map(r=>r.related_person_id)).toEqual(['c','b']);
  expect(rows.get('b')?.[0].relationship).toBe('Parent of');
  expect(rows.get('b')?.[0].reverse_relationship).toBe('Child of <script>');
  expect(rows.get('b')?.[0].related_person_id).toBe('a');
  expect(rows.get('b')?.[0].source_url).toBe('https://example.test/source');
  expect(JSON.stringify([...rows])).not.toMatch(/hidden-marker|Unlisted marker|private-marker|Private marker|link-missing|link-u|link-p/);
  expect(groupPublicPersonRelationships(people,[]).size).toBe(0);
});

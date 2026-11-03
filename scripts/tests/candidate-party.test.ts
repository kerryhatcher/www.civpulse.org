import { expect, test } from 'bun:test';
import { candidatePartyTone } from '../../apps/web/src/lib/candidate-party';
test('party bars follow explicit curated labels and respect nonpartisan races', () => {
  for (const label of ['R', 'Rep.', 'Republican', 'Republican Party', 'GOP']) expect(candidatePartyTone(label, true)).toBe('republican');
  for (const label of ['D', 'Dem.', 'Democrat', 'Democratic', ' Democratic Party ']) expect(candidatePartyTone(label, true)).toBe('democratic');
  for (const label of ['Independent', 'I', 'Libertarian', 'Green']) expect(candidatePartyTone(label, true)).toBe('other');
  for (const label of [null, undefined, '', ' ', 'NP', 'Non-Partisan', 'Nonpartisan', 'No party affiliation']) expect(candidatePartyTone(label, true)).toBe('neutral');
  for (const label of ['Republican', 'Democratic', 'Independent']) expect(candidatePartyTone(label, false)).toBe('neutral');
});

import { expect, test } from 'bun:test';
import { sosResultsFingerprint } from '../../apps/web/src/lib/sos-results-change';
import type { SosScope } from '../../apps/web/src/lib/sos-results-reader';
const scope = (): SosScope => ({ schema_version: 1, election_id: 'e', snapshot_id: 'a', jurisdiction: { id: '011', name: 'Bibb', reportingStatuses: ['Partial'], url: '/a', item_count: 1 }, items: [{ jurisdiction_index: 0, item_index: 0, data: { id: 'race', name: 'Race', createdAt: 'old', ballotOptions: [{ id: 'a', name: 'A', voteCount: null }, { id: 'b', name: 'B', voteCount: 0 }] } }] });
test('semantic fingerprints ignore transport, timestamps, object keys and ordering', () => {
  const a = scope(), b = scope();
  b.snapshot_id = 'b'; b.jurisdiction.url = '/b'; b.items[0].item_index = 4;
  b.items[0].data.createdAt = 'new';
  (b.items[0].data.ballotOptions as unknown[]).reverse();
  expect(sosResultsFingerprint(a)).toBe(sosResultsFingerprint(b));
});
test('counts, unknown versus zero, source corrections and reporting statuses change fingerprint', () => {
  for (const mutate of [
    (s: SosScope) => { (s.items[0].data.ballotOptions as any[])[0].voteCount = 0; },
    (s: SosScope) => { s.jurisdiction.reportingStatuses = ['Complete']; },
    (s: SosScope) => { s.items[0].data.name = 'Corrected race'; },
    (s: SosScope) => { (s.items[0].data.ballotOptions as any[]).pop(); },
  ]) { const changed = scope(); mutate(changed); expect(sosResultsFingerprint(scope())).not.toBe(sosResultsFingerprint(changed)); }
});

test('unknown source arrays retain meaningful order', () => {
  const a = scope(), b = scope();
  a.items[0].data.rankedChoices = ['a', 'b'];
  b.items[0].data.rankedChoices = ['b', 'a'];
  expect(sosResultsFingerprint(a)).not.toBe(sosResultsFingerprint(b));
});

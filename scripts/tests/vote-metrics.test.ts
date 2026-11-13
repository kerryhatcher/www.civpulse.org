import { describe, expect, test } from 'bun:test';
import { voteMetrics } from '../../apps/web/src/lib/vote-metrics';
describe('one contest vote metrics', () => {
  test('uses all source choices, including choices without reviewed mappings', () => {
    expect(voteMetrics(125, [125, 100]).percentLabel).toBe('55.56%');
    expect(voteMetrics(100, [125, 100]).percentLabel).toBe('44.44%');
  });
  test('retains reported zero and distinguishes absent counts', () => {
    expect(voteMetrics(0, [0, 0])).toMatchObject({ votesLabel: '0', percentLabel: '0.00%' });
    expect(voteMetrics(undefined, [0, 0])).toMatchObject({ votesLabel: 'Not available', percentLabel: 'Not available' });
    expect(voteMetrics()).toMatchObject({ votesLabel: 'Not available', percentLabel: 'Not available' });
  });
  test('incomplete or unsafe denominators cannot produce misleading shares', () => {
    for (const bad of [undefined, null, -1, 0.1, NaN, Infinity, '10']) {
      expect(voteMetrics(10, [10, bad])).toMatchObject({ votesLabel: '10', percent: null });
      expect(voteMetrics(bad, [10, 10]).votes).toBeNull();
    }
    expect(voteMetrics(10, [Number.MAX_SAFE_INTEGER, 10]).percent).toBeNull();
    expect(voteMetrics(11, [10]).percent).toBeNull();
  });
});

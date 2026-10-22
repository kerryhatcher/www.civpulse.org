import { describe, expect, test } from 'bun:test';
import { civicDate, electionCalloutStart, isElectionCalloutActive } from '../apps/web/src/lib/election-callout';

describe('homepage election window', () => {
  test('starts exactly seven calendar days before early voting, across DST', () => {
    expect(electionCalloutStart('2026-11-05')).toBe('2026-10-29');
    expect(electionCalloutStart('2027-01-04')).toBe('2026-12-28');
  });
  test('includes opening day and Election Day, excludes dates outside the window', () => {
    const active = (today: string) => isElectionCalloutActive('2026-10-05', '2026-11-03', today);
    expect(active('2026-10-04')).toBe(false);
    expect(active('2026-10-05')).toBe(true);
    expect(active('2026-10-12')).toBe(true);
    expect(active('2026-11-03')).toBe(true);
    expect(active('2026-11-04')).toBe(false);
  });
  test('uses Eastern calendar days at midnight boundaries', () => {
    expect(civicDate(new Date('2026-11-04T04:59:59Z'))).toBe('2026-11-03');
    expect(civicDate(new Date('2026-11-04T05:00:00Z'))).toBe('2026-11-04');
  });
});

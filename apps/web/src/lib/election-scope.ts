import type { ElectionContest } from './elections';

// Districts on the 2026 Macon-Bibb composite ballot. Keep this display policy
// separate from storage/search, and review it when district boundaries change.
// https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf
const BIBB_DISTRICTS: Record<string, readonly number[]> = {
  'United States House of Representatives': [2, 8],
  'Georgia State Senate': [18, 25, 26],
  'Georgia House of Representatives': [142, 143, 144, 145, 149],
};

export function isBibbJurisdiction(value: string | null): boolean {
  return /\bbibb\b|\bstatewide\b/i.test(value ?? '');
}

export function isBibbContest(contest: Pick<ElectionContest, 'office' | 'district'>): boolean {
  if (isBibbJurisdiction(`${contest.office} ${contest.district ?? ''}`)) return true;
  const district = contest.district?.match(/^(?:Georgia )?District (\d+)$/i);
  return Boolean(district && BIBB_DISTRICTS[contest.office]?.includes(Number(district[1])));
}

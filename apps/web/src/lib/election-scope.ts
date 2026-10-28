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
  return /\bbibb\b|\bstatewide\b/i.test(value ?? '')
    || /^Georgia(?:\s*[—–-]\s*(?:Republican|Democratic) primary ballot)?$/i.test(value?.trim() ?? '');
}

export function isBibbContest(contest: Pick<ElectionContest, 'office' | 'district'> & { description?: string | null }): boolean {
  if (isBibbJurisdiction(`${contest.office} ${contest.district ?? ''}`)) return true;
  // Historical SOS imports retain source ballot labels instead of canonical office names.
  if (contest.description?.includes('https://results.sos.ga.gov/results/public/bibb-county-ga/')) return true;
  if (/^(?:US Senate|Governor|Lieutenant Governor|Secretary of State|Attorney General|Commissioner of Agriculture|Commissioner of Insurance|State School Superintendent|Commissioner of Labor)(?: - (?:Rep|Dem))?$/.test(contest.office)) return true;
  const sourceDistrict = contest.office.match(/^(US House of Representatives|State Senate|State House of Representatives) - District (\d+)(?: - (?:Rep|Dem))?$/);
  const sourceOffices: Record<string, string> = { 'US House of Representatives':'United States House of Representatives', 'State Senate':'Georgia State Senate', 'State House of Representatives':'Georgia House of Representatives' };
  if (sourceDistrict) return BIBB_DISTRICTS[sourceOffices[sourceDistrict[1]]]?.includes(Number(sourceDistrict[2])) ?? false;
  if (contest.office === 'State Senate' && /^District (18|25|26)$/.test(contest.district ?? '')) return true;
  const district = contest.district?.match(/^(?:Georgia )?District (\d+)$/i);
  return Boolean(district && BIBB_DISTRICTS[contest.office]?.includes(Number(district[1])));
}

import { describe, expect, test } from 'bun:test';
import { DEFAULT_COUNTY, GEORGIA_COUNTIES, normalizeCounty, matchesCounty, jurisdictionCounties } from '../../apps/web/src/lib/county-scope';
import { countySearchPage } from '../../apps/web/src/scripts/county-filter';
import { organizationCountyCoverage, mapCountyCoverage } from '../../apps/web/src/data/county-coverage';

describe('county selection and geography policy', () => {
  test('explicit service coverage uses valid counties and keeps regional maps unclassified', () => {
    for (const coverage of [...Object.values(organizationCountyCoverage), ...Object.values(mapCountyCoverage)]) {
      expect(coverage.length).toBeGreaterThan(0);
      for (const fips of coverage) expect(GEORGIA_COUNTIES.some(county => county.fips === fips)).toBe(true);
    }
    expect(organizationCountyCoverage['jones-county-board-of-commissioners']).toEqual(['13169']);
    expect(mapCountyCoverage.libraries).toBeUndefined();
    expect(mapCountyCoverage['state-house']).toBeUndefined();
  });
  test('defaults to Bibb and accepts only the fixed Georgia reference or all', () => {
    expect(GEORGIA_COUNTIES).toHaveLength(159);
    for (const value of [null, undefined, '', 'Bibb', '99999', '<script>']) expect(normalizeCounty(value)).toBe(DEFAULT_COUNTY);
    expect(normalizeCounty('13169')).toBe('13169');
    expect(normalizeCounty('all')).toBe('all');
  });
  test('filters known coverage while retaining statewide, unknown and multi-county records', () => {
    const index = { 'person:local': ['13021'], 'person:shared': ['13021', '13169'], 'election:state': [] };
    expect(matchesCounty(index, 'person', 'local', '13169')).toBe(false);
    expect(matchesCounty(index, 'person', 'local', '13021')).toBe(true);
    expect(matchesCounty(index, 'person', 'shared', '13169')).toBe(true);
    expect(matchesCounty(index, 'person', 'local', 'all')).toBe(true);
    expect(matchesCounty(index, 'person', 'unclassified', '13169')).toBe(true);
    expect(matchesCounty(index, 'election', 'state', '13169')).toBe(true);
    // An ID's county cannot accidentally scope a different record kind.
    expect(matchesCounty(index, 'map', 'local', '13169')).toBe(true);
  });
  test('recognizes explicit county jurisdictions, not arbitrary city/address text', () => {
    expect(jurisdictionCounties('Macon-Bibb County Commission District 1')).toEqual(['13021']);
    expect(jurisdictionCounties('Jones County')).toEqual(['13169']);
    expect(jurisdictionCounties('Bibb County and Jones County')).toEqual(['13021', '13169']);
    expect(jurisdictionCounties('Statewide (Bibb County publisher)')).toEqual([]);
    expect(jurisdictionCounties('Macon')).toEqual([]);
    expect(jurisdictionCounties(null)).toEqual([]);
  });
});

describe('county pagination', () => {
  test('scans excluded source pages and paginates the matching set', async () => {
    const rows = Array.from({ length: 15 }, (_, id) => ({ id: String(id), local: id >= 7 }));
    const calls: number[] = [];
    const page = await countySearchPage(async offset => {
      calls.push(offset); return rows.slice(offset, offset + 3);
    }, 'person', 2, 3, 3, row => row.local);
    expect(page.map(row => row.id)).toEqual(['9', '10', '11']);
    expect(calls).toEqual([0, 3, 6, 9]);
  });
  test('ends after an empty final page instead of looping when no county matches', async () => {
    let calls = 0;
    const page = await countySearchPage(async offset => {
      calls++; return offset < 4 ? [{ id: String(offset) }, { id: String(offset + 1) }] : [];
    }, 'person', 0, 3, 2, () => false);
    expect(page).toEqual([]);
    expect(calls).toBe(3);
  });
  test('propagates a failed source page instead of presenting partial matches', async () => {
    await expect(countySearchPage(async () => { throw new Error('permission denied'); }, 'person', 0, 3)).rejects.toThrow('permission denied');
  });
});

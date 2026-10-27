import counties from '../../../../scripts/data/georgia-counties.json';

export const GEORGIA_COUNTIES = counties;
export const DEFAULT_COUNTY = '13021';
export const COUNTY_SESSION_KEY = 'civicpulse.county';
export type CountyIndex = Record<string, string[]>;

export function normalizeCounty(value: unknown): string {
  return value === 'all' || counties.some(county => county.fips === value) ? value as string : DEFAULT_COUNTY;
}

/** Unknown geography remains discoverable. Empty coverage means statewide. */
export function matchesCounty(index: CountyIndex, kind: string, id: string, county: string): boolean {
  const coverage = index[`${kind}:${id}`];
  return county === 'all' || !coverage?.length || coverage.includes(county);
}

/** Only explicit county jurisdictions are classified; never guess from addresses. */
export function jurisdictionCounties(jurisdiction: string | null): string[] {
  if (!jurisdiction || /\bstatewide\b/i.test(jurisdiction)) return [];
  const text = jurisdiction.toLowerCase();
  return counties.filter(county => {
    const name = `${county.name.toLowerCase()} county`;
    for (let start = text.indexOf(name); start !== -1; start = text.indexOf(name, start + 1)) {
      const before = text[start - 1] ?? '';
      const after = text[start + name.length] ?? '';
      if (!/\w/.test(before) && !/\w/.test(after)) return true;
    }
    return county.name === 'Bibb' && /\bmacon[-– ]bibb\b/i.test(jurisdiction);
  }).map(county => county.fips);
}

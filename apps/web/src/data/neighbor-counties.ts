/** Macon–Bibb 2050 Comprehensive Plan, Map 1-1 (neighboring counties).
 * https://mbpz.org/wp-content/uploads/2022/11/2050-Macon-Bibb-County-Comprehensive-Plan-FINAL_20221027.pdf
 * Coverage uses the separate verified slug registry, never name matching.
 */
export const neighborCounties = [
  { slug: 'crawford', name: 'Crawford', fips: '13079' },
  { slug: 'houston', name: 'Houston', fips: '13153' },
  { slug: 'jones', name: 'Jones', fips: '13169' },
  { slug: 'monroe', name: 'Monroe', fips: '13207' },
  { slug: 'peach', name: 'Peach', fips: '13225' },
  { slug: 'twiggs', name: 'Twiggs', fips: '13289' },
] as const;

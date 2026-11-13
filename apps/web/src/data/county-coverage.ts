/** Explicit service/jurisdiction coverage, keyed by stable record slugs.
 * An absent entry means unknown or statewide, not an empty service area.
 * Keep multi-county coverage together; a county-hub selection alone does not
 * establish exclusive coverage (for example, the regional library map).
 */
export const organizationCountyCoverage: Record<string, string[]> = {
  'bibb-county-board-of-elections': ['13021'],
  'macon-water-authority-district-1': ['13021'],
  'jones-county-board-of-commissioners': ['13169'],
  'state-court-of-fulton-county': ['13121'],
  // City geography: https://dor.georgia.gov/search-county-property-tax-facts-map
  // Atlanta records retain both counties; council district coverage is not a
  // personalized district lookup. Forsyth is the city in Monroe County.
  'mayor-of-atlanta': ['13089', '13121'],
  'atlanta-city-council-at-large-post-3': ['13089', '13121'],
  'atlanta-city-council-district-11': ['13089', '13121'],
  'mayor-of-forsyth': ['13207'],
};

// Source-specific Macon-Bibb map coverage documented in docs/maps.md
// and the public map descriptions. Statewide district maps, the regional
// library map, and the general events map remain available across counties.
export const mapCountyCoverage: Record<string, string[]> = Object.fromEntries([
  'commissioners', 'voting', 'school-board', 'transit', 'recreation', 'rapid',
  'schools', 'school-elementary', 'school-middle', 'school-high',
].map(slug => [slug, ['13021']]));

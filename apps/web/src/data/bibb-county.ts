import ageSnapshot from './bibb-age-2025.json';

export interface CountyStatistic {
  label: string;
  value: string;
  georgia: string;
  period: string;
  code: string;
  source?: string;
  stateSource?: string;
  detail?: string;
  stateDetail?: string;
}

const ageSource = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/asrh/cc-est2025-agesex-13.csv';
const povertySource = 'https://www2.census.gov/programs-surveys/saipe/datasets/2024/2024-state-and-county/est24all.txt';

export function statisticSource(stat: CountyStatistic, state = false): string {
  return (state ? stat.stateSource : stat.source)
    ?? `https://www.census.gov/quickfacts/fact/table/${state ? 'GA' : 'bibbcountygeorgia'}/${stat.code}`;
}

const ageStatistics: CountyStatistic[] = ageSnapshot.ages.map((age, index) => ({
  label: index === 17 ? 'Age 85+' : `Ages ${index * 5}–${index * 5 + 4}`,
  value: `${(100 * age.county / ageSnapshot.countyTotal).toFixed(1)}%`,
  georgia: `${(100 * age.state / ageSnapshot.total).toFixed(1)}%`,
  detail: `${age.county.toLocaleString('en-US')} residents`,
  stateDetail: `${age.state.toLocaleString('en-US')} residents`,
  period: 'July 1, 2025 estimate · share of all residents',
  code: age.col, source: ageSource, stateSource: ageSource,
}));

// Official Census snapshot, verified 2026-10-26. Keep values, periods and
// indicator codes together. Georgia comparisons use the same measure/vintage.
const groups: { id: string; title: string; note: string; statistics: CountyStatistic[] }[] = [
  {
    id: 'population', title: 'Population & people',
    note: 'Population estimates describe residents, not registered voters. Age groups below do not cover every age.',
    statistics: [
      { label: 'Population', value: '157,556', georgia: '11,302,748', period: 'July 1, 2025 estimate', code: 'PST045225' },
      { label: '2020 Census population', value: '157,346', georgia: '10,711,908', period: 'April 1, 2020 Census', code: 'POP010220' },
      { label: 'Population change', value: '0.1%', georgia: '5.5%', period: 'April 2020 estimates base to July 2025', code: 'PST120225' },
      { label: 'Residents under 18', value: '23.3%', georgia: '22.2%', period: 'July 1, 2025 estimate', code: 'AGE295225' },
      { label: 'Residents age 65+', value: '18.8%', georgia: '16.7%', period: 'July 1, 2025 estimate', code: 'AGE775225' },
      { label: 'Female residents', value: '53.2%', georgia: '51.7%', period: 'July 1, 2025 estimate', code: 'SEX255225' },
      { label: 'Foreign-born residents', value: '3.8%', georgia: '11.2%', period: '2020–2024 ACS', code: 'POP645224' },
      { label: 'Veterans', value: '8,510', georgia: '601,304', period: '2020–2024 ACS', code: 'VET605224' },
    ],
  },
  {
    id: 'age', title: 'Age breakdown',
    note: 'These 18 age bands cover all residents without overlap. Percentages are calculated from Census population counts and rounded to one decimal; they may not sum to exactly 100%. Georgia counts sum all 159 counties in the same Vintage 2025 release.',
    statistics: ageStatistics,
  },
  {
    id: 'race-ethnicity', title: 'Race & ethnicity',
    note: 'Hispanic or Latino is an ethnicity and can include people of any race. The six race categories include Hispanic residents; White alone, not Hispanic or Latino is a subset of White alone. Do not add all eight rows together. “Alone” means one reported race.',
    statistics: [
      { label: 'White alone', value: '37.5%', georgia: '56.8%', period: 'July 1, 2025 estimate', code: 'RHI125225' },
      { label: 'Black or African American alone', value: '56.4%', georgia: '32.4%', period: 'July 1, 2025 estimate', code: 'RHI225225' },
      { label: 'American Indian and Alaska Native alone', value: '0.6%', georgia: '1.1%', period: 'July 1, 2025 estimate', code: 'RHI325225' },
      { label: 'Asian alone', value: '2.3%', georgia: '5.4%', period: 'July 1, 2025 estimate', code: 'RHI425225' },
      { label: 'Native Hawaiian and Other Pacific Islander alone', value: '0.1%', georgia: '0.1%', period: 'July 1, 2025 estimate', code: 'RHI525225' },
      { label: 'Two or more races', value: '3.1%', georgia: '4.2%', period: 'July 1, 2025 estimate', code: 'RHI625225' },
      { label: 'Hispanic or Latino, any race', value: '5.6%', georgia: '12.1%', period: 'July 1, 2025 estimate', code: 'RHI725225' },
      { label: 'White alone, not Hispanic or Latino', value: '33.7%', georgia: '47.9%', period: 'July 1, 2025 estimate', code: 'RHI825225' },
    ],
  },
  {
    id: 'poverty', title: 'Poverty',
    note: '2024 Small Area Income and Poverty Estimates (SAIPE) are model-based estimates of people below the official poverty threshold for their family size and composition. Rates use the population for whom poverty status is determined. Child groups overlap; do not add the rates. The ranges shown are 90% confidence intervals. These annual estimates use a different method from ACS five-year estimates.',
    statistics: [
      { label: 'People in poverty, all ages', value: '23.4%', georgia: '12.8%', period: '2024 SAIPE', code: 'SAIPE-2024-ALL', source: povertySource, stateSource: povertySource,
        detail: '90% interval: 20.1–26.7%', stateDetail: '90% interval: 12.5–13.1%' },
      { label: 'Children under 18 in poverty', value: '29.3%', georgia: '16.9%', period: '2024 SAIPE', code: 'SAIPE-2024-UNDER18', source: povertySource, stateSource: povertySource,
        detail: '90% interval: 21.2–37.4%', stateDetail: '90% interval: 16.2–17.6%' },
      { label: 'Related children ages 5–17 in families in poverty', value: '30.8%', georgia: '16.5%', period: '2024 SAIPE', code: 'SAIPE-2024-AGE5-17', source: povertySource, stateSource: povertySource,
        detail: '90% interval: 22.2–39.4%', stateDetail: '90% interval: 15.6–17.4%' },
    ],
  },
  {
    id: 'housing', title: 'Households & housing',
    note: 'Home values describe owner-occupied homes. Rent is median gross monthly rent, not the price of a new rental listing.',
    statistics: [
      { label: 'Households', value: '59,921', georgia: '4,074,366', period: '2020–2024 ACS', code: 'HSD410224' },
      { label: 'People per household', value: '2.51', georgia: '2.62', period: '2020–2024 ACS', code: 'HSD310224' },
      { label: 'Housing units', value: '72,122', georgia: '4,734,436', period: 'July 1, 2025 estimate', code: 'HSG010225' },
      { label: 'Owner-occupied homes', value: '51.4%', georgia: '65.7%', period: '2020–2024 ACS · occupied housing units', code: 'HSG445224' },
      { label: 'Median home value', value: '$174,500', georgia: '$303,300', period: '2020–2024 ACS · owner-occupied homes', code: 'HSG495224' },
      { label: 'Median monthly rent', value: '$1,066', georgia: '$1,393', period: '2020–2024 ACS · gross rent', code: 'HSG860224' },
      { label: 'Monthly owner costs with mortgage', value: '$1,427', georgia: '$1,783', period: '2020–2024 ACS · median', code: 'HSG650224' },
    ],
  },
  {
    id: 'income', title: 'Income, work & business',
    note: 'Income figures are in 2024 dollars. Establishments and employment count local workplaces and jobs, not only county residents.',
    statistics: [
      { label: 'Median household income', value: '$51,234', georgia: '$77,353', period: '2020–2024 ACS · in 2024 dollars', code: 'INC110224' },
      { label: 'Per capita income', value: '$31,699', georgia: '$40,924', period: '2020–2024 ACS · in 2024 dollars', code: 'INC910224' },
      { label: 'Civilian labor force participation', value: '56.4%', georgia: '63.1%', period: '2020–2024 ACS · residents age 16+', code: 'LFE046224' },
      { label: 'Mean commute to work', value: '22.2 min', georgia: '28.3 min', period: '2020–2024 ACS · workers age 16+', code: 'LFE305224' },
      { label: 'Employer establishments', value: '4,147', georgia: '261,320', period: '2023 County Business Patterns', code: 'EST211223' },
      { label: 'Employment at employer establishments', value: '77,509', georgia: '4,405,730', period: '2023 County Business Patterns', code: 'BZA110223' },
      { label: 'Nonemployer establishments', value: '16,933', georgia: '1,236,191', period: '2024 Nonemployer Statistics', code: 'NES010224' },
    ],
  },
  {
    id: 'education', title: 'Education & connectivity',
    note: 'Education percentages describe adults age 25 and older. Computer and broadband percentages describe households.',
    statistics: [
      { label: 'High school graduate or higher', value: '87.4%', georgia: '89.2%', period: '2020–2024 ACS · adults age 25+', code: 'EDU635224' },
      { label: 'Bachelor’s degree or higher', value: '26.3%', georgia: '34.9%', period: '2020–2024 ACS · adults age 25+', code: 'EDU685224' },
      { label: 'Households with a computer', value: '92.7%', georgia: '95.8%', period: '2020–2024 ACS', code: 'COM100224' },
      { label: 'Broadband subscription', value: '85.8%', georgia: '91.0%', period: '2020–2024 ACS · households', code: 'INT250224' },
      { label: 'Language other than English at home', value: '5.9%', georgia: '15.5%', period: '2020–2024 ACS · residents age 5+', code: 'POP815224' },
    ],
  },
  {
    id: 'health-geography', title: 'Health & geography',
    note: 'Disability estimates cover residents under age 65. Density and land area use 2020 Census geography.',
    statistics: [
      { label: 'Residents under 65 with a disability', value: '11.7%', georgia: '9.4%', period: '2020–2024 ACS', code: 'DIS010224' },
      { label: 'Population per square mile', value: '630.9', georgia: '185.6', period: '2020 Census', code: 'POP060220' },
      { label: 'Land area', value: '249.38 sq mi', georgia: '57,716.96 sq mi', period: '2020 Census', code: 'LND110220' },
    ],
  },
];

/** Explicit pilot curation. Inclusion is editorial, never inferred from a name match. */
export const bibbCounty = {
  name: 'Bibb County', state: 'Georgia', fips: '13021',
  organizationSlugs: ['bibb-county-board-of-elections', 'macon-water-authority-district-1'],
  mapSlugs: ['commissioners', 'voting', 'school-board', 'transit', 'libraries', 'recreation'],
  census: {
    source: 'https://www.census.gov/quickfacts/bibbcountygeorgia',
    stateSource: 'https://www.census.gov/quickfacts/GA',
    ageSource,
    povertySource,
    checked: '2026-10-26',
    groups,
    statistics: groups.flatMap(group => group.statistics),
    overviewCodes: ['PST045225', 'INC110224', 'HSD410224', 'HSG445224', 'EDU685224', 'INT250224'],
    comparisons: [
      { label: 'Homeownership', note: 'Occupied housing units', county: 51.4, state: 65.7 },
      { label: 'Bachelor’s degree or higher', note: 'Adults age 25+', county: 26.3, state: 34.9 },
      { label: 'Broadband subscription', note: 'Households', county: 85.8, state: 91.0 },
    ],
  },
};

import { expect, test } from 'bun:test';
import { isBibbContest, isBibbJurisdiction } from '../apps/web/src/lib/election-scope';

test('Bibb ballot includes statewide offices and the county’s legislative districts', () => {
  for (const district of [142, 143, 144, 145, 149]) {
    expect(isBibbContest({ office: 'Georgia House of Representatives', district: `District ${district}` })).toBe(true);
  }
  expect(isBibbContest({ office: 'Georgia State Senate', district: 'District 26' })).toBe(true);
  expect(isBibbContest({ office: 'United States House of Representatives', district: 'Georgia District 8' })).toBe(true);
  expect(isBibbContest({ office: 'Georgia Public Service Commissioner', district: 'District 3 (statewide vote)' })).toBe(true);
  expect(isBibbContest({ office: 'Bibb County Soil and Water Conservation District Supervisor', district: null })).toBe(true);
});

test('out-of-area districts and similarly numbered districts stay outside the Bibb display', () => {
  expect(isBibbContest({ office: 'Georgia House of Representatives', district: 'District 47' })).toBe(false);
  expect(isBibbContest({ office: 'Georgia House of Representatives', district: 'District 1420' })).toBe(false);
  expect(isBibbContest({ office: 'Georgia State Senate', district: 'District 142' })).toBe(false);
  expect(isBibbContest({ office: 'Unknown office', district: null })).toBe(false);
});

test('historical SOS labels and explicit Bibb source provenance remain visible', () => {
  expect(isBibbContest({office:'Governor - Rep',district:null})).toBe(true);
  expect(isBibbContest({office:'State Senate - District 18 - Rep',district:null})).toBe(true);
  expect(isBibbContest({office:'State Senate - District 19 - Rep',district:null})).toBe(false);
  expect(isBibbContest({office:'State Senate',district:'District 18'})).toBe(true);
  expect(isBibbContest({office:'BOE - Post 7 - At Large',district:null,description:'Source: https://results.sos.ga.gov/results/public/bibb-county-ga/elections/GeneralPrimary51926'})).toBe(true);
  expect(isBibbContest({office:'BOE - Post 7 - At Large',district:null,description:'Source: https://results.sos.ga.gov/results/public/fulton-county-ga/elections/GeneralPrimary51926'})).toBe(false);
});

test('ballot question scope includes Georgia and Bibb but excludes other counties', () => {
  expect(isBibbJurisdiction('Georgia (statewide)')).toBe(true);
  expect(isBibbJurisdiction('Macon-Bibb County')).toBe(true);
  expect(isBibbJurisdiction('Bibb County school district')).toBe(true);
  expect(isBibbJurisdiction('Fulton County')).toBe(false);
  expect(isBibbJurisdiction(null)).toBe(false);
});

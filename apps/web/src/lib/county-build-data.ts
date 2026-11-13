import { fetchOrganizations } from './organizations';
import { fetchPublicPeople, fetchPublicAffiliationsByPerson } from './people';
import { fetchPublicMaps } from './maps';
import { fetchPublicElections, fetchElectionDetail } from './elections';
import { getPublicCalendarData } from './calendar-build-data';
import { organizationCountyCoverage, mapCountyCoverage } from '../data/county-coverage';
import { jurisdictionCounties, type CountyIndex } from './county-scope';
import { getPublicRecordSnapshot } from './public-record-snapshot';

/** Public metadata only; the index conveys geography, never permission. */
async function loadCountyIndex(): Promise<CountyIndex> {
  const [orgs, people, maps, elections, calendar] = await Promise.all([
    fetchOrganizations(), fetchPublicPeople(), fetchPublicMaps(), fetchPublicElections(), getPublicCalendarData(),
  ]);
  const index: CountyIndex = {};
  const assign = (kind: string, id: string, coverage: string[] | undefined) => {
    if (coverage?.length) index[`${kind}:${id}`] = [...new Set(coverage)].sort();
  };
  for (const org of orgs) assign('organization', org.id, organizationCountyCoverage[org.slug]);
  const affiliations = await fetchPublicAffiliationsByPerson(people.map(person => person.id));
  for (const person of people) {
    const links = affiliations.get(person.id) ?? [];
    if (links.every(org => index[`organization:${org.id}`])) assign('person', person.id, links.flatMap(org => index[`organization:${org.id}`]));
  }
  for (const map of maps) assign('map', map.id, mapCountyCoverage[map.slug] ?? index[`organization:${map.organization_id}`]);
  for (const row of calendar.calendars) assign('calendar', row.id, index[`organization:${row.organization_id}`]);
  for (const event of calendar.events) assign('event', event.id, index[`organization:${event.organization_id}`]);
  // An election may contain several counties; scope its races individually.
  for (const election of elections) {
    const detail = await fetchElectionDetail(election.id);
    if (!detail) throw new Error(`Missing public election geography: ${election.id}`);
    for (const contest of detail.contests) assign('contest', contest.id, jurisdictionCounties(`${contest.office} ${contest.district ?? ''}`));
    for (const question of detail.ballot_questions) assign('ballot_question', question.id, jurisdictionCounties(question.jurisdiction));
  }
  const orgCoverage = new Map(orgs.map(org => [`/orgs/${encodeURIComponent(org.slug)}/`, index[`organization:${org.id}`]]));
  for (const record of await getPublicRecordSnapshot()) {
    if (record.kind !== 'requests') continue;
    const links = record.facts.filter(fact => fact.href?.startsWith('/orgs/'));
    if (links.every(link => orgCoverage.get(link.href!))) assign('request', record.id, links.flatMap(link => orgCoverage.get(link.href!)!));
  }
  return index;
}
let snapshot: Promise<CountyIndex> | undefined;
let expires = 0;
export function getCountyIndex(): Promise<CountyIndex> {
  if (import.meta.env.DEV && Date.now() >= expires) { snapshot = undefined; expires = Date.now() + 30_000; }
  return snapshot ??= loadCountyIndex();
}

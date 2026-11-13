import { fetchOrganizations, type Organization } from './organizations';
import { fetchPublicMaps, type MapConfig } from './maps';
import { fetchPublicPeopleByOrganization, type Person } from './people';
import { fetchPublicElections, fetchElectionDetail, type ElectionDetail } from './elections';
import { getPublicCalendarData } from './calendar-build-data';
import { isPublicEvent } from './calendar-snapshot';
import type { EventRecord } from './calendars';

export const BIBB_TOPIC_LINK_REVIEW = '2026-11-01';
export const BIBB_TOPIC_RESOURCES = {
  commission: 'https://www.maconbibb.us/commissioners/',
  agendas: 'https://maconbibbcoga.portal.civicclerk.com/',
  elections: 'https://www.maconbibb.us/board-of-elections/',
  stateCalendar: 'https://sos.ga.gov/page/election-calendar-and-events',
  sampleBallot: 'https://georgia.gov/view-sample-ballot',
  voterPage: 'https://mvp.sos.ga.gov/s/',
  assessors: 'https://www.bibbassessors.com/',
  assessmentNotices: 'https://www.bibbassessors.com/assessment-notices/',
  assessmentAppeals: 'https://www.bibbassessors.com/forms/appeal-of-assessment-form/',
  taxProperty: 'https://www.maconbibbtax.us/property.html',
  taxFaq: 'https://www.maconbibbtax.us/faq.html',
  taxPayments: 'https://bibbcountyga.governmentwindow.com/tax.html',
  stateTaxBibb: 'https://dor.georgia.gov/county-property-tax-facts-bibb',
  apportionment: 'https://www.census.gov/topics/public-sector/congressional-apportionment/about.html',
  reapportionment: 'https://www.legis.ga.gov/joint-office/reapportionment',
  redistrictingProcess: 'https://www.legis.ga.gov/api/document/docs/default-source/reapportionment-document-library/redistricting-process-overview.pdf',
} as const;
const organizationSlugs = new Set(['bibb-county-board-of-elections', 'macon-water-authority-district-1']);
const mapSlugs = new Set(['commissioners', 'school-board', 'voting']);

export interface TopicInputs {
  organizations: Organization[];
  people: Map<string, { person: Person; role: string }[]>;
  maps: MapConfig[];
  elections: ElectionDetail[];
  events: EventRecord[];
}
/** Curated geography never grants access. All inputs come from existing public
 * readers, and child visibility is checked again before projecting guide facts. */
export function projectBibbTopics(input: TopicInputs) {
  const organizations = input.organizations.filter(org => organizationSlugs.has(org.slug)).map(org => ({
    id: org.id, slug: org.slug, name: org.name,
    people: (input.people.get(org.id) ?? []).filter(({ person }) => person.visibility === 'public')
      .map(({ person, role }) => ({ name: person.full_name, slug: person.slug, role })),
  }));
  const ids = new Set(organizations.map(org => org.id));
  const electionsOffice = organizations.find(org => org.slug === 'bibb-county-board-of-elections');
  const elections = input.elections.filter(detail => detail.election.visibility === 'public'
    && Boolean(electionsOffice && detail.election.organization_id === electionsOffice.id))
    .sort((a, b) => b.election.election_date.localeCompare(a.election.election_date) || a.election.id.localeCompare(b.election.id))
    .slice(0, 3).map(detail => ({
      id: detail.election.id, slug: detail.election.slug, name: detail.election.name, date: detail.election.election_date,
      contestCount: detail.contests.length,
      contests: detail.contests.slice(0, 6).map(contest => ({ id: contest.id,
        name: [contest.office, contest.district, contest.seat].filter(Boolean).join(' · '),
        candidates: contest.candidates.filter(candidate => candidate.person.visibility === 'public')
          .map(candidate => ({ name: candidate.person.full_name, slug: candidate.person.slug })),
      })),
    }));
  const electionIds = new Set(elections.map(election => election.id));
  const publicEvents = input.events.filter(isPublicEvent);
  return { organizations, elections,
    maps: input.maps.filter(map => map.visibility === 'public' && mapSlugs.has(map.slug))
      .map(map => ({ slug: map.slug, name: map.name, description: map.description })),
    meetings: publicEvents.filter(event => event.is_meeting && ids.has(event.organization_id))
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at) || a.id.localeCompare(b.id)).slice(0, 6),
    dates: publicEvents.filter(event => !event.is_meeting && event.election_id && electionIds.has(event.election_id))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id)).slice(0, 9),
  };
}

let snapshot: ReturnType<typeof loadBibbTopics> | undefined;
async function loadBibbTopics() {
  const [organizations, maps, elections, calendar] = await Promise.all([
    fetchOrganizations(), fetchPublicMaps(), fetchPublicElections(), getPublicCalendarData(),
  ]);
  const selected = organizations.filter(org => organizationSlugs.has(org.slug));
  const ids = new Set(selected.filter(org => org.slug === 'bibb-county-board-of-elections').map(org => org.id));
  const [people, details] = await Promise.all([
    fetchPublicPeopleByOrganization(selected.map(org => org.id)),
    Promise.all(elections.filter(election => election.organization_id && ids.has(election.organization_id)).map(election => fetchElectionDetail(election.id))),
  ]);
  if (details.some(detail => detail === null)) throw new Error('A selected public election is missing its detail snapshot; retry publication.');
  return projectBibbTopics({ organizations, people, maps, events: calendar.events,
    elections: details.filter((detail): detail is ElectionDetail => detail !== null) });
}
export function getBibbTopics() {
  if (import.meta.env.DEV) return loadBibbTopics();
  return snapshot ??= loadBibbTopics();
}

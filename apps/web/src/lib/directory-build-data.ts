import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person, AffiliationRow } from './people';
import type { Organization } from './organizations';
import type { Election, ElectionContest, ElectionCandidate, BallotQuestion } from './elections';
import { fetchElectionDetail } from './elections';
import { readRows } from './profile-build-data';
import type { DirectorySnapshot } from './directories';

const text = (...values: unknown[]) => values.filter(value => value !== null && value !== undefined).join(' ');
interface Candidate extends Omit<ElectionCandidate, 'person'> { contest_id: string; person_id: string }

/** Anon reads plus explicit parent/child allowlists keep even search-only text public. */
export async function loadDirectoryBuildData(client: SupabaseClient, records: {people:Person[];organizations:Organization[];elections:Election[]}) {
  const affiliations = await readRows<AffiliationRow>(client,'person_organizations','person_id,organization_id,role',['person_id','organization_id']);
  // Ballot questions deliberately have no anon table grant. Reuse the existing
  // gated election-detail RPC and its per-build cache, rather than widen grants.
  const contests: ElectionContest[] = [], candidates: Candidate[] = [], questions: BallotQuestion[] = [];
  let next = 0;
  await Promise.all(Array.from({length:3},async()=>{
    while (next < records.elections.length) {
      const election = records.elections[next++];
      if (election.visibility !== 'public') continue;
      const detail = await fetchElectionDetail(election.id);
      if (!detail || detail.election.visibility !== 'public' || detail.election.id !== election.id) throw new Error(`Missing public election detail: ${election.id}`);
      for (const contest of detail.contests) {
        contests.push(contest);
        for (const candidate of contest.candidates) candidates.push({...candidate,contest_id:contest.id,person_id:candidate.person.id});
      }
      questions.push(...detail.ballot_questions);
    }
  }));
  // Parallel fetch completion must not change content hashes between builds.
  contests.sort((a,b)=>a.id.localeCompare(b.id));
  candidates.sort((a,b)=>a.contest_id.localeCompare(b.contest_id)||a.person_id.localeCompare(b.person_id));
  questions.sort((a,b)=>a.id.localeCompare(b.id));
  return assembleDirectoryData(records,{affiliations,contests,candidates,questions});
}

export function assembleDirectoryData(records: {people:Person[];organizations:Organization[];elections:Election[]}, related: {affiliations:AffiliationRow[];contests:Pick<ElectionContest,'id'|'election_id'|'office'|'district'|'seat'|'description'>[];candidates:Pick<Candidate,'contest_id'|'person_id'|'party'|'status'|'is_write_in'>[];questions:Pick<BallotQuestion,'election_id'|'title'|'question_text'|'description'|'jurisdiction'|'choices'>[]}) {
  const people = records.people.filter(person => person.visibility === 'public');
  const elections = records.elections.filter(election => election.visibility === 'public');
  const publicPeople = new Map(people.map(person => [person.id,person]));
  const orgs = new Map(records.organizations.map(org => [org.id,org]));
  const publicElections = new Set(elections.map(election => election.id));
  const contestElection = new Map<string,string>();
  const electionText = new Map<string,string[]>();
  const addElection = (id:string,value:string) => electionText.set(id,[...(electionText.get(id)??[]),value]);
  for (const contest of related.contests) {
    if (!publicElections.has(contest.election_id)) continue;
    const value = text(contest.office,contest.district,contest.seat,contest.description);
    contestElection.set(contest.id,contest.election_id);
    addElection(contest.election_id,value);
  }
  for (const candidate of related.candidates) {
    const person = publicPeople.get(candidate.person_id);
    const electionId = contestElection.get(candidate.contest_id);
    if (person && electionId) addElection(electionId,text(person.full_name,candidate.party,candidate.status,candidate.is_write_in?'write-in certified write in':'ballot candidate'));
  }
  for (const question of related.questions) if (publicElections.has(question.election_id)) addElection(question.election_id,text(question.title,question.question_text,question.description,question.jurisdiction,...question.choices));
  const orgText = new Map<string,string[]>();
  for (const affiliation of related.affiliations) {
    const person = publicPeople.get(affiliation.person_id);
    if (person && orgs.has(affiliation.organization_id)) orgText.set(affiliation.organization_id,[...(orgText.get(affiliation.organization_id)??[]),text(person.full_name,affiliation.role)]);
  }
  return {
    people: people.map(({id,slug,full_name,kind,title,description,image_path,visibility}) => ({record:{id,slug,full_name,kind,title,description,image_path,visibility},search:text(full_name,title,description)})) satisfies DirectorySnapshot<'people'>,
    organizations: records.organizations.map(org => ({record:{id:org.id,slug:org.slug,name:org.name,description:org.description,logo_path:org.logo_path},search:text(org.name,org.slug,org.description,org.email,org.phone,org.address_line,org.website_url,org.social_url,...(orgText.get(org.id)??[]))})) satisfies DirectorySnapshot<'organizations'>,
    elections: elections.map(election => ({record:election,search:text(election.name,election.slug,election.kind,election.description,election.election_date,orgs.get(election.organization_id??'')?.name,...(electionText.get(election.id)??[]))})) satisfies DirectorySnapshot<'elections'>,
  };
}

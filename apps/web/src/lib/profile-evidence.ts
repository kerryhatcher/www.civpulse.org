import { articleFetchedLabel, articlePublishedLabel, articleUrl } from './articles';
import { CANDIDATE_STATUS_LABELS, formatElectionDate } from './elections';
import { officeLabel, serviceDates } from './offices';
import type { PublicProfileSections } from './profile-sections';
import { unknownSourceDates, unknownVerification } from './record-provenance';

export const PROFILE_EVIDENCE_PAGE_SIZE = 20;
export const PROFILE_EVIDENCE_KEYS = ['offices', 'candidacies', 'articles', 'votes', 'legislative-votes'] as const;
export type ProfileEvidenceKey = typeof PROFILE_EVIDENCE_KEYS[number];
export interface EvidenceRow { title: string; lines: string[]; links: { label: string; href: string }[] }
export interface EvidenceSection { key: ProfileEvidenceKey; title: string; rows: EvidenceRow[]; initial: number }
export const profileHistoryHref = (kind: 'people' | 'orgs', slug: string, section: ProfileEvidenceKey, page = 1) => `/${kind}/${slug}/history/${section}/${page}/`;
const source = (value: unknown) => typeof value === 'string' ? articleUrl(value) : null;
const sourceLink = (value: unknown) => source(value) ? [{ label: 'Original source', href: source(value)! }] : [];

/** This projection accepts only the existing anonymous public export. Preserve
 * source precision and association roles; names do not establish current office. */
export function profileEvidence(profile: PublicProfileSections, kind: 'people' | 'orgs'): Record<ProfileEvidenceKey, EvidenceSection> {
  return {
    offices: { key: 'offices', title: kind === 'people' ? 'Offices held' : 'Officeholders', initial: 10,
      rows: profile.officeTerms.filter(term => term.person_visibility === 'public').map(term => ({
        title: officeLabel({ name: term.office_name, district: term.district, seat: term.seat }),
        lines: [serviceDates(term).replace('– present', '– end not recorded'), term.selection_method === 'elected' ? 'Elected' : 'Appointed', unknownSourceDates, ...(!source(term.source_url) ? ['Original source: Not recorded.'] : [])],
        links: [{ label: kind === 'people' ? term.organization_name : term.person_name,
          href: kind === 'people' ? `/orgs/${term.organization_slug}/` : `/people/${term.person_slug}/` }, ...sourceLink(term.source_url)],
      })) },
    candidacies: { key: 'candidacies', title: 'Election candidacies', initial: 10,
      rows: profile.candidacies.filter(race => race.election_visibility === 'public').map(race => ({
        title: [race.office, race.district, race.seat].filter(Boolean).join(' · '),
        lines: [formatElectionDate(race.election_date), [race.party, CANDIDATE_STATUS_LABELS[race.status], race.is_write_in ? 'Certified write-in' : ''].filter(Boolean).join(' · '), unknownSourceDates],
        links: [{ label: race.election_name, href: `/elections/${race.election_slug}/#ballot` }],
      })) },
    articles: { key: 'articles', title: 'News & articles', initial: 10,
      rows: profile.articles.filter(article => article.visibility === 'public' && articleUrl(article.url)).map(article => ({
        title: article.title, lines: [article.role, articlePublishedLabel(article.published_on), articleFetchedLabel(article.fetched_on), unknownVerification],
        links: [{ label: new URL(articleUrl(article.url)!).hostname.replace(/^www\./, ''), href: articleUrl(article.url)! }],
      })) },
    votes: { key: 'votes', title: 'Meeting votes', initial: 20,
      rows: profile.votes.map(vote => ({ title: vote.subject,
        lines: [`Vote: ${vote.choice} · Outcome: ${vote.outcome ?? 'Not recorded'}`, `${vote.organization_name} · Meeting date: ${new Date(vote.starts_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}`, ...(vote.description ? [vote.description] : []), unknownSourceDates],
        links: [{ label: vote.meeting_title, href: `/records/events/${encodeURIComponent(vote.meeting_id)}/#vote-${encodeURIComponent(vote.vote_id)}` }],
      })) },
    'legislative-votes': { key: 'legislative-votes', title: 'Legislative vote choices', initial: 20,
      rows: profile.legislativeVotes.filter(vote => vote.category !== 'attendance').map(vote => ({
        title: String(vote.question),
        lines: [`Choice: ${vote.choice} · Outcome: ${vote.outcome ?? 'Not recorded'}`, `Vote date: ${vote.occurred_on}`, ...(vote.coverage ? [`Recorded coverage: ${vote.coverage}`] : []), unknownVerification],
        links: [{ label: 'Public vote record', href: `/records/votes/${encodeURIComponent(String(vote.vote_id))}/` }, ...sourceLink(vote.source_url),
          ...(Array.isArray(vote.bills) ? vote.bills as {id:string;identifier:string;title:string}[] : []).map(bill => ({ label: `${bill.identifier}: ${bill.title}`, href: `/records/bills/${encodeURIComponent(bill.id)}/` }))],
      })) },
  };
}

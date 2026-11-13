import { articleUrl } from './articles';
import { renderProfileDescription } from './profile-description';
import type { Person } from './people';
import type { ElectionDetail } from './elections';

export interface ProvenanceSource { label: string; url: string }
export const biographyProvenanceNote='Citations support only the claims they identify. Contact websites and related articles are not automatically biography sources; a recorded title may describe past service.';
export const provenanceExplanation='Retrieval records when a source was obtained, not when its claims were verified. An edit, import or site publication timestamp is not a verification date. Check dated source notes for the scope of any claim.';
export const voteDetailScope=(category:unknown)=>category==='attendance'?undefined:legislativeVoteScope;
export const unknownVerification = 'Last verified: Unknown (retrieval is not verification).';
export const unknownSourceDates = 'Source publication/retrieval dates: Not recorded in this view. Last verified: Unknown.';
export const meetingVoteScope = 'Only recorded choices from meetings added to Civic Pulse are shown; meetings or motions may be missing. Missing choices are unknown, not absences or opposition. This list is not a participation denominator.';
export const legislativeVoteScope = 'This history covers imported legislative records, not every vote an officeholder could cast. Attendance roll calls are excluded. Missing choices are unknown, not absences or opposition; entry counts are not a participation denominator.';
export const recordSourceUrl = (value: unknown): string | null => typeof value === 'string' ? articleUrl(value) : null;

/** These are source dates only. There is deliberately no updated_at/build-time
 * input: neither is evidence of retrieval or factual verification. */
export function provenanceDates(publishedOn?: string | null, fetchedOn?: string | null) {
  const date = (value: string | null | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : 'Unknown';
  return [
    { label: 'Source publication date', value: date(publishedOn) },
    { label: 'Source retrieval date', value: date(fetchedOn) },
    { label: 'Last verified', value: 'Unknown' },
  ];
}

/** Extract only HTTP(S) citations actually rendered by the existing safe Markdown
 * renderer. Contact websites/social links are not biography evidence. The
 * renderer escapes raw HTML and normalizes dangerous protocols before this step. */
export function biographySources(person: Pick<Person, 'description' | 'visibility'>): ProvenanceSource[] {
  if (person.visibility !== 'public' || !person.description) return [];
  return biographyCitations(person.description);
}

/** Safe citation extraction for a biography already returned by its access gate.
 * Public prerendering must use biographySources to retain its visibility filter. */
export function biographyCitations(description:string|null):ProvenanceSource[]{
  if(!description)return [];
  const sources = new Map<string, ProvenanceSource>();
  for (const match of renderProfileDescription(description).matchAll(/<a href="([^"]+)"/g)) {
    const url = recordSourceUrl(match[1].replaceAll('&amp;', '&'));
    if (url) sources.set(url, { label: `Cited biography source: ${new URL(url).hostname}`, url });
  }
  return [...sources.values()];
}

export function electionSources(detail: ElectionDetail): ProvenanceSource[] {
  if (detail.election.visibility !== 'public') return [];
  return [
    ...detail.dates.filter(date => date.visibility === 'public').flatMap(date => {
      const url = recordSourceUrl(date.url); return url ? [{ label: `Date/deadline source: ${date.title}`, url }] : [];
    }),
    ...detail.ballot_questions.flatMap(question => {
      const url = recordSourceUrl(question.source_url); return url ? [{ label: `Ballot question source: ${question.title}`, url }] : [];
    }),
  ];
}

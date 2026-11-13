export type CandidatePartyTone = 'republican' | 'democratic' | 'other' | 'neutral';

/** Color only explicit curated party labels in a partisan contest. */
export function candidatePartyTone(party: string | null | undefined, partisan: boolean): CandidatePartyTone {
  if (!partisan || !party?.trim()) return 'neutral';
  const label = party.trim().toLowerCase().replace(/[.]/g, '').replace(/[\s_-]+/g, ' ');
  if (['nonpartisan', 'non partisan', 'np', 'n p', 'none', 'no party', 'no party affiliation', 'npa'].includes(label)) return 'neutral';
  if (['r', 'rep', 'republican', 'republican party', 'gop'].includes(label)) return 'republican';
  if (['d', 'dem', 'democrat', 'democratic', 'democratic party', 'democrat party'].includes(label)) return 'democratic';
  return 'other';
}

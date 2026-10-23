export const HISTORY_TYPES: Record<string, string> = {
  organizations: 'Organizations', people: 'People', elections: 'Elections',
  offices: 'Offices', office_terms: 'Office service', contests: 'Contests',
  contest_candidates: 'Candidates', ballot_questions: 'Ballot questions',
  person_organizations: 'Affiliations', organization_relationships: 'Organization relationships',
  articles: 'Articles', article_people: 'Article people', article_organizations: 'Article organizations',
  maps: 'Maps', layers: 'Layers', layer_features: 'Geographic features', map_layers: 'Map layers',
  calendars: 'Calendars', events: 'Events and meetings', meeting_attendance: 'Meeting attendance',
  meeting_votes: 'Meeting votes', meeting_vote_choices: 'Individual votes', meeting_attachments: 'Meeting attachments',
};
export function historyUrl(table: string, id: string): string {
  return `/history/?${new URLSearchParams({type: table, id})}`;
}
export function historyLink(table: string, id: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = historyUrl(table, id);
  a.textContent = 'View history';
  return a;
}

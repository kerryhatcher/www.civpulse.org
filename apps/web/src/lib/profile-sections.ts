import type { ProfileOfficeTerm } from './offices';
import type { ProfileArticle } from './articles';
import type { PersonCandidacy } from './people';
import type { PersonVote } from '../scripts/person-votes';
import type { LegislativeRow } from './legislation';

export interface PublicProfileSections {
  officeTerms: ProfileOfficeTerm[];
  articles: ProfileArticle[];
  candidacies: PersonCandidacy[];
  votes: PersonVote[];
  legislativeVotes: LegislativeRow[];
  legislation: Record<string, LegislativeRow[]>;
  legislativeInitial?: {total:number;rows:LegislativeRow[]};
  legislativePages?: Record<string,string>;
  legislativeVotesUrl?: string;
}
export function emptyProfileSections(): PublicProfileSections {
  return { officeTerms: [], articles: [], candidacies: [], votes: [], legislativeVotes: [], legislation: {} };
}
export function profileToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function currentOfficeTerms(terms: ProfileOfficeTerm[], today = profileToday()): ProfileOfficeTerm[] {
  return terms.map(term => ({ ...term, service_status: term.starts_on > today ? 'upcoming'
    : term.ends_on && (term.ends_on < today || (term.ends_on_precision === 'year' && term.ends_on.slice(0,4) <= today.slice(0,4))) ? 'former' : 'current' }));
}
export function currentCandidacies(races: PersonCandidacy[], today = profileToday()): PersonCandidacy[] {
  return races.map(race => ({ ...race, is_current: race.election_date >= today && ['running','runoff','pending'].includes(race.status) }))
    .sort((a,b) => Number(b.is_current)-Number(a.is_current) || (a.is_current ? a.election_date.localeCompare(b.election_date) : b.election_date.localeCompare(a.election_date))
      || a.election_name.localeCompare(b.election_name) || a.office.localeCompare(b.office) || (a.district??'').localeCompare(b.district??'') || (a.seat??'').localeCompare(b.seat??'') || a.contest_id.localeCompare(b.contest_id));
}
export function browseProfileLegislation(snapshot: PublicProfileSections, table: string, args: Record<string, unknown> = {}) {
  const filters = (args.p_filters ?? {}) as Record<string, unknown>;
  const rows = (snapshot.legislation[table] ?? []).filter(row => Object.entries(filters).every(([key,value]) => row[key] === value));
  const offset = Number(args.p_offset ?? 0), limit = Number(args.p_limit ?? 25);
  return { total: rows.length, rows: rows.slice(offset, offset+limit) };
}
function matchesBill(text: string, query: string): boolean {
  // ILIKE substring matching without compiling user input into a regex.
  const tokens: { kind: 'many'|'one'|'literal'; value?: string }[] = [{kind:'many'}];
  const pattern = Array.from(query.slice(0,500).toLocaleLowerCase());
  for (let i=0;i<pattern.length;i++) {
    const char=pattern[i];
    if (char==='\\' && i+1<pattern.length) tokens.push({kind:'literal',value:pattern[++i]});
    else if (char==='%') { if(tokens.at(-1)?.kind!=='many') tokens.push({kind:'many'}); }
    else tokens.push(char==='_' ? {kind:'one'} : {kind:'literal',value:char});
  }
  if(tokens.at(-1)?.kind!=='many') tokens.push({kind:'many'});
  const chars=Array.from(text.toLocaleLowerCase());
  let position=0,token=0,lastMany=-1,retryFrom=0;
  while(position<chars.length) {
    const current=tokens[token];
    if(current?.kind==='one' || (current?.kind==='literal' && current.value===chars[position])) {position++;token++;}
    else if(current?.kind==='many') {lastMany=token++;retryFrom=position;}
    else if(lastMany>=0) {token=lastMany+1;position=++retryFrom;}
    else return false;
  }
  while(tokens[token]?.kind==='many') token++;
  return token===tokens.length;
}
export function groupProfileVotes(snapshot: PublicProfileSections, args: Record<string, unknown>) {
  const grouped = new Map<string, LegislativeRow>();
  for (const vote of snapshot.legislativeVotes) {
    if (['term_id','session_id','body_id','category'].some(key => args[`p_${key}`] && args[`p_${key}`] !== vote[key])) continue;
    const bills = [...new Map((vote.bills as { id: string; identifier: string; title: string }[]).map(bill=>[bill.id,bill])).values()];
    for (const bill of bills.length ? bills : [null]) {
      if (args.p_bill_query && (!bill || !(matchesBill(bill.identifier,String(args.p_bill_query)) || matchesBill(bill.title,String(args.p_bill_query))))) continue;
      const id = bill?.id ?? String(vote.vote_id);
      const existing = grouped.get(id);
      if (existing) existing.vote_count = Number(existing.vote_count)+1;
      else grouped.set(id,{ ...vote, group_id: id, bill_id: bill?.id ?? null, bill_identifier: bill?.identifier ?? null,
        bill_title: bill?.title ?? null, vote_count: 1 });
    }
  }
  const rows = [...grouped.values()].sort((a,b) => String(b.occurred_on).localeCompare(String(a.occurred_on))
    || String(b.occurred_at??'').localeCompare(String(a.occurred_at??'')) || String(a.group_id).localeCompare(String(b.group_id)));
  const offset = Number(args.p_offset ?? 0), limit = Number(args.p_limit ?? 25);
  return { total: rows.length, rows: rows.slice(offset,offset+limit) };
}

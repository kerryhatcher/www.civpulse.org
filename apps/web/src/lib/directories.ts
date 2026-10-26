import { stemmer } from 'stemmer';
import type { Person } from './people';
import type { Organization } from './organizations';
import type { Election } from './elections';

export type DirectoryPerson = Pick<Person, 'id'|'slug'|'full_name'|'kind'|'title'|'description'|'image_path'|'visibility'>;
export type DirectoryOrganization = Pick<Organization, 'id'|'slug'|'name'|'description'|'logo_path'>;
export interface DirectoryRecords { people: DirectoryPerson; organizations: DirectoryOrganization; elections: Election }
export type DirectoryKind = keyof DirectoryRecords;
export interface DirectoryEntry<T> { record: T; search: string }
export type DirectorySnapshot<K extends DirectoryKind> = DirectoryEntry<DirectoryRecords[K]>[];

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const indexed = new WeakMap<object, { text: string; stems: string[]; terms: Set<string> }>();
function document(entry: DirectoryEntry<unknown>) {
  let doc = indexed.get(entry);
  if (!doc) {
    const stems = words(entry.search).map(word => stemmer(word));
    doc = { text: entry.search.toLowerCase(), stems, terms: new Set(stems) };
    indexed.set(entry, doc);
  }
  return doc;
}

/** Literal input is never interpolated into a regexp. Supports words, phrases,
 * OR and exclusions; stemming also matches common English word endings. */
export function searchDirectory<T>(entries: DirectoryEntry<T>[], query: string): T[] {
  if (query.length > 500) throw new Error('Search query must be 500 characters or fewer');
  const needle = query.trim().toLowerCase();
  if (!needle) return entries.map(entry => entry.record);
  const groups: { negative: boolean; phrase: boolean; terms: string[] }[][] = [[]];
  for (const match of needle.matchAll(/(-?)(?:"([^"]*)"|([^\s"]+))/g)) {
    if (match[3] === 'or' && !match[1]) { if (groups.at(-1)!.length) groups.push([]); continue; }
    const terms = words(match[2] ?? match[3] ?? '').map(word => stemmer(word));
    if (terms.length) groups.at(-1)!.push({ negative: !!match[1], phrase: match[2] !== undefined, terms });
  }
  const ranked = entries.map(entry => {
    const doc = document(entry);
    const matches = doc.text.includes(needle) || groups.some(group => group.length > 0 && group.every(term => {
      const found = term.phrase
        ? doc.stems.some((_, start) => term.terms.every((word, offset) => doc.stems[start + offset] === word))
        : term.terms.every(word => doc.terms.has(word));
      return term.negative ? !found : found;
    }));
    const title = String((entry.record as {full_name?:string;name?:string}).full_name ?? (entry.record as {name?:string}).name ?? '').toLowerCase();
    return { record: entry.record, matches, title, score: (title === needle ? 4 : title.includes(needle) ? 2 : 0) + (doc.text.includes(needle) ? 1 : 0) };
  });
  return ranked.filter(item => item.matches).sort((a,b) => b.score-a.score || a.title.localeCompare(b.title)).map(item => item.record);
}

export function browsePeople(entries: DirectorySnapshot<'people'>, query: string, kind: string, sort: string, offset = 0, limit = 24) {
  const first = (person: DirectoryPerson) => person.full_name.trim().toLowerCase();
  const last = (person: DirectoryPerson) => first(person).replace(/\s*,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').match(/\S+$/)?.[0] ?? '';
  const compare = (a: string,b: string) => a.localeCompare(b, 'en');
  const people = searchDirectory(entries,query).filter(person => !kind || person.kind === kind);
  people.sort((a,b) => {
    const key = sort.startsWith('last_') ? last : first;
    return compare(key(a),key(b)) * (sort.endsWith('_desc') ? -1 : 1) || compare(first(a),first(b)) || compare(a.id,b.id);
  });
  return { total: people.length, people: people.slice(offset,offset+limit) };
}

export function orderElections(elections: Election[], today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())) {
  return [...elections].sort((a,b) => {
    const upcomingA = a.election_date >= today, upcomingB = b.election_date >= today;
    return Number(upcomingB)-Number(upcomingA) || (upcomingA ? a.election_date.localeCompare(b.election_date) : b.election_date.localeCompare(a.election_date)) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

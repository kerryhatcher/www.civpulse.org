import type { LegislativeRow } from './legislation';

export interface LegislationDirectory {
  version: 1;
  terms: LegislativeRow[];
  sessions: LegislativeRow[];
  initial: {rows: LegislativeRow[]; total: number};
  bills: {term: string; url: string; count: number}[];
}
export interface BillOptions {query?: string; term?: string; jurisdiction?: string; state?: string; sort?: string; offset?: number}
/** SQL ILIKE substring matching, including %/_ and backslash escapes.
 * Greedy wildcard matching avoids exponential regexp backtracking on user input. */
export function legislativeSearch(query: string): (text: string) => boolean {
  if (query.length > 500) throw new Error('Search query must be 500 characters or fewer');
  const tokens: {char:string;wild:boolean}[] = [{char:'%',wild:true}];
  const chars = Array.from(query.toLowerCase());
  for (let i=0;i<chars.length;i++) {
    const char=chars[i];
    if (char === '\\') {
      if (++i >= chars.length) throw new Error('Search cannot end with a backslash');
      tokens.push({char:chars[i],wild:false});
    } else if (char !== '%' || tokens.at(-1)?.char !== '%' || !tokens.at(-1)?.wild) tokens.push({char,wild:char === '%' || char === '_'});
  }
  tokens.push({char:'%',wild:true});
  return text => {
    const input=Array.from(text.toLowerCase());
    let i=0,j=0,star=-1,retry=0;
    while (i<input.length) {
      const token=tokens[j];
      if (token?.wild && token.char === '%') {star=j++;retry=i;}
      else if (token && (token.wild && token.char === '_' || !token.wild && token.char === input[i])) {i++;j++;}
      else if (star>=0) {j=star+1;i=++retry;}
      else return false;
    }
    while(tokens[j]?.wild && tokens[j].char === '%') j++;
    return j === tokens.length;
  };
}
export function billSearchText(row: LegislativeRow) {
  return [row.title,row.identifier,row.summary,row.labels?.term_id,row.labels?.session_id,row.labels?.body_id].filter(v => v != null).join(' ');
}
const compare = (a: unknown,b: unknown) => String(a ?? '').localeCompare(String(b ?? ''),'en');
export function browseStaticBills(rows: LegislativeRow[], options: BillOptions = {}) {
  const match = legislativeSearch(options.query ?? '');
  const filtered = rows.filter(row => (!options.term || row.term_id === options.term) &&
    (!options.jurisdiction || row.jurisdiction === options.jurisdiction) &&
    (!options.state || row.jurisdiction === 'state' && row.state_name === options.state) && match(billSearchText(row)));
  const sort = options.sort ?? 'newest';
  filtered.sort((a,b) => (sort.startsWith('title_') ? compare(String(a.title).toLowerCase(),String(b.title).toLowerCase()) * (sort === 'title_desc' ? -1 : 1) : compare(a.introduced_on,b.introduced_on) * (sort === 'oldest' ? 1 : -1)) || compare(a.identifier,b.identifier) || compare(a.id,b.id));
  const offset = options.offset ?? 0;
  return {total:filtered.length,rows:filtered.slice(offset,offset + 25)};
}
export function browseStaticSessions(rows: LegislativeRow[], query: string, term: string, offset = 0) {
  const match = legislativeSearch(query);
  const filtered = rows.filter(row => (!term || row.term_id === term) && match([row.title,row.name,row.identifier,row.question,row.summary,...Object.values(row.labels ?? {})].filter(v => v != null).join(' ')));
  return {total:filtered.length,rows:filtered.slice(offset,offset + 25)};
}
/** Exported rows already passed recursive anonymous discovery gates. Project only
 * directory fields; source payloads and import bookkeeping stay out of assets. */
export function directoryRow(row: LegislativeRow): LegislativeRow {
  if (row.visibility !== 'public') throw new Error('Non-public legislation directory record');
  const fields = ['id','visibility','labels','links','term_id','session_id','body_id','organization_id','identifier','title','name','summary','introduced_on','starts_on','ends_on','kind','measure_type','status','source_status','source_url','jurisdiction','state_name'];
  return Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key,row[key]])) as LegislativeRow;
}

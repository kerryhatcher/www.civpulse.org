/** Read-only adapter for the same public data API used by legis.ga.gov. */
export const GEORGIA_API = 'https://www.legis.ga.gov/api/';
// Official 2023 Senate journal pp. 421–422 identifies vote 21003 as opening
// attendance, despite its "SECOND READING" caption and false isRollCall flag.
// https://www.legis.ga.gov/api/document/docs/default-source/senate-journal-document-library/2023-senate-journal.pdf
function isReviewedGeorgiaAttendance(id?: number): boolean {
  return id === 21003;
}
export function isGeorgiaAttendance(row: { id?: number; isRollCall?: boolean; caption?: string }): boolean {
  return isReviewedGeorgiaAttendance(row.id) || row.isRollCall === true || /^(?:(?:morning|afternoon|evening)\s+)?(?:roll call|attendance)\s*$/i.test(row.caption?.trim() ?? '');
}
export const georgiaChoices = [
  { choice: 'yes', source_choice: 'Yea' },
  { choice: 'no', source_choice: 'Nay' },
  { choice: 'excused', source_choice: 'Excused' },
  { choice: 'not_voting', source_choice: 'NotVoting' },
  { choice: 'other', source_choice: 'Unknown' },
] as const;

export type GeorgiaResource = 'sessions' | 'members' | 'votes' | 'vote';
export interface GeorgiaSourceInput {
  resource: GeorgiaResource;
  session_id?: number;
  chamber?: 'house' | 'senate';
  vote_id?: number;
  member_id?: number;
  limit: number;
  offset: number;
}

export async function readGeorgiaSource(input: GeorgiaSourceInput, fetcher: typeof fetch = fetch) {
  let path: string;
  if (input.resource === 'sessions') path = 'sessions';
  else if (input.resource === 'vote') {
    if (!input.vote_id) throw new Error('Supply vote_id');
    path = `Vote/detail/${input.vote_id}`;
  } else {
    if (!input.session_id || !input.chamber) throw new Error('Supply session_id and chamber');
    const chamber = input.chamber === 'house' ? 1 : 2;
    path = input.resource === 'votes'
      ? `Vote/list/${chamber}/${input.session_id}`
      : `members/list/${input.session_id}?chamber=${chamber}`;
  }
  // Public website handshake, not a Civic Pulse credential. Never return the token.
  const ms = Date.now();
  const bytes = new TextEncoder().encode('QFpCwKfd7fjVEXFFwSu36BwwcP83xYgxLAhLYmKkletvarconst' + ms);
  const hash = await crypto.subtle.digest('SHA-512', bytes);
  const key = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  const request = async (url: string, headers?: HeadersInit) => {
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (!response.ok) throw new Error(`Georgia source returned HTTP ${response.status}`);
    return response.json();
  };
  const token = await request(`${GEORGIA_API}authentication/token?key=${key}&ms=${ms}`);
  if (typeof token !== 'string' || !token) throw new Error('Invalid Georgia source handshake');
  const data = await request(GEORGIA_API + path, { Authorization: `Bearer ${token}` });
  const provenance = { source_system: 'legis.ga.gov', source_url: GEORGIA_API + path, retrieved_at: new Date().toISOString() };
  if (input.resource === 'vote') {
    if (!data || !Array.isArray(data.votes)) throw new Error('Invalid Georgia vote detail');
    const votes = data.votes.filter((row: any) => input.member_id === undefined || row.member?.id === input.member_id);
    return { ...provenance, ...(isReviewedGeorgiaAttendance(input.vote_id) ? { attendance: true } : {}),
      session: data.session, legislation: data.legislation, total: votes.length,
      member_identity_conflict: input.member_id !== undefined && votes.length > 1,
      rows: votes.slice(input.offset, input.offset + input.limit).map((row: any) => ({ ...row,
        ...(georgiaChoices[row.memberVoted as number] ?? { choice: 'other', source_choice: String(row.memberVoted) }),
      })), warning: 'isRollCall means attendance in this source, not a recorded legislative vote. Missing members are unknown. This endpoint does not import data or reconcile Civic Pulse identities.' };
  }
  if (!Array.isArray(data)) throw new Error('Invalid Georgia source list');
  const rows = input.member_id === undefined ? data : data.filter((row: any) => row.id === input.member_id);
  return { ...provenance, total: rows.length, rows: rows.slice(input.offset, input.offset + input.limit).map(row => input.resource === 'votes' ? { ...row, attendance: isGeorgiaAttendance(row) } : row) };
}

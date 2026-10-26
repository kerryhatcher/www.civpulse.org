import { expect, test } from 'bun:test';
import { readGeorgiaSource } from '../../apps/mcp/src/georgia-source';

test('Georgia source uses official member IDs, retains codes and never invents a missing vote', async () => {
  const requests: string[] = [];
  const fetcher = (async (url: string, options: RequestInit) => {
    requests.push(url);
    if (url.includes('authentication/token')) return Response.json('public-site-token');
    expect(options.headers).toEqual({ Authorization: 'Bearer public-site-token' });
    return Response.json({ session: { id: 1033 }, legislation: [{ description: 'SB 359' }], votes: [
      { member: { id: 4942, name: 'MCLAURIN, 14TH' }, memberVoted: 2 },
      { member: { id: 99, name: 'MCLAURIN, 14TH' }, memberVoted: 0 },
    ] });
  }) as typeof fetch;
  const input = { resource: 'vote' as const, vote_id: 26646, member_id: 4942, limit: 25, offset: 0 };
  const result = await readGeorgiaSource(input, fetcher);
  expect(result.rows).toEqual([{ member: { id: 4942, name: 'MCLAURIN, 14TH' }, memberVoted: 2, choice: 'excused', source_choice: 'Excused' }]);
  expect(result.source_url).toBe('https://www.legis.ga.gov/api/Vote/detail/26646');
  expect(JSON.stringify(result)).not.toContain('public-site-token');
  expect((await readGeorgiaSource({ ...input, member_id: 123 }, fetcher)).rows).toEqual([]);
  expect(requests.every(url => url.startsWith('https://www.legis.ga.gov/api/'))).toBe(true);
});

test('Georgia lists paginate without discarding attendance flags and reject incomplete requests', async () => {
  const fetcher = (async (url: string) => Response.json(url.includes('authentication/token') ? 'token' : [
    { id: 1, isRollCall: true }, { id: 2, isRollCall: false },
  ])) as typeof fetch;
  const result = await readGeorgiaSource({ resource: 'votes', chamber: 'house', session_id: 27, offset: 1, limit: 1 }, fetcher);
  expect(result.total).toBe(2);
  expect(result.rows).toEqual([{ id: 2, isRollCall: false, attendance: false }]);
  await expect(readGeorgiaSource({ resource: 'votes', offset: 0, limit: 1 }, fetcher)).rejects.toThrow('Supply session_id and chamber');
  await expect(readGeorgiaSource({ resource: 'sessions', offset: 0, limit: 1 }, (async () => new Response('', { status: 503 })) as typeof fetch)).rejects.toThrow('HTTP 503');
});

test('attendance detection handles mislabeled source flags without excluding procedural motions', async () => {
  const { isGeorgiaAttendance } = await import('../../apps/mcp/src/georgia-source');
  expect(isGeorgiaAttendance({isRollCall:false,caption:'AFTERNOON ROLL CALL'})).toBe(true);
  expect(isGeorgiaAttendance({isRollCall:true,caption:'Other'})).toBe(true);
  expect(isGeorgiaAttendance({isRollCall:false,caption:'MOTION TO CONFIRM WITH ONE ROLL CALL'})).toBe(false);
  expect(isGeorgiaAttendance({id:21003,isRollCall:false,caption:'SECOND READING OF BILLS AND RESOLUTIONS'})).toBe(true);
  expect(isGeorgiaAttendance({id:21004,isRollCall:false,caption:'SECOND READING OF BILLS AND RESOLUTIONS'})).toBe(false);
});

test('reviewed attendance is exposed in both Georgia lists and detail without altering source choices', async () => {
  const source={id:21003,isRollCall:false,caption:'SECOND READING OF BILLS AND RESOLUTIONS'};
  const fetcher=(async(url:string)=>Response.json(url.includes('authentication/token')?'token':
    url.includes('Vote/list')?[source]:{session:{id:1031},legislation:[],votes:[{member:{id:4942},memberVoted:0}]})) as typeof fetch;
  const list=await readGeorgiaSource({resource:'votes',chamber:'senate',session_id:1031,limit:25,offset:0},fetcher);
  expect(list.rows[0]).toEqual({...source,attendance:true});
  const detail=await readGeorgiaSource({resource:'vote',vote_id:21003,limit:25,offset:0},fetcher);
  expect(detail.attendance).toBe(true);
  expect(detail.rows[0]).toMatchObject({memberVoted:0,choice:'yes',source_choice:'Yea'});
});

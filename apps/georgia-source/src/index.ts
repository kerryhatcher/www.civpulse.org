import { readGeorgiaSource, type GeorgiaSourceInput } from '../../mcp/src/georgia-source';

/** Public, read-only source reader. No arbitrary URLs, imports, or Civic Pulse data. */
export function parseSourceRequest(url: URL): GeorgiaSourceInput {
  const allowed = new Set(['resource','session_id','chamber','vote_id','member_id','limit','offset']);
  if (url.pathname !== '/' || url.search.length > 1000) throw Error('Invalid source request');
  for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw Error('Invalid source parameter');
  const resource = url.searchParams.get('resource');
  if (!['sessions','members','votes','vote'].includes(resource ?? '')) throw Error('Invalid resource');
  const number = (name: string, fallback?: number, min = 1, max = 2147483647) => {
    const value = url.searchParams.get(name);
    if (value === null) return fallback;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw Error('Invalid numeric parameter');
    return Number(value);
  };
  const chamber = url.searchParams.get('chamber');
  if (chamber !== null && chamber !== 'house' && chamber !== 'senate') throw Error('Invalid chamber');
  const input: GeorgiaSourceInput = {resource: resource as GeorgiaSourceInput['resource'],session_id:number('session_id'),vote_id:number('vote_id'),member_id:number('member_id'),limit:number('limit',25,1,100)!,offset:number('offset',0,0,1000000)!};
  if (chamber) input.chamber = chamber;
  if (input.resource === 'vote' && !input.vote_id) throw Error('Supply vote_id');
  if (['votes','members'].includes(input.resource) && (!input.session_id || !input.chamber)) throw Error('Supply session_id and chamber');
  return input;
}
export async function handleSourceRequest(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if (request.method !== 'GET') return Response.json({error:'Method not allowed'},{status:405,headers:{...headers,Allow:'GET'}});
  let input: GeorgiaSourceInput;
  try { input = parseSourceRequest(new URL(request.url)); }
  catch { return Response.json({error:'Invalid Georgia source request'},{status:400,headers}); }
  try { return Response.json(await readGeorgiaSource(input,fetcher),{headers}); }
  catch (error) {
    // Adapter errors contain a stage/status, never the handshake URL or token.
    return Response.json({error:error instanceof Error ? error.message : 'Georgia source unavailable'},{status:502,headers});
  }
}
export default {fetch: (request: Request) => handleSourceRequest(request)};

/** Georgia SOS bulk feeds. Raw source IDs stay independent of editorial contests/people. */
export const SOS_URL = /^https:\/\/results\.sos\.ga\.gov\/cdn\/results\/Georgia\/export-[A-Za-z0-9_-]+\.json$/;
const MAX_BYTES = 256 * 1024 * 1024;
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected source object');
  return value as ObjectValue;
}
function label(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
export interface SourceItem { jurisdiction_index: number; item_index: number; data: ObjectValue }
export function prepareSosResults(text: string, electionDate: string) {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error('Feed exceeds 256 MiB');
  const feed = object(JSON.parse(text));
  if (feed.electionDate !== electionDate || !label(feed.electionName) || !label(feed.createdAt)
    || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(feed.createdAt) || !Number.isFinite(Date.parse(feed.createdAt))) throw Error('Invalid feed identity/date');
  if (!Array.isArray(feed.localResults) || feed.localResults.length > 159) throw Error('Invalid localResults');
  const { results, localResults, ...header } = feed;
  const scopes = [object(results), ...localResults.map(object)];
  const ids = new Set<string>();
  const items: SourceItem[] = [];
  const jurisdictions = scopes.map((scope, jurisdiction_index) => {
    if (!label(scope.id) || ids.has(scope.id) || !label(scope.name) || !Array.isArray(scope.reportingStatuses)
      || !Array.isArray(scope.ballotItems) || scope.ballotItems.length > 99999) throw Error('Invalid/duplicate jurisdiction');
    ids.add(scope.id);
    const itemIds = new Set<string>();
    scope.ballotItems.forEach((value, item_index) => {
      const data = object(value);
      if (!label(data.id) || itemIds.has(data.id) || !label(data.name) || !Array.isArray(data.ballotOptions)) throw Error('Invalid/duplicate ballot item');
      itemIds.add(data.id);
      // Missing/null counts and all unknown source fields remain untouched.
      items.push({jurisdiction_index, item_index, data});
    });
    const {ballotItems, ...metadata} = scope;
    return {...metadata, item_count: ballotItems.length};
  });
  return {header, jurisdictions, items, sha256: new Bun.CryptoHasher('sha256').update(text).digest('hex')};
}

export async function fetchSosResults(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!SOS_URL.test(url)) throw Error('Only Georgia SOS export JSON URLs are supported');
  const response = await fetcher(url, {redirect:'error', signal:AbortSignal.timeout(120_000), cache:'no-store'});
  if (!response.ok) throw Error(`SOS feed HTTP ${response.status}; previous results remain current`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw Error('Feed exceeds 256 MiB');
  if (!response.body) throw Error('Empty SOS response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal:true});
  let bytes = 0; const parts: string[] = [];
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw Error('Feed exceeds 256 MiB');
      parts.push(decoder.decode(value, {stream:true}));
    }
    parts.push(decoder.decode());
  } finally { await reader.cancel(); }
  return parts.join('');
}
export function* itemBatches(items: SourceItem[]) {
  let batch: SourceItem[] = [], size = 2;
  for (const item of items) {
    const bytes = new TextEncoder().encode(JSON.stringify(item)).length + 1;
    if (bytes > 2 * 1024 * 1024) throw Error('Ballot item exceeds 2 MiB; review feed schema');
    if (batch.length && (batch.length >= 50 || size + bytes > 2 * 1024 * 1024)) {yield batch; batch=[]; size=2;}
    batch.push(item); size += bytes;
  }
  if (batch.length) yield batch;
}

type Api = (path: string, body?: unknown) => Promise<any>;
export async function refreshSosResults(api: Api, electionId: string, apply: boolean, fetcher: typeof fetch = fetch) {
  const [election] = await api(`elections?id=eq.${encodeURIComponent(electionId)}&select=election_date,results_json_url`);
  if (!election) throw Error('Election not found or not permitted');
  if (!election.results_json_url) return {status:'awaiting_url'};
  const text = await fetchSosResults(election.results_json_url, fetcher);
  const feed = prepareSosResults(text, election.election_date);
  // Materialize batches before staging so validation errors cannot leave partial imports.
  const batches = [...itemBatches(feed.items)];
  if (!apply) return {status:'validated', jurisdictions:feed.jurisdictions.length, items:feed.items.length, sha256:feed.sha256};
  const current = await api('rpc/get_sos_results', {p_election_id:electionId});
  if (current.source_sha256 === feed.sha256) return {status:'unchanged', snapshot_id:current.snapshot_id};
  const snapshot = await api('rpc/begin_sos_results', {p_election_id:electionId,p_source_url:election.results_json_url,p_sha256:feed.sha256,p_header:feed.header,p_jurisdictions:feed.jurisdictions});
  for (const items of batches) await api('rpc/stage_sos_results', {p_snapshot_id:snapshot,p_items:items});
  await api('rpc/publish_sos_results', {p_snapshot_id:snapshot,p_expected_snapshot_id:current.snapshot_id ?? null});
  return {status:'published', snapshot_id:snapshot, jurisdictions:feed.jurisdictions.length,items:feed.items.length};
}

if (import.meta.main) {
  try {
    const [id, flag] = Bun.argv.slice(2);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || (flag && flag !== '--apply')) throw Error('Usage: bun run scripts/sos-results.ts <election UUID> [--apply]');
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!url || !key || !token) throw Error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_ACCESS_TOKEN (administrator session token)');
    const origin = new URL(url);
    if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(origin.hostname))) throw Error('Supabase requires HTTPS outside localhost');
    const api: Api = async(path, body) => {
      const response = await fetch(new URL(`/rest/v1/${path}`, origin), {method:body === undefined ? 'GET' : 'POST', headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(60_000), redirect:'error'});
      if (!response.ok) throw Error(`Database HTTP ${response.status}: ${await response.text()}`);
      return response.status === 204 ? null : response.json();
    };
    console.log(JSON.stringify(await refreshSosResults(api,id,flag==='--apply')));
  } catch (error) { console.error(error instanceof Error ? error.message : 'Results refresh failed'); process.exitCode=1; }
}

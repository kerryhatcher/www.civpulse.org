import { afterAll, beforeAll, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const base = process.env.SOS_ADMIN_TEST_URL;
const id = '03600000-0000-4000-8000-000000000001';
const actor = '03600000-0000-4000-8000-000000000002';
const source = 'https://results.sos.ga.gov/cdn/results/Georgia/export-AdminFixture.json';
const starts = new Date(Date.now() - 3_600_000).toISOString();
const ends = new Date(Date.now() + 8 * 86_400_000).toISOString();
const transition = new Date(Date.now() + 3_600_000).toISOString();
let browser: Browser;
beforeAll(async () => {
  if (!base) return;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw Error('Local fixture website required');
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined });
});
afterAll(async () => { await browser?.close(); });

type Call = { name: string; args: Record<string, any>; authorization: string | undefined };
async function fixture(role: 'anon' | 'user' | 'admin', width = 1280, mappingCount = 2, visibility: 'public' | 'private' | 'unlisted' = 'public') {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`); });
  const calls: Call[] = [];
  let election = { id, slug: 'synthetic-admin-fixture', name: 'Synthetic administration fixture', election_date: '2026-11-03', kind: 'general', visibility, results_json_url: source, description: null, organization_id: null };
  let feed: any = null;
  let mismatchWindow = false;
  const question = '03600000-0000-4000-8000-000000000004';
  const snapshot = '03600000-0000-4000-8000-000000000005';
  const rowNumbers = Array.from({length:mappingCount}, (_, index) => index + 1);
  const questionIds = rowNumbers.map(n => n === 1 ? question : n === 2 ? actor : `03600000-0000-4000-8000-${String(n+3).padStart(12,'0')}`);
  const ballotQuestions = rowNumbers.map(n => ({id:questionIds[n-1],title:`Curated question ${n}`,question_text:`Verified full wording ${n}`,choices:['Yes','No']}));
  const sourceItems: any[] = rowNumbers.map(n => ({jurisdiction_index:0,item_index:n-1,data:{id:`Q${n}`,name:`Official question ${n}`,type:'question',voteFor:1,ballotOptions:[{id:`Y${n}`,name:'Yes',politicalParty:'fixture-party',voteCount:0},{id:`N${n}`,name:'No',voteCount:null}]}}));
  const mappings: any[] = [];
  const mappingReadbacks: any[][] = [];
  const sourceRequests: string[] = [];
  let sourceSnapshot = snapshot, sourceRevision = 1;
  let mappingFailure = 0;
  await page.route('https://files-test.civpulse.org/**', route => {
    sourceRequests.push(route.request().url());
    const assetBase = `https://files-test.civpulse.org/elections/${id}/revisions/${sourceSnapshot}`;
    return route.fulfill({ json: route.request().url().endsWith('/latest.json') ? {
      schema_version:1,election_id:id,snapshot_id:sourceSnapshot,revision:String(sourceRevision),source_url:source,published_at:starts,source_created_at:starts,
      jurisdictions:[{id:'011',name:'Bibb County',url:`${assetBase}/counties/011.json`,item_count:mappingCount}],
    } : {schema_version:1,election_id:id,snapshot_id:sourceSnapshot,jurisdiction:{id:'011',name:'Bibb County'},items:sourceItems} });
  });
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'synthetic-admin@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: actor, role: 'authenticated', aud: 'authenticated', iat: 1, exp: Math.floor(Date.now() / 1000) + 3600 }))}.synthetic-fixture-signature`;
  if (role !== 'anon') await context.addInitScript(({ token, user }) => {
    // Synthetic local SDK session only; no real token or browser session is read.
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: token, refresh_token: 'synthetic-local-only', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }));
  }, { token, user });
  await page.route('**/county-data.json', route => route.fulfill({ json: {} }));
  await page.route('**/auth/v1/**', route => route.fulfill({ json: user }));
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Hosted API request forbidden');
    const name = url.pathname.split('/').pop()!;
    if (!url.pathname.includes('/rpc/')) {
      if (name === 'admins') return route.fulfill({ json: role === 'admin' ? [{ user_id: actor }] : [] });
      if (name === 'profiles') return route.fulfill({ json: { id: actor, display_name: 'Synthetic operator', full_name: 'Synthetic operator' } });
      if (name === 'elections') {
        if (request.method() === 'PATCH') election = { ...election, ...request.postDataJSON() };
        return route.fulfill({ json: request.method() === 'GET' ? [election] : [] });
      }
      return route.fulfill({ json: [] });
    }
    const args = request.postDataJSON();
    calls.push({ name, args, authorization: request.headers().authorization });
    if (name === 'get_sos_results_health') {
      const visible = feed && election.visibility === 'public' && election.results_json_url === feed.source_url;
      return route.fulfill({ json: visible ? { status: feed.enabled ? 'healthy' : 'paused', ...feed, current_revision: '9007199254740993', pending_since: null, last_success_at: null, next_poll_at: null } : { status: 'missing' } });
    }
    if (role !== 'admin') throw Error('A denied fixture unexpectedly attempted an administrative mutation');
    if (name === 'get_election') return route.fulfill({json:{status:'ok',election,contests:[],ballot_questions:ballotQuestions}});
    if (name === 'get_sos_results') return route.fulfill({json:args.p_snapshot_id ? {
      status:'ok',snapshot_id:sourceSnapshot,items:sourceItems.slice(args.p_offset,args.p_offset+args.p_limit),
    } : {status:'ok',snapshot_id:sourceSnapshot,source_url:election.results_json_url,jurisdictions:[{id:'011',name:'Bibb County',item_count:mappingCount}]}});
    if (name === 'get_sos_results_mappings') {
      mappingReadbacks.push(structuredClone(mappings));
      return route.fulfill({json:{status:'ok',mappings}});
    }
    if (name === 'put_sos_results_mapping') {
      if (mappingFailure && calls.filter(c => c.name === name).length === mappingFailure) return route.fulfill({status:400,json:{message:'Synthetic rejected row'}});
      const row = {jurisdiction_id:args.p_jurisdiction_id,source_contest_id:args.p_source_contest_id,contest_id:args.p_contest_id,question_id:args.p_question_id,choices:args.p_choices};
      const index = mappings.findIndex(m => m.jurisdiction_id === row.jurisdiction_id && m.source_contest_id === row.source_contest_id);
      if (index < 0) mappings.push(row); else mappings[index] = row;
      return route.fulfill({body:''});
    }
    if (name === 'configure_sos_results_feed') {
      if (!feed) feed = { election_id: id, source_url: election.results_json_url, starts_at: args.p_starts_at, ends_at: args.p_ends_at, poll_interval_seconds: 300, poll_transition_at: null, enabled: false };
      feed.enabled = args.p_enabled;
      if (args.p_enabled) { feed.starts_at = args.p_starts_at; feed.ends_at = args.p_ends_at; }
      return route.fulfill({ json: feed });
    }
    if (name === 'configure_sos_results_poll_cadence') {
      expect(feed.enabled).toBe(false);
      Object.assign(feed, { poll_interval_seconds: args.p_interval_seconds, poll_transition_at: args.p_transition_at, poll_after_interval_seconds: args.p_after_interval_seconds });
      return route.fulfill({ json: feed });
    }
    if (name === 'configure_sos_results_feed_window') {
      expect(feed.enabled).toBe(false);
      Object.assign(feed, { starts_at: args.p_starts_at, ends_at: args.p_ends_at });
      return route.fulfill({ json: { ...feed, ends_at: mismatchWindow ? starts : feed.ends_at } });
    }
    if (name === 'recover_sos_results_job') return route.fulfill({ json: null });
    throw Error(`Unexpected RPC: ${name}`);
  });
  await page.goto(`${base}/admin/elections/`);
  return { page, context, errors, calls, token, setMismatch: () => { mismatchWindow = true; }, feed: () => feed, failMapping: (n:number) => {mappingFailure=n;}, question, questionIds, mappingReadbacks, sourceRequests,
    changeQuestion: () => {ballotQuestions[0].question_text = 'Changed by another administrator';},
    changeElection: (field: 'election_date' | 'results_json_url') => {election[field] = field === 'election_date' ? '2026-11-04' : 'https://results.sos.ga.gov/cdn/results/Georgia/export-OtherElection.json';},
    advanceSource: (mutate: (items: any[]) => void) => {mutate(sourceItems);sourceSnapshot='03600000-0000-4000-8000-000000000007';sourceRevision++;},
  };
}
async function configure(page: Page) {
  await page.locator('[data-sos-election]').selectOption(id);
  await page.locator('[data-sos-health]').filter({ hasText: 'Status: missing' }).waitFor();
  await page.locator('[name=sos_starts_at]').fill(starts);
  await page.locator('[name=sos_ends_at]').fill(ends);
  await page.locator('[name=sos_transition_at]').fill(transition);
  await page.locator('[name=sos_reviewed]').check();
  await page.getByRole('button', { name: 'Configure paused feed', exact: true }).click();
  await page.locator('[data-sos-health]').filter({ hasText: 'Status: paused' }).waitFor();
}

test.skipIf(!base)('mapping file review requires explicit approval, invalidates edited JSON and verifies saved readback', async () => {
  const f = await fixture('admin',390);
  try {
    await f.page.locator('[data-mapping-election]').selectOption(id);
    const rows = [{jurisdiction_id:'011',source_contest_id:'Q1',question_id:f.question,choices:[{source_choice_id:'Y1',choice_label:'Yes'},{source_choice_id:'N1',choice_label:'No'}]}];
    await f.page.locator('[data-mapping-file]').setInputFiles({name:'reviewed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rows))});
    await f.page.locator('[data-mapping-status]').filter({hasText:'File loaded'}).waitFor();
    await f.page.locator('[data-mapping-preview]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'Validated 1 mappings'}).waitFor();
    expect(await f.page.locator('[data-mapping-preview-text]').textContent()).toContain('Verified full wording');
    expect(await f.page.locator('[data-mapping-save]').isDisabled()).toBe(true);
    expect(f.calls.filter(c => c.name === 'put_sos_results_mapping')).toHaveLength(0);
    await f.page.locator('[data-mapping-reviewed]').check();
    await f.page.locator('[data-mapping-json]').fill(JSON.stringify(rows)+' ');
    expect(await f.page.locator('[data-mapping-save]').isDisabled()).toBe(true);
    await f.page.locator('[data-mapping-preview]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'Validated 1 mappings'}).waitFor();
    await f.page.locator('[data-mapping-reviewed]').check();
    await f.page.locator('[data-mapping-save]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'1/1 mappings verified'}).waitFor();
    expect(f.calls.filter(c => c.name === 'put_sos_results_mapping')[0].authorization).toBe(`Bearer ${f.token}`);
    expect(await f.page.locator('[data-mapping-save]').isDisabled()).toBe(true);
    expect(f.errors).toEqual([]);
  } finally {await f.context.close();}
},30_000);

test.skipIf(!base)('mapping batch stops on a rejected row and reports the committed partial readback', async () => {
  const f = await fixture('admin');
  try {
    await f.page.locator('[data-mapping-election]').selectOption(id);
    const rows = [1,2].map(n => ({jurisdiction_id:'011',source_contest_id:`Q${n}`,question_id:n === 1 ? f.question : actor,choices:[{source_choice_id:`Y${n}`,choice_label:'Yes'}]}));
    await f.page.locator('[data-mapping-json]').fill(JSON.stringify(rows));
    await f.page.locator('[data-mapping-preview]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'Validated 2 mappings'}).waitFor();
    f.failMapping(1);
    await f.page.locator('[data-mapping-reviewed]').check();
    await f.page.locator('[data-mapping-save]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'0/2 mappings verified'}).waitFor();
    expect(f.calls.filter(c => c.name === 'put_sos_results_mapping')).toHaveLength(1);
    expect(await f.page.locator('[data-mapping-save]').isDisabled()).toBe(true);
    // The rejected fixture HTTP response intentionally produces a browser network diagnostic.
    expect(f.errors.filter(e => !e.startsWith('Failed to load resource:'))).toEqual([]);
  } finally {await f.context.close();}
},30_000);

for (const mappingCount of [2,3]) test.skipIf(!base)(`mapping batch preserves the first commit after a later rejection (1/${mappingCount})`, async () => {
  const f = await fixture('admin',1280,mappingCount);
  try {
    await f.page.locator('[data-mapping-election]').selectOption(id);
    const rows = Array.from({length:mappingCount}, (_, index) => {
      const n = index + 1;
      return {jurisdiction_id:'011',source_contest_id:`Q${n}`,question_id:f.questionIds[index],choices:[{source_choice_id:`Y${n}`,choice_label:'Yes'}]};
    });
    await f.page.locator('[data-mapping-json]').fill(JSON.stringify(rows));
    await f.page.locator('[data-mapping-preview]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:`Validated ${mappingCount} mappings`}).waitFor();
    expect(f.mappingReadbacks).toEqual([[]]);
    f.failMapping(2);
    await f.page.locator('[data-mapping-reviewed]').check();
    await f.page.locator('[data-mapping-save]').click();
    const status = f.page.locator('[data-mapping-status]');
    await status.filter({hasText:`1/${mappingCount} mappings verified in saved readback`}).waitFor();
    expect(await status.textContent()).toContain('Request rejected: put_sos_results_mapping');
    expect(await status.textContent()).not.toContain('Synthetic rejected row');
    expect(await status.textContent()).toContain('1 requests acknowledged. Earlier accepted rows remain saved');
    const writes = f.calls.filter(c => c.name === 'put_sos_results_mapping');
    expect(writes.map(c => c.args.p_source_contest_id)).toEqual(['Q1','Q2']);
    expect(writes.every(c => c.authorization === `Bearer ${f.token}`)).toBe(true);
    expect(f.calls.at(-1)?.name).toBe('get_sos_results_mappings');
    expect(f.mappingReadbacks).toEqual([[],[{...rows[0],contest_id:null}]]);
    expect(await f.page.locator('[data-mapping-save]').isDisabled()).toBe(true);
    expect(await f.page.locator('[data-mapping-reviewed]').isChecked()).toBe(false);
    // The rejected fixture HTTP response intentionally produces a browser network diagnostic.
    expect(f.errors.filter(e => !e.startsWith('Failed to load resource:'))).toEqual([]);
  } finally {await f.context.close();}
},30_000);

for (const change of ['question','election_date','results_json_url','source_name','source_party','source_membership'] as const) test.skipIf(!base)(`mapping save rechecks changed ${change} before any write`, async () => {
  const f = await fixture('admin');
  try {
    await f.page.locator('[data-mapping-election]').selectOption(id);
    const rows = [{jurisdiction_id:'011',source_contest_id:'Q1',question_id:f.question,choices:[{source_choice_id:'Y1',choice_label:'Yes'}]}];
    await f.page.locator('[data-mapping-json]').fill(JSON.stringify(rows));
    await f.page.locator('[data-mapping-preview]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'Validated 1 mappings'}).waitFor();
    if (change === 'question') f.changeQuestion();
    else if (change === 'election_date' || change === 'results_json_url') f.changeElection(change);
    else f.advanceSource(items => {
      if (change === 'source_name') items[0].data.name = 'Changed official question';
      else if (change === 'source_party') items[0].data.ballotOptions[0].politicalParty = 'changed-party';
      else items[0].data.ballotOptions.push({id:'new-option',name:'New choice',voteCount:0});
    });
    await f.page.locator('[data-mapping-reviewed]').check();
    await f.page.locator('[data-mapping-save]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'0/1 mappings verified'}).waitFor();
    expect(await f.page.locator('[data-mapping-status]').textContent()).toContain('changed');
    expect(f.calls.filter(call => call.name === 'put_sos_results_mapping')).toHaveLength(0);
    expect(f.calls.filter(call => call.name === 'get_election')).toHaveLength(2);
    expect(await f.page.locator('[data-mapping-save]').isDisabled()).toBe(true);
    expect(f.errors).toEqual([]);
  } finally {await f.context.close();}
},30_000);

test.skipIf(!base)('a new source snapshot with only vote changes preserves reviewed identities and can save', async () => {
  const f = await fixture('admin');
  try {
    await f.page.locator('[data-mapping-election]').selectOption(id);
    const rows = [{jurisdiction_id:'011',source_contest_id:'Q1',question_id:f.question,choices:[{source_choice_id:'Y1',choice_label:'Yes'}]}];
    await f.page.locator('[data-mapping-json]').fill(JSON.stringify(rows));
    await f.page.locator('[data-mapping-preview]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'Validated 1 mappings'}).waitFor();
    f.advanceSource(items => {items[0].data.ballotOptions[0].voteCount = 42;});
    await f.page.locator('[data-mapping-reviewed]').check();
    await f.page.locator('[data-mapping-save]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'1/1 mappings verified'}).waitFor();
    expect(f.sourceRequests.filter(url => url.endsWith('/latest.json'))).toHaveLength(2);
    expect(f.sourceRequests.some(url => url.includes('/03600000-0000-4000-8000-000000000007/'))).toBe(true);
    expect(f.calls.filter(call => call.name === 'put_sos_results_mapping')).toHaveLength(1);
    expect(f.errors).toEqual([]);
  } finally {await f.context.close();}
},30_000);

test.skipIf(!base)('private mapping preview pins and paginates its gated source snapshot without public asset reads', async () => {
  const f = await fixture('admin',1280,11,'private');
  try {
    await f.page.locator('[data-mapping-election]').selectOption(id);
    const rows = [{jurisdiction_id:'011',source_contest_id:'Q1',question_id:f.question,choices:[{source_choice_id:'Y1',choice_label:'Yes'}]}];
    await f.page.locator('[data-mapping-json]').fill(JSON.stringify(rows));
    await f.page.locator('[data-mapping-preview]').click();
    await f.page.locator('[data-mapping-status]').filter({hasText:'Validated 1 mappings'}).waitFor();
    const reads = f.calls.filter(call => call.name === 'get_sos_results');
    expect(reads.map(call => call.args)).toEqual([
      {p_election_id:id},
      {p_election_id:id,p_snapshot_id:'03600000-0000-4000-8000-000000000005',p_jurisdiction_index:0,p_offset:0,p_limit:10},
      {p_election_id:id,p_snapshot_id:'03600000-0000-4000-8000-000000000005',p_jurisdiction_index:0,p_offset:10,p_limit:10},
    ]);
    expect(reads.every(call => call.authorization === `Bearer ${f.token}`)).toBe(true);
    expect(f.sourceRequests).toEqual([]);
    expect(f.calls.filter(call => call.name === 'put_sos_results_mapping')).toHaveLength(0);
    expect(f.errors).toEqual([]);
  } finally {await f.context.close();}
},30_000);

for (const role of ['anon', 'user'] as const) test.skipIf(!base)(`${role} cannot reach SOS administrative controls or issue mutations`, async () => {
  const f = await fixture(role);
  try {
    if (role === 'anon') await f.page.waitForURL('**/signin/?next=/admin/elections/');
    else await f.page.locator('[data-admin-denied]').waitFor({ state: 'visible' });
    expect(await f.page.locator('[data-admin-panel]').isVisible()).toBe(false);
    expect(f.calls).toHaveLength(0);
    expect(f.errors).toEqual([]);
  } finally { await f.context.close(); }
});

for (const width of [1280, 390]) test.skipIf(!base)(`admin verifies paused configuration, explicit activation and pause at ${width}px`, async () => {
  const f = await fixture('admin', width);
  try {
    await f.page.locator('[data-admin-panel]').waitFor({ state: 'visible' });
    expect(await f.page.title()).toContain('Elections admin');
    expect(await f.page.getByRole('heading', { name: 'Automatic SOS results', exact: true }).isVisible()).toBe(true);
    expect(await f.page.locator('[data-sos-activate]').isDisabled()).toBe(true);
    await configure(f.page);
    await f.page.locator('[data-sos-message]').filter({ hasText: 'Feed configured and verified while paused' }).waitFor();
    expect(f.feed().enabled).toBe(false);
    expect(f.calls.filter(call => call.args.p_enabled === true)).toHaveLength(0);
    expect(f.calls.filter(call => call.name !== 'get_sos_results_health').map(call => call.name)).toEqual(['configure_sos_results_feed','configure_sos_results_poll_cadence','configure_sos_results_feed_window']);
    expect(await f.page.locator('[data-sos-source]').innerText()).toBe(source);
    expect(await f.page.locator('[data-sos-id]').innerText()).toBe(id);
    expect(await f.page.locator('[data-sos-date]').innerText()).toContain('2026-11-03 · public');
    expect(await f.page.locator('[data-sos-activate]').isDisabled()).toBe(true);
    await f.page.locator('[name=sos_accepted]').check();
    expect(await f.page.locator('[data-sos-activate]').isEnabled()).toBe(true);
    await f.page.locator('[data-sos-admin]').screenshot({ path: join(tmpdir(),`sos-admin-${width}.png`) });
    expect(await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await f.page.getByRole('button', { name: 'Activate reviewed feed', exact: true }).click();
    await f.page.locator('[data-sos-message]').filter({ hasText: 'Reviewed feed activated' }).waitFor();
    expect(f.feed().enabled).toBe(true);
    expect(f.calls.filter(call => call.args.p_enabled === true)).toHaveLength(1);
    expect(f.calls.every(call => call.authorization === `Bearer ${f.token}`)).toBe(true);
    await f.page.getByRole('button', { name: 'Pause selected feed', exact: true }).click();
    await f.page.locator('[data-sos-message]').filter({ hasText: 'Feed paused.' }).waitFor();
    expect(f.feed().enabled).toBe(false);
    expect(f.errors).toEqual([]);
  } finally { await f.context.close(); }
},30_000);

test.skipIf(!base)('mismatched persisted window prevents activation and never requests enable', async () => {
  const f = await fixture('admin');
  try {
    f.setMismatch(); await configure(f.page);
    await f.page.locator('[data-sos-message]').filter({ hasText: 'saved polling window could not be verified' }).waitFor();
    await f.page.locator('[name=sos_accepted]').check();
    expect(await f.page.locator('[data-sos-activate]').isDisabled()).toBe(true);
    expect(f.calls.filter(call => call.args.p_enabled === true)).toHaveLength(0);
    expect(f.feed().enabled).toBe(false); expect(f.errors).toEqual([]);
  } finally { await f.context.close(); }
});

test.skipIf(!base)('source changes invalidate review; emergency pause and explicit abandon retain evidence', async () => {
  const f = await fixture('admin');
  try {
    await configure(f.page);
    await f.page.locator('[name=sos_accepted]').check();
    await f.page.locator('[data-election-list]').getByRole('button', { name: 'Edit', exact: true }).click();
    await f.page.locator('[name=results_json_url]').fill('https://results.sos.ga.gov/cdn/results/Georgia/export-ChangedFixture.json');
    await f.page.locator('[data-election-form]').getByRole('button', { name: 'Save changes', exact: true }).click();
    await f.page.locator('[data-sos-source]').filter({ hasText: 'export-ChangedFixture' }).waitFor();
    expect(await f.page.locator('[data-sos-activate]').isDisabled()).toBe(true);
    await f.page.locator('[data-sos-health]').filter({ hasText: 'does not confirm' }).waitFor();
    await f.page.locator('[data-sos-pause]').click();
    await f.page.locator('[data-sos-message]').filter({ hasText: 'Feed paused.' }).waitFor();
    await f.page.getByText('Recover queued or quarantined work', { exact: true }).click();
    await f.page.locator('[data-sos-retry]').click();
    await f.page.locator('[data-sos-message]').filter({ hasText: 'scheduled for retry' }).waitFor();
    f.page.once('dialog', dialog => dialog.dismiss()); await f.page.locator('[data-sos-abandon]').click();
    expect(f.calls.filter(call => call.args.p_action === 'abandon')).toHaveLength(0);
    f.page.once('dialog', dialog => dialog.accept()); await f.page.locator('[data-sos-abandon]').click();
    await f.page.locator('[data-sos-message]').filter({ hasText: 'Evidence was not deleted' }).waitFor();
    expect(f.calls.filter(call => call.args.p_action === 'abandon')).toHaveLength(1);
    expect(f.calls.filter(call => call.args.p_enabled === true)).toHaveLength(0); expect(f.errors).toEqual([]);
  } finally { await f.context.close(); }
},30_000);

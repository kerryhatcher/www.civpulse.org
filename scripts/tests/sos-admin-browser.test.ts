import { afterAll, beforeAll, expect, test } from 'bun:test';
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
async function fixture(role: 'anon' | 'user' | 'admin', width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`); });
  const calls: Call[] = [];
  let election = { id, slug: 'synthetic-admin-fixture', name: 'Synthetic administration fixture', election_date: '2026-11-03', kind: 'general', visibility: 'public', results_json_url: source, description: null, organization_id: null };
  let feed: any = null;
  let mismatchWindow = false;
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
  return { page, context, errors, calls, token, setMismatch: () => { mismatchWindow = true; }, feed: () => feed };
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
    await f.page.locator('[data-sos-admin]').screenshot({ path: `/tmp/sos-admin-${width}.png` });
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

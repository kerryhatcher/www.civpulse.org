import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chromium, type Browser } from 'playwright';

// Run against the synthetic election in Astro dev/preview; turnout is entirely mocked.
const base = process.env.SOS_RESULTS_TEST_URL;
let browser: Browser;
beforeAll(async () => { if (base) browser = await chromium.launch({ channel: 'chrome', headless: true }); });
afterAll(async () => { await browser?.close(); });

test.skipIf(!base)('turnout refresh preserves values on error and displays new Election Day counts', async () => {
  const page = await browser.newPage();
  let revision = 1;
  let requests = 0;
  const cell = (value: number | null) => ({ value, display: value === null ? '' : String(value) });
  const row = (table: string, ballot_style: string, measures: Record<string, ReturnType<typeof cell>>) => ({
    table, ballot_style, measures, county_fips: '13021', county_label: 'Bibb',
    source_title: 'Synthetic source', as_of_label: 'Election Day',
  });
  await page.route('**/rest/v1/rpc/**', async route => {
    const rpc = new URL(route.request().url()).pathname.split('/').pop();
    if (rpc === 'get_structured_turnout') {
      requests++;
      if (revision === 3) return route.fulfill({ status: 503, json: { message: 'Synthetic outage' } });
      const rows = [
        row('early', 'Early In-Person', { accepted: cell(10) }),
        row('absentee', 'Absentee', { requested: cell(0), accepted: cell(null) }),
        ...(revision >= 2 ? [row('turnout', 'Election Day In-Person', { turnout: cell(42) })] : []),
      ];
      return route.fulfill({ json: { status: 'ok', report: { id: `report-${revision}`, captured_at: '2026-11-03T12:00:00Z', source_url: 'https://example.org/source' }, rows, total: rows.length } });
    }
    return route.fulfill({ json: rpc === 'get_sos_results_mappings' ? { status: 'ok', mappings: [] } : rpc === 'get_sos_results' ? { status: 'empty' } : false });
  });
  try {
    await page.clock.install();
    await page.goto(`${base}/elections/issue187-synthetic-results/`);
    const charts = page.locator('[data-turnout-charts]');
    await charts.getByText('Early voting ballots accepted').waitFor();
    const absentee = charts.locator('figure[data-table="absentee"]');
    const requested = absentee.locator('li').filter({ hasText: 'Requested' });
    const accepted = absentee.locator('li').filter({ hasText: 'Accepted' });
    expect(await requested.locator('strong').innerText()).toBe('0');
    expect(await requested.locator('.turnout-bar').count()).toBe(1);
    expect(await accepted.locator('strong').innerText()).toBe('Not reported');
    expect(await accepted.locator('.turnout-bar').count()).toBe(0);
    await charts.locator('figure').first().evaluate(element => element.setAttribute('data-test-unchanged', 'yes'));
    const firstRequests = requests;
    const unchangedResponse = page.waitForResponse(response => response.url().includes('/rpc/get_structured_turnout'));
    await page.clock.fastForward(30000);
    await unchangedResponse;
    expect(requests).toBeGreaterThan(firstRequests);
    expect(await charts.locator('[data-test-unchanged="yes"]').count()).toBe(1);
    revision = 2;
    await page.clock.fastForward(30000);
    const electionDay = charts.locator('li').filter({ hasText: 'Election Day In-Person' });
    await electionDay.waitFor();
    expect(await electionDay.locator('strong').innerText()).toBe('42');
    expect(await electionDay.locator('.turnout-bar').count()).toBe(1);
    await page.locator('[data-election-turnout]').screenshot({ path: '/tmp/turnout-election-day.png' });
    revision = 3;
    await page.clock.fastForward(30000);
    await page.getByText('Turnout updates are temporarily unavailable.', { exact: false }).waitFor();
    expect(await electionDay.locator('strong').innerText()).toBe('42');
    expect(await page.locator('[data-turnout-body]').isVisible()).toBe(true);
    const failedRetry = page.waitForResponse(response => response.url().includes('/rpc/get_structured_turnout'));
    await page.locator('[data-turnout-retry]').click();
    await failedRetry;
    await page.getByText('Turnout updates are temporarily unavailable.', { exact: false }).waitFor();
    expect(await electionDay.locator('strong').innerText()).toBe('42');
    expect(await page.locator('[data-turnout-body]').isVisible()).toBe(true);
    revision = 2;
    const recovery = page.waitForResponse(response => response.url().includes('/rpc/get_structured_turnout'));
    await page.locator('[data-turnout-retry]').click();
    await recovery;
    await page.waitForFunction(() => document.querySelector('[data-turnout-status]')?.hasAttribute('hidden'));
    expect(await electionDay.locator('strong').innerText()).toBe('42');
    expect(await page.locator('[data-turnout-retry]').isVisible()).toBe(false);
  } finally { await page.close(); }
}, 60000);

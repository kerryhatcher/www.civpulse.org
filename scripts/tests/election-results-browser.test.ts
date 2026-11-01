import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chromium, type Browser } from 'playwright';

// Run against Astro dev/preview; all report RPCs are synthetic, read-only fixtures.
const base = process.env.ELECTION_RESULTS_TEST_URL;
let browser: Browser;
beforeAll(async () => {
  if (base) browser = await chromium.launch({ channel: 'chrome', headless: true });
});
afterAll(async () => { await browser?.close(); });

for (const width of [1280, 390]) {
  test.skipIf(!base)(`public turnout counts and reporting-area controls at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const id = '295d864d-80c8-4a87-ab16-3f4f3fa5ddb7';
    const cases = [
      { unit: 'WA2', voters: 738, registered: null, ballots: null, percentage: 'Not reported' },
      { unit: 'EM1', voters: 266, registered: null, ballots: null, percentage: 'Not reported' },
      { unit: 'BOTH', voters: 25, registered: 100, ballots: 30, percentage: '25.00%' },
      { unit: 'ZERO', voters: 0, registered: null, ballots: 30, percentage: 'Not reported' },
      { unit: 'ZERO-RATE', voters: 0, registered: 100, ballots: 30, percentage: '0.00%' },
      { unit: 'MISSING', voters: null, registered: 100, ballots: null, percentage: 'Not reported' },
      { unit: 'ZERO-REG', voters: 25, registered: 0, ballots: null, percentage: 'Not reported' },
      { unit: 'BALLOTS', voters: null, registered: 100, ballots: 30, percentage: '30.00%' },
    ];
    await page.route('**/rest/v1/rpc/**', async route => {
      const rpc = new URL(route.request().url()).pathname.split('/').pop();
      const data = rpc === 'search_elections' ? [{ id, name: 'Synthetic turnout QA', election_date: '2026-11-03' }]
        : rpc === 'get_election' ? { status: 'ok', election: { id, name: 'Synthetic turnout QA' }, contests: [], ballot_questions: [] }
        : rpc === 'get_election_results' ? { status: 'ok', reports: cases.map(c => ({
          id: c.unit, scope: { county: 'Bibb', unit_type: 'precinct', unit: c.unit, counting_group: 'all', ballot_style: 'all' },
          observed_at: '2026-10-26T12:00:00Z', supersedes: null,
          snapshot: { status: 'unofficial', note: 'Synthetic QA: February 3, 2026 precinct assignment; 677 unmatched records excluded.',
            turnout: { voters: c.voters, ballots: c.ballots, registered: c.registered }, contests: [] },
        })) } : rpc === 'get_structured_turnout' ? { status: 'empty' } : false;
      await route.fulfill({ json: data });
    });
    try {
      await page.goto(`${base}/elections/results/?id=${id}`);
      expect(await page.title()).toContain('Election results');
      await page.locator('#result-filters:not([disabled])').waitFor();
      const report = page.locator('#result-reports .result-report');
      for (const c of cases) {
        await page.locator('#result-area').selectOption(JSON.stringify(['Bibb', 'precinct', c.unit]));
        await report.locator('h2').filter({ hasText: c.unit }).waitFor();
        const metric = (label: string) => report.locator('.result-metrics > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
        expect(await metric('Voters').textContent()).toBe(c.voters === null ? 'Not reported' : String(c.voters));
        expect(await metric('Ballots cast').textContent()).toBe(c.ballots === null ? 'Not reported' : String(c.ballots));
        expect(await metric('Registered voters').textContent()).toBe(c.registered === null ? 'Not reported' : String(c.registered));
        const percentage = report.locator('.result-metrics > div').filter({ has: page.locator('dt', { hasText: /^Turnout / }) }).locator('dd');
        expect(await percentage.textContent()).toBe(c.percentage);
        if (c.registered === null) expect(await report.innerText()).toContain('Turnout percentage is unavailable because registered voters are not reported.');
        if (c.registered === 0) expect(await report.innerText()).toContain('Turnout percentage is unavailable because the reported registered-voter count is zero.');
        expect(await report.innerText()).toContain('Unofficial');
        await report.getByText('Source and report details', { exact: true }).click();
        expect(await report.innerText()).toContain('677 unmatched records excluded');
        expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
        if (c.unit === 'WA2') await page.screenshot({ path: `/tmp/issue-111-${width}.png`, fullPage: true });
      }
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  }, 60000);
}

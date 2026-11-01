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

for (const width of [1280, 390]) {
  test.skipIf(!base)(`independent photo/PDF and structured turnout availability at ${width}px`, async () => {
    const id = '295d864d-80c8-4a87-ab16-3f4f3fa5ddb7';
    for (const scenario of ['structured-only', 'photo-only', 'both', 'neither', 'photo-failed', 'structured-failed', 'no-county-rows']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const photo = scenario === 'photo-only' || scenario === 'both' || scenario === 'structured-failed';
      const structured = scenario === 'structured-only' || scenario === 'both' || scenario === 'photo-failed' || scenario === 'no-county-rows';
      let release!: () => void;
      const loading = new Promise<void>(resolve => { release = resolve; });
      let releasePhoto!: () => void;
      const photoLoading = new Promise<void>(resolve => { releasePhoto = resolve; });
      await page.route('**/rest/v1/rpc/**', async route => {
        const rpc = new URL(route.request().url()).pathname.split('/').pop();
        let data: unknown = false;
        if (rpc === 'search_elections') data = [{ id, name: 'Synthetic availability QA', election_date: '2026-11-03' }];
        if (rpc === 'get_election') data = { status: 'ok', election: { id, name: 'Synthetic availability QA' }, contests: [], ballot_questions: [] };
        if (rpc === 'get_election_results') {
          await photoLoading;
          data = scenario === 'photo-failed' ? { status: 'error' } : { status: 'ok', reports: photo ? [{
          id: 'photo-report', scope: { county: 'Bibb', unit_type: 'county', unit: 'all', counting_group: 'all', ballot_style: 'all' },
          observed_at: '2026-10-26T12:00:00Z', supersedes: null,
          snapshot: { status: 'unofficial', turnout: { ballots: 30 }, contests: [] },
        }] : [] };
        }
        if (rpc === 'get_structured_turnout') {
          await loading;
          const offset = route.request().postDataJSON().p_offset;
          data = scenario === 'structured-failed' ? null : !structured ? { status: 'empty' } : {
            status: 'ok', report: { id: 'structured-report', captured_at: '2026-10-26T12:00:00Z', source_url: 'https://example.org/synthetic-source', sha256: 'synthetic-checksum' },
            history: [], total: 101,
            rows: Array.from({ length: offset === 0 ? 100 : 1 }, (_, index) => ({
              county_fips: scenario === 'no-county-rows' ? '13153' : '13021', county_label: scenario === 'no-county-rows' ? 'Houston' : 'Bibb',
              ballot_style: 'all', table: 'early', source_title: 'Synthetic Georgia SOS source', counting_group: 'advance',
              as_of_label: 'Source as of October 26', measures: { accepted: { value: 10, display: '10' } },
              object_id: `row-${offset + index}`, locator: `Synthetic row ${offset + index}`,
            })),
          };
        }
        await route.fulfill({ json: data });
      });
      try {
        await page.goto(`${base}/elections/results/?id=${id}`);
        const availability = page.locator('#turnout-availability');
        await page.waitForFunction(() => document.querySelector('#result-status')?.textContent === 'Loading reports…');
        expect(await page.locator('#result-status').innerText()).not.toContain('No photo/PDF');
        releasePhoto();
        await page.waitForFunction(() => document.querySelector('#turnout-status')?.textContent === 'Loading structured turnout…');
        expect(await availability.textContent()).toContain('Checking');
        expect(await availability.textContent()).not.toContain('No structured');
        release();
        await page.waitForFunction(() => !document.querySelector('#turnout-availability')?.textContent?.includes('Checking'));
        const photoStatus = await page.locator('#result-status').innerText();
        const turnoutStatus = await availability.innerText();
        if (scenario === 'photo-failed') expect(photoStatus).toContain('Could not load election reports');
        else if (!photo) expect(photoStatus).toContain('No photo/PDF result reports');
        else expect(photoStatus).toContain('Showing one report');
        if (scenario === 'structured-failed') expect(turnoutStatus).toContain('Could not load structured turnout');
        else if (!structured) expect(turnoutStatus).toContain('No structured turnout reports yet');
        else if (scenario === 'no-county-rows') expect(turnoutStatus).toContain('no rows match the selected county');
        else {
          expect(turnoutStatus).toContain('Unofficial Georgia SOS turnout is available');
          expect(turnoutStatus).toContain('not candidate results');
          await availability.getByRole('link').click();
          expect(new URL(page.url()).hash).toBe('#structured-turnout');
          expect(await page.locator('#turnout-rows').innerText()).toContain('synthetic-checksum');
          expect(await page.locator('#turnout-rows').innerText()).toContain('Source as of October 26');
          await page.locator('#turnout-more').click();
          await page.waitForFunction(() => document.querySelector('#turnout-status')?.textContent?.startsWith('101 matching rows shown'));
          expect(await page.locator('#turnout-rows article').count()).toBe(101);
          expect(await page.locator('#turnout-more').isVisible()).toBe(false);
        }
        expect(await page.locator('body').innerText()).not.toContain('Results have not been reported');
        expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
        expect(errors).toEqual([]);
        if (scenario === 'structured-only') {
          await availability.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `/tmp/issue-106-${width}.png`, fullPage: false });
        }
      } finally { releasePhoto(); release(); await page.close(); }
    }
  }, 60000);
}

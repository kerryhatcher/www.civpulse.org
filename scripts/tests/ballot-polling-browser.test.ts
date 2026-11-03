import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chromium, type Browser } from 'playwright';
const base = process.env.SOS_RESULTS_TEST_URL;
let browser: Browser;
beforeAll(async () => { if (base) browser = await chromium.launch({ channel: 'chrome', headless: true }); });
afterAll(async () => { await browser?.close(); });

test.skipIf(!base)('ballot polling retains reports on failure and preserves precinct interaction', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  let revision = 1;
  let failure = false;
  let requests = 0;
  await page.route('**/rest/v1/rpc/**', async route => {
    const rpc = new URL(route.request().url()).pathname.split('/').pop();
    if (rpc !== 'get_election_results') return route.fulfill({ json: { status: 'empty' } });
    requests++;
    if (failure) return route.fulfill({ status: 503, json: { message: 'Synthetic outage' } });
    const scope = { county: 'Bibb', counting_group: 'all' };
    const reports = [
      { id: 'county', scope: { ...scope, unit_type: 'county', unit: 'all', ballot_style: 'all' }, observed_at: '2026-11-03T12:00:00Z', snapshot: { status: 'unofficial', turnout: {}, contests: [{ contest_id: '18700000-0000-4000-8000-000000000101', choices: [{ person_id: '18700000-0000-4000-8000-000000000111', label: 'Alex Example', votes: revision * 125 }] }] } },
      ...['all', 'Test style'].map(ballot_style => ({ id: ballot_style, scope: { ...scope, unit_type: 'precinct', unit: 'TEST', ballot_style }, observed_at: '2026-11-03T12:00:00Z', snapshot: { status: 'unofficial', turnout: { voters: revision * 25, registered: 100 }, contests: [] } })),
    ];
    return route.fulfill({ json: { status: 'ok', reports } });
  });
  await page.route('**/map-data/layers/*.json', route => route.fulfill({ json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { county: 'Bibb', precinctid: 'TEST', name: 'Synthetic precinct' }, geometry: { type: 'Polygon', coordinates: [[[-83.7,32.8],[-83.6,32.8],[-83.6,32.9],[-83.7,32.9],[-83.7,32.8]]] } }] } }));
  try {
    await page.addInitScript(() => sessionStorage.setItem('civicpulse.county', 'all'));
    await page.clock.install();
    await page.goto(`${base}/elections/issue187-synthetic-results/`);
    const results = page.locator('#contest-18700000-0000-4000-8000-000000000101 [data-inline-results]');
    await results.waitFor();
    const styles = page.locator('[data-precinct-style]');
    await styles.selectOption('Test style');
    await page.locator('[data-precinct-body] summary').click();
    await page.locator('[data-precinct-rows] button').click();
    const popup = page.locator('.leaflet-popup-content');
    await popup.waitFor();
    await popup.evaluate(element => element.setAttribute('data-unchanged', 'yes'));
    const initialRequests = requests;
    await page.clock.fastForward(30000);
    await page.waitForFunction(() => !document.querySelector('[data-ballot-results]')?.hasAttribute('aria-busy'));
    expect(requests).toBeGreaterThan(initialRequests);
    expect(await popup.getAttribute('data-unchanged')).toBe('yes');
    expect(await styles.inputValue()).toBe('Test style');
    failure = true;
    await page.clock.fastForward(30000);
    await page.waitForFunction(() => !document.querySelector('[data-ballot-results]')?.hasAttribute('aria-busy'));
    expect(await results.innerText()).toContain('125');
    expect(await page.locator('[data-ballot-results-error]').innerText()).toContain('Showing the last loaded reports');
    expect(await popup.getAttribute('data-unchanged')).toBe('yes');
    failure = false;
    await page.locator('.leaflet-control-zoom-in').click();
    const polygonBefore = await page.locator('[data-precinct-map] path.leaflet-interactive').boundingBox();
    revision = 2;
    await page.clock.fastForward(30000);
    await page.waitForFunction(() => document.querySelector('[data-inline-results]')?.textContent?.includes('250'));
    await page.waitForFunction(() => document.querySelector('.leaflet-popup-content')?.textContent?.includes('50.00%'));
    expect(await styles.inputValue()).toBe('Test style');
    // Let the new map's initial ResizeObserver callback run before comparing its viewport.
    await page.clock.runFor(100);
    const polygonAfter = await page.locator('[data-precinct-map] path.leaflet-interactive').boundingBox();
    expect(polygonAfter?.width).toBeCloseTo(polygonBefore!.width, 0);
    expect(polygonAfter?.height).toBeCloseTo(polygonBefore!.height, 0);
    expect(polygonAfter?.x).toBeCloseTo(polygonBefore!.x, 0);
    expect(polygonAfter?.y).toBeCloseTo(polygonBefore!.y, 0);
    expect(await page.locator('[data-ballot-results-error]').isVisible()).toBe(false);
    failure = true;
    await page.reload();
    await page.locator('[data-ballot-results-error]').waitFor();
    expect(await page.locator('[data-ballot-results-error]').innerText()).toContain('The ballot remains available');
  } finally { await page.close(); }
}, 60000);

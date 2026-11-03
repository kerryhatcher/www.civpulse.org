import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chromium, type Browser } from 'playwright';
const base = process.env.SOS_RESULTS_TEST_URL;
let browser: Browser;
beforeAll(async () => { if (base) browser = await chromium.launch({ channel: 'chrome', headless: true }); });
afterAll(async () => { await browser?.close(); });

test.skipIf(!base)('Bibb precinct map follows county scope and discards superseded loads', async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  let release: (() => void) | undefined;
  let entered: (() => void) | undefined;
  let delay = false;
  await page.route('**/rest/v1/rpc/**', route => route.fulfill({ json: route.request().url().endsWith('get_election_results') ? { status: 'ok', reports: [] } : { status: 'empty', rows: [], total: 0 } }));
  await page.route('**/map-data/layers/*.json', async route => {
    if (delay) { entered?.(); await new Promise<void>(resolve => { release = resolve; }); }
    await route.fulfill({ json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { county: 'Bibb', precinctid: 'TEST', name: 'Synthetic precinct' }, geometry: { type: 'Polygon', coordinates: [[[-83.7,32.8],[-83.6,32.8],[-83.6,32.9],[-83.7,32.9],[-83.7,32.8]]] } }] } });
  });
  const county = async (value: string) => page.evaluate(value => {
    sessionStorage.setItem('civicpulse.county', value);
    window.dispatchEvent(new Event('countychange'));
  }, value);
  const loaded = async () => {
    await page.waitForLoadState('networkidle');
    await page.locator('[data-precinct-body]').waitFor({state: 'visible'});
  };
  try {
    await page.addInitScript(() => sessionStorage.setItem('civicpulse.county', '13121'));
    await page.goto(`${base}/elections/issue187-synthetic-results/`);
    await page.waitForLoadState('networkidle');
    const section = page.locator('[data-precinct-turnout]');
    expect(await section.isVisible()).toBe(false);
    await county('13021');
    await loaded();
    await page.waitForLoadState('networkidle');
    expect(await section.innerText()).toContain('Bibb County precinct turnout');
    await county('13121');
    expect(await section.isVisible()).toBe(false);
    await county('all');
    await loaded();
    await page.waitForLoadState('networkidle');
    delay = true;
    const pending = new Promise<void>(resolve => { entered = resolve; });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('electionreportschange', { detail: { electionId: document.querySelector<HTMLElement>('[data-precinct-turnout]')!.dataset.electionId } })));
    await pending;
    await county('13121');
    release!();
    await page.waitForLoadState('networkidle');
    expect(await section.isVisible()).toBe(false);
    delay = false;
    await county('13021');
    await loaded();
    await page.waitForLoadState('networkidle');
    // Reinitialize during an old election's pending boundary request.
    delay = true;
    const oldPending = new Promise<void>(resolve => { entered = resolve; });
    await county('all');
    await oldPending;
    await county('13121');
    await page.evaluate(async () => {
      const source = await (await fetch('/src/scripts/elections.ts')).text();
      const moduleUrl = source.match(/from \"([^\"]*precinct-turnout[^\"]*)\"/)![1];
      const { initElectionPrecinctTurnout } = await import(moduleUrl);
      await initElectionPrecinctTurnout('another-election');
    });
    release!();
    await page.waitForLoadState('networkidle');
    expect(await section.isVisible()).toBe(false);
    delay = false;
    await county('all');
    await loaded();
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  } finally { release?.(); await page.close(); }
}, 60000);

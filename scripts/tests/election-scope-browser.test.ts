import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chromium, type Browser } from 'playwright';

const base = process.env.SOS_RESULTS_TEST_URL;
const electionId = '18700000-0000-4000-8000-000000000001';
const questionId = '18700000-0000-4000-8000-000000000101';
let browser: Browser;
beforeAll(async () => { if (base) browser = await chromium.launch({ channel: 'chrome', headless: true }); });
afterAll(async () => { await browser?.close(); });

for (const scenario of ['indexed', 'missing', 'failed'] as const) {
  test.skipIf(!base)(`ballot county scope ${scenario}`, async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => sessionStorage.setItem('civicpulse.county', '13121'));
    await page.route('**/county-data.json', route => scenario === 'failed'
      ? route.fulfill({ status: 503, body: 'unavailable' })
      : route.fulfill({ json: scenario === 'indexed' ? { [`ballot_question:${questionId}`]: ['13021'] } : {} }));
    await page.route('**/rest/v1/rpc/**', route => {
      const rpc = new URL(route.request().url()).pathname.split('/').pop();
      return route.fulfill({ json: rpc === 'get_election' ? {
        status: 'ok', election: { id: electionId, name: 'Scope test', election_date: '2026-11-03', kind: 'general', visibility: 'public' },
        contests: [], dates: [], ballot_questions: [{ id: questionId, title: 'Bibb question', question_text: 'Question', jurisdiction: 'Bibb County', choices: ['Yes', 'No'] }],
      } : rpc === 'get_election_results' ? { status: 'ok', reports: [] } : { status: 'empty' } });
    });
    try {
      await page.goto(`${base}/elections/view/?id=${electionId}#question-${questionId}`);
      const card = page.locator(`#question-${questionId}`);
      await card.waitFor({ state: 'attached' });
      await page.locator('[data-election-scope-empty]').waitFor({ state: 'visible' });
      expect(await card.isHidden()).toBe(true);
      expect(await page.locator('[data-election-scope-empty]').innerText()).toContain(scenario === 'failed' ? 'County filtering could not load' : 'No races or ballot questions');
    } finally { await page.close(); }
  }, 30000);
}

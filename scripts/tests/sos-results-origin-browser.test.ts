import { expect, test } from 'bun:test';
import { chromium } from 'playwright';

const base = process.env.SOS_RESULTS_ORIGIN_TEST_URL;
test.skipIf(!base)('configured test origin is used for both pointer and validated scope requests', async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined, headless: true });
  try {
    const page = await browser.newPage();
    const id = '11111111-1111-4111-8111-111111111111';
    const origin = 'https://files-test.civpulse.org';
    const path = `/elections/${id}/revisions/test-snapshot/counties/011.json`;
    const requests: string[] = [];
    await page.route('https://files*.civpulse.org/**', async route => {
      const url = route.request().url(); requests.push(url);
      if (!url.startsWith(origin + '/')) throw Error('Unexpected files origin');
      await route.fulfill({ json: url.endsWith('/latest.json') ? {
        schema_version: 1, election_id: id, snapshot_id: 'test-snapshot', revision: '1',
        source_url: 'https://results.sos.ga.gov/cdn/results/Georgia/export-Test.json',
        source_created_at: '2026-11-03T23:00:00Z', published_at: '2026-11-03T23:01:00Z',
        jurisdictions: [{ id: '011', name: 'Test county', item_count: 0, url: origin + path }],
      } : { schema_version: 1, election_id: id, snapshot_id: 'test-snapshot', jurisdiction: { id: '011', name: 'Test county' }, items: [] } });
    });
    await page.goto(base!);
    const result = await page.evaluate(async ({ id }) => {
      const module = await import('/src/lib/sos-results-reader.ts');
      const view = await module.createPublicSosReader()(id, '011');
      let crossOriginRejected = false;
      try { module.validatePointer({ ...view.pointer, jurisdictions: [{ ...view.pointer.jurisdictions[0], url: `https://files.civpulse.org/elections/${id}/revisions/test-snapshot/counties/011.json` }] }, id); }
      catch { crossOriginRejected = true; }
      return { scope: view.scope?.jurisdiction.id, crossOriginRejected };
    }, { id });
    expect(result).toEqual({ scope: '011', crossOriginRejected: true });
    expect(requests).toEqual([`${origin}/elections/${id}/latest.json`, origin + path]);
  } finally { await browser.close(); }
}, 30000);

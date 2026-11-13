import { expect, test } from 'bun:test';
import { electionPageTitle, personPageTitle, recordDescription } from '../../apps/web/src/lib/page-metadata';

test('person metadata preserves recorded role and does not infer a local or current office', () => {
  expect(personPageTitle('Example Person', 'Former county chair (2010–2014)', 'Elected official')).toBe('Example Person — Former county chair (2010–2014)');
  expect(personPageTitle('Example Person', '  ', 'Candidate')).toBe('Example Person — Candidate');
  expect(personPageTitle('Example Person', null, 'Other')).toBe('Example Person — Civic profile');
  expect(personPageTitle('Statewide Example', 'State representative', 'Elected official')).not.toContain('Macon');
});

test('reused source summaries become distinct and blank descriptions get useful named fallbacks', () => {
  const a = recordDescription('Example A', ' Credited article author. ', 'Civic profile.');
  const b = recordDescription('Example B', 'Credited article author.', 'Civic profile.');
  expect(a).toBe('Example A. Credited article author.');
  expect(a).not.toBe(b);
  for (const value of [null, '', '  \n']) expect(recordDescription('Example', value, 'Civic profile.')).toBe('Example. Civic profile.');
  expect(recordDescription('Example', 'Example is a recorded article author.', 'Civic profile.')).toBe('Example is a recorded article author.');
});

test('election titles add recorded date context when the name lacks a year', () => {
  expect(electionPageTitle('Special election', '2026-11-03', 'November 3, 2026')).toBe('Special election — November 3, 2026');
  expect(electionPageTitle('2026 General Election', '2026-11-03', 'November 3, 2026')).toBe('2026 General Election');
});

const dist = process.env.PAGE_METADATA_TEST_DIST;
test.skipIf(!dist)('built public metadata is populated and matches Open Graph/canonical metadata', async () => {
  const { shouldNoIndex } = await import('../../apps/web/src/lib/indexing-policy.mjs');
  const decode = (text: string) => text.replace(/&(?:amp|quot|lt|gt|#39|#x27);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'", '&#x27;': "'" })[entity]!);
  let pages = 0;
  for await (const file of new Bun.Glob('**/*.html').scan({ cwd: dist!, absolute: false })) {
    const route = '/' + file.replace(/index\.html$/, '');
    if (shouldNoIndex(route)) continue;
    const html = await Bun.file(`${dist}/${file}`).text();
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? '';
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? '';
    const ogDescription = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? '';
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    const ogUrl = html.match(/<meta property="og:url" content="([^"]*)"/)?.[1];
    expect(title.trim().length, route).toBeGreaterThan(0);
    expect(description.trim().length, route).toBeGreaterThan(0);
    expect(decode(ogTitle), route).toBe(decode(title));
    expect(decode(ogDescription), route).toBe(decode(description));
    expect(canonical, route).toBe(`https://www.civpulse.org${route}`);
    expect(ogUrl, route).toBe(canonical);
    if (/^\/(people|orgs|maps|elections)\/[^/]+\/$/.test(route) && !route.startsWith('/elections/results/')) {
      const subject = html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] ?? '';
      expect(decode(title), route).toContain(decode(subject));
      expect(decode(description), route).toContain(decode(subject));
    }
    pages++;
  }
  expect(pages).toBeGreaterThan(100);
});

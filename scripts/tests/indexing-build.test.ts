import { expect, test } from 'bun:test';
import { join, relative } from 'node:path';
import { shouldNoIndex } from '../../apps/web/src/lib/indexing-policy.mjs';

// Run after bun run build; paths and metadata are inspected in the actual output.
const dist = process.env.INDEXING_TEST_DIST;
test.skipIf(!dist)('built HTML, sitemap and robots obey the indexing matrix', async () => {
  const sitemap = await Bun.file(join(dist!, 'sitemap-0.xml')).text();
  let count = 0;
  for await (const file of new Bun.Glob('**/*.html').scan({ cwd: dist!, absolute: true })) {
    const route = '/' + relative(dist!, file).replace(/index\.html$/, '');
    const html = await Bun.file(file).text();
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
    const robots = [...head.matchAll(/<meta\b[^>]*name="robots"[^>]*>/gi)].map(match => match[0]);
    const excluded = shouldNoIndex(route);
    expect(robots.length, route).toBe(excluded ? 1 : 0);
    if (excluded) {
      expect(robots[0], route).toContain('content="noindex, follow"');
      expect(sitemap, route).not.toContain(`<loc>https://www.civpulse.org${route}</loc>`);
    } else {
      expect(sitemap, route).toContain(`<loc>https://www.civpulse.org${route}</loc>`);
    }
    count++;
  }
  expect(count).toBeGreaterThan(100);
  const robots = await Bun.file(join(dist!, 'robots.txt')).text();
  expect(robots).toContain('Allow: /');
  expect(robots).not.toMatch(/^\s*Disallow:\s*\S/m);
});

import { expect, test } from 'bun:test';
import { featureTitle, layerEvidence, layerPageHref, MAP_FEATURE_PAGE_SIZE } from '../../apps/web/src/lib/map-feature-text';
import type { LayerConfig } from '../../apps/web/src/lib/layers';
const layer: LayerConfig = { id: 'layer', name: 'Districts', description: 'Recorded coverage', visibility: 'public', source_type: 'postgis', source_url: null,
  presentation: { titleProperty: 'name', titleSuffix: 'number', attribution: 'Recorded publisher', sourceUrl: 'https://source.test/',
    popupFields: [{ property: 'member', label: 'Member in source' }, { property: 'link', label: 'District record', format: 'url' }] } };
const feature = (name = 'District'): GeoJSON.Feature => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [-83, 32] }, properties: {
  name, number: '1', member: 'Recorded member (2020)', link: 'https://record.test/', sourceChecked: '2026-10-15', internal: 'NEVER EXPORT',
} });

test('readable projection shares popup titles/text and only configured evidence, without guessing identities or update dates', () => {
  const source = feature('</script><script>bad</script>');
  const evidence = layerEvidence(layer, [source, { ...feature(), properties: { ...feature().properties, sourceChecked: '2026-99-99', link: 'javascript:alert(1)' } }]);
  expect(evidence.rows[0].title).toBe(featureTitle(source, layer));
  expect(evidence.rows[0].facts).toEqual([{ label: 'Member in source', text: 'Recorded member (2020)' }, { label: 'District record', text: 'https://record.test/', href: 'https://record.test/' }]);
  expect(evidence.rows[1].facts[1].href).toBeUndefined();
  expect(evidence.sourceChecks).toEqual(['2026-10-15']); expect(evidence.datedFeatures).toBe(1);
  expect(JSON.stringify(evidence.rows)).not.toMatch(/coordinates|NEVER EXPORT|\/people\//);
  expect(layerEvidence(layer, []).rows).toEqual([]);
  expect(layerEvidence(layer, [feature(), { ...feature(), properties: { sourceChecked: '2026-10-01' } }]).sourceChecks).toEqual(['2026-10-01', '2026-10-15']);
});

const dist = process.env.MAP_EVIDENCE_TEST_DIST;
const decode = (text: string) => text.replace(/&#(\d+);|&#x([\da-f]+);|&(amp|lt|gt|quot|apos);/gi, (_, decimal, hex, named) =>
  decimal || hex ? String.fromCodePoint(parseInt(decimal || hex, decimal ? 10 : 16)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase() as 'amp']));
const titles = (html: string) => [...html.matchAll(/<h3\b[^>]*data-feature-title[^>]*>(.*?)<\/h3>/gs)].map(match => decode(match[1]));
test.skipIf(!dist)('built HTML previews and every continuation equal the exact public geometry/presentation snapshot', async () => {
  let maps = 0, layers = 0, pages = 0;
  for await (const file of new Bun.Glob('maps/*/index.html').scan({ cwd: dist!, absolute: false })) {
    const html = await Bun.file(`${dist}/${file}`).text();
    const config = html.match(/<script\b[^>]*data-map-config[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (!config) continue; // Generic UUID shell contains no published evidence.
    const map = JSON.parse(config);
    expect(map.visibility).toBe('public');
    const manifest = await Bun.file(`${dist}${map.public_layers_url}`).json();
    const previews: string[] = [];
    for (const layer of manifest.layers) {
      expect(layer.visibility).toBe('public');
      const data = await Bun.file(`${dist}${layer.source_url}`).json();
      const evidence = layerEvidence(layer, data.features);
      previews.push(...evidence.rows.slice(0, 5).map(row => row.title));
      const found: string[] = [];
      if (evidence.rows.length > 5) {
        const count = Math.ceil(evidence.rows.length / MAP_FEATURE_PAGE_SIZE);
        for (let page = 1; page <= count; page++) {
          const href = layerPageHref(map.slug, layer.id, page);
          const body = await Bun.file(`${dist}${href}index.html`).text();
          const rows = titles(body); expect(rows.length).toBeLessThanOrEqual(MAP_FEATURE_PAGE_SIZE);
          expect(body).not.toContain('"coordinates"');
          if (page < count) expect(body).toContain(layerPageHref(map.slug, layer.id, page + 1));
          if (page > 1) expect(body).toContain(layerPageHref(map.slug, layer.id, page - 1));
          found.push(...rows); pages++;
        }
        expect(found).toEqual(evidence.rows.map(row => row.title));
      }
      layers++;
    }
    expect(titles(html)).toEqual(previews); expect(html).not.toContain('"coordinates"'); maps++;
  }
  expect(maps).toBeGreaterThan(0); expect(layers).toBeGreaterThan(0); expect(pages).toBeGreaterThan(0);
  console.log({ maps, layers, continuationPages: pages });
});

import { describe, expect, test } from 'bun:test';
import { buildCategoryColor, featureIcon, featureStyle, layerFeaturePathOptions, normalizeLayerStyle, normalizePresentation, safeMapUrl } from '../../apps/web/src/lib/layers';
import { normalizeMapViewOptions } from '../../apps/web/src/lib/maps';
const feature: GeoJSON.Feature = { type: 'Feature', properties: { district: '1', route_color: 'a1b2c3', county: 'Bibb' }, geometry: { type: 'Point', coordinates: [-83, 32] } };

describe('source map styling', () => {
  test('explicit category assignments preserve an independent outline', () => {
    const style = normalizeLayerStyle({ color: '#374151', categorizeBy: 'district', categoryTarget: 'fill', categoryStyles: { '1': { fillColor: '#2166ac' } } });
    const options = layerFeaturePathOptions(featureStyle(style, feature), feature);
    expect(options.color).toBe('#374151');
    expect(options.fillColor).toBe('#2166ac');
  });
  test('GTFS colors drive strokes and reject unsafe/invalid color values', () => {
    const style = normalizeLayerStyle({ color: '#26726b', fillColor: '#ffffff', colorProperty: 'route_color', categoryTarget: 'stroke' });
    expect(featureStyle(style, feature).color).toBe('#a1b2c3');
    expect(featureStyle(style, feature).fillColor).toBe('#ffffff');
    expect(featureStyle(style, { ...feature, properties: { route_color: 'url(javascript:alert(1))' } }).color).toBe('#26726b');
  });
  test('old sorted categorical palettes retain their behavior', () => {
    const other = { ...feature, properties: { district: '2' } };
    const color = buildCategoryColor({ type: 'FeatureCollection', features: [other, feature] }, 'district', ['#123456', '#abcdef']);
    expect(color(feature)).toBe('#123456'); expect(color(other)).toBe('#abcdef');
  });
  test('category icons keep their source sizes and reject executable URLs', () => {
    const style = normalizeLayerStyle({ iconBy: 'county', icons: { Bibb: { url: '/maps/icon.svg', size: [36, 44], anchor: [18, 42], popupAnchor: [0, -38] }, invalid: { url: 'javascript:alert(1)', size: [30, 38], anchor: [15, 36], popupAnchor: [0, -32] } } });
    expect(featureIcon(style, feature)?.size).toEqual([36, 44]);
    expect(style.icons.invalid).toBeUndefined();
    expect(safeMapUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeMapUrl('data:image/svg+xml,<svg onload="alert(1)"/>')).toBeUndefined();
  });
  test('malformed persisted presentation and view settings have safe defaults', () => {
    expect(normalizePresentation({ searchFields: ['name', 42], sourceUrl: 'javascript:alert(1)', popupFields: [null, {property:'name',label:'Name'}] }).searchFields).toEqual(['name']);
    expect(normalizePresentation({ sourceUrl: 'javascript:alert(1)' }).sourceUrl).toBeUndefined();
    expect(normalizeMapViewOptions({ center: [100, -83], downloads: 'invalid', zoom: 300 })).toEqual({ downloads: [], zoom: 19 });
  });
});

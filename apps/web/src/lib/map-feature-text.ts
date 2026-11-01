import { normalizePresentation, safeMapUrl, type LayerConfig } from './layers';

/** Shared with the interactive popup; do not infer a representative from a name. */
export function featureTitle(feature: GeoJSON.Feature, layer: LayerConfig): string {
  const p = feature.properties ?? {};
  const presentation = normalizePresentation(layer.presentation);
  const title = String(p[presentation.titleProperty || 'name'] ?? layer.name);
  const suffix = presentation.titleSuffix ? p[presentation.titleSuffix] : null;
  return suffix ? `${title} · ${String(suffix)}` : title;
}

export function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.map(valueText).join('\n');
  if (value && typeof value === 'object' && 'label' in value && 'lines' in value) return `${String(value.label)}\n${valueText(value.lines)}`;
  if (value && typeof value === 'object') return Object.entries(value).map(([key, v]) => `${key}: ${valueText(v)}`).join('\n');
  return value == null ? '' : String(value);
}

export interface FeatureEvidence {
  title: string;
  facts: { label: string; text: string; href?: string }[];
  sourceUrl?: string;
}
export interface LayerEvidence {
  layer: LayerConfig;
  rows: FeatureEvidence[];
  sourceChecks: string[];
  datedFeatures: number;
}
export const MAP_FEATURE_PAGE_SIZE = 25;
export const layerPageHref = (slug: string, layerId: string, page: number) => `/maps/${slug}/layers/${layerId}/page/${page}/`;

/** Only configured popup fields become HTML, never an arbitrary property dump. */
export function layerEvidence(layer: LayerConfig, features: GeoJSON.Feature[]): LayerEvidence {
  const display = normalizePresentation(layer.presentation);
  const rows = features.map(feature => {
    const p = feature.properties ?? {};
    return { title: featureTitle(feature, layer), facts: (display.popupFields ?? []).flatMap(field => {
      const value = p[field.property];
      return value == null || value === '' ? [] : [{ label: field.label, text: valueText(value),
        ...(field.format === 'url' ? { href: safeMapUrl(value) } : {}) }];
    }), sourceUrl: safeMapUrl(p.sourceUrl ?? p.detailsUrl ?? display.sourceUrl) };
  });
  const dates = features.flatMap(feature => {
    const value = feature.properties?.sourceChecked;
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? [value] : [];
  });
  return { layer, rows, sourceChecks: [...new Set(dates)].sort(), datedFeatures: dates.length };
}

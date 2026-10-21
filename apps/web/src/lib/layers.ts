import { getSupabase } from './supabase';

export type LayerVisibility = 'public' | 'unlisted' | 'private';

/** Leaflet-friendly styling shared by polygons, lines, and point markers. */
export interface LayerStyle {
  /** Line / border color. Used when a layer is not colored per record. */
  color: string;
  /** Line / border width in pixels. */
  weight: number;
  /** Line / border opacity (0–1). */
  opacity: number;
  /** Polygon / marker fill color. Used when a layer is not colored per record. */
  fillColor: string;
  /** Fill opacity (0–1). */
  fillOpacity: number;
  /** SVG dash pattern, e.g. `4 4`. Empty string means a solid line. */
  dashArray: string;
  /** Circle-marker radius in pixels. */
  radius: number;
  /**
   * Feature property to color each record by. When set, every distinct value
   * gets a color from `palette` instead of the single `color`/`fillColor`.
   * Empty string means a uniform style.
   */
  categorizeBy: string;
  /** Colors used for per-record coloring, cycled once values run out. */
  palette: string[];
}

export const DEFAULT_LAYER_STYLE: LayerStyle = {
  color: '#ae583b',
  weight: 2,
  opacity: 1,
  fillColor: '#c7d0b5',
  fillOpacity: 0.35,
  dashArray: '',
  radius: 6,
  categorizeBy: '',
  palette: ['#2166ac', '#e66101', '#1b9e77', '#c51b7d', '#6a51a3', '#e6ab02', '#5a5a5a', '#8c510a', '#00a6ca', '#287556'],
};

export interface LayerConfig {
  id: string;
  name: string;
  description: string | null;
  source_url: string | null;
  source_type: 'geojson' | 'postgis';
  visibility: LayerVisibility;
  /** Layer default style; may be partial or null when never customized. */
  style?: Partial<LayerStyle> | null;
}

export const LAYER_COLUMNS = 'id, name, description, source_url, visibility, style, source_type';

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_PALETTE = 24;

function hexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function clampedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Parse a palette from an array or a comma/whitespace separated string. */
export function normalizePalette(value: unknown): string[] {
  const candidates =
    typeof value === 'string'
      ? value.split(/[\s,]+/)
      : Array.isArray(value)
        ? value
        : [];
  const colors = candidates
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => HEX_COLOR.test(entry))
    .slice(0, MAX_PALETTE);
  return colors.length > 0 ? colors : [...DEFAULT_LAYER_STYLE.palette];
}

/** Coerce an arbitrary persisted style into a complete, valid LayerStyle. */
export function normalizeLayerStyle(value?: Partial<LayerStyle> | null): LayerStyle {
  const merged = { ...DEFAULT_LAYER_STYLE, ...(value ?? {}) };
  return {
    color: hexColor(merged.color, DEFAULT_LAYER_STYLE.color),
    weight: clampedNumber(merged.weight, DEFAULT_LAYER_STYLE.weight, 0, 12),
    opacity: clampedNumber(merged.opacity, DEFAULT_LAYER_STYLE.opacity, 0, 1),
    fillColor: hexColor(merged.fillColor, DEFAULT_LAYER_STYLE.fillColor),
    fillOpacity: clampedNumber(merged.fillOpacity, DEFAULT_LAYER_STYLE.fillOpacity, 0, 1),
    dashArray:
      typeof merged.dashArray === 'string' ? merged.dashArray.trim().slice(0, 40) : '',
    radius: clampedNumber(merged.radius, DEFAULT_LAYER_STYLE.radius, 1, 30),
    categorizeBy:
      typeof merged.categorizeBy === 'string' ? merged.categorizeBy.trim().slice(0, 80) : '',
    palette: normalizePalette(merged.palette),
  };
}

/**
 * Resolve the style to render for a layer on a map. The layer default and an
 * optional per-map override are merged over the app default, so a null override
 * inherits the layer, and gaps in either fall back to the app default.
 */
export function resolveLayerStyle(
  layerStyle?: Partial<LayerStyle> | null,
  override?: Partial<LayerStyle> | null,
): LayerStyle {
  return normalizeLayerStyle({ ...(layerStyle ?? {}), ...(override ?? {}) });
}

/** Leaflet path options for polygons and lines (uniform styling). */
export function layerPathOptions(style: LayerStyle): Record<string, unknown> {
  return {
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    ...(style.dashArray ? { dashArray: style.dashArray } : {}),
  };
}

/** Leaflet circle-marker options for point features (uniform styling). */
export function layerMarkerOptions(style: LayerStyle): Record<string, unknown> {
  return {
    radius: style.radius,
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    ...(style.dashArray ? { dashArray: style.dashArray } : {}),
  };
}

type ColorFor = (feature: GeoJSON.Feature | undefined) => string;

/** Path options for one feature, applying per-record color when configured. */
export function layerFeaturePathOptions(
  style: LayerStyle,
  feature: GeoJSON.Feature | undefined,
  colorFor?: ColorFor,
): Record<string, unknown> {
  const options = layerPathOptions(style);
  if (colorFor) {
    const color = colorFor(feature);
    options.color = color;
    options.fillColor = color;
  }
  return options;
}

/** Marker options for one feature, applying per-record color when configured. */
export function layerFeatureMarkerOptions(
  style: LayerStyle,
  feature: GeoJSON.Feature | undefined,
  colorFor?: ColorFor,
): Record<string, unknown> {
  const options = layerMarkerOptions(style);
  if (colorFor) {
    const color = colorFor(feature);
    options.color = color;
    options.fillColor = color;
  }
  return options;
}

function featuresOf(geojson: GeoJSON.GeoJsonObject | null | undefined): GeoJSON.Feature[] {
  if (!geojson || typeof geojson !== 'object') return [];
  if ('features' in geojson && Array.isArray((geojson as GeoJSON.FeatureCollection).features)) {
    return (geojson as GeoJSON.FeatureCollection).features;
  }
  if ((geojson as GeoJSON.Feature).type === 'Feature') {
    return [geojson as GeoJSON.Feature];
  }
  return [];
}

function propertyValue(feature: GeoJSON.Feature | undefined, property: string): string {
  const properties = (feature?.properties ?? {}) as Record<string, unknown>;
  const value = properties[property];
  return value == null ? '' : String(value);
}

/**
 * Build a stable value → color mapping for a GeoJSON document. Distinct values
 * are sorted so the same dataset always gets the same colors, and the palette
 * cycles when there are more values than colors.
 */
export function buildCategoryColor(
  geojson: GeoJSON.GeoJsonObject,
  property: string,
  palette: string[],
): ColorFor {
  const colors = palette.length > 0 ? palette : DEFAULT_LAYER_STYLE.palette;
  const values = new Set<string>();
  for (const feature of featuresOf(geojson)) values.add(propertyValue(feature, property));

  const sorted = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const assignments = new Map<string, string>();
  sorted.forEach((value, index) => assignments.set(value, colors[index % colors.length]));

  return (feature) => assignments.get(propertyValue(feature, property)) ?? colors[0];
}

/** Distinct property keys found in a GeoJSON document, for the admin picker. */
export function geojsonPropertyKeys(geojson: GeoJSON.GeoJsonObject): string[] {
  const keys = new Set<string>();
  for (const feature of featuresOf(geojson)) {
    for (const key of Object.keys((feature.properties ?? {}) as Record<string, unknown>)) {
      keys.add(key);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

/** Fetch a GeoJSON URL and return its feature property keys. */
export async function fetchPropertyKeys(url: string): Promise<string[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const geojson = (await response.json()) as GeoJSON.GeoJsonObject;
  return geojsonPropertyKeys(geojson);
}

/** Load stored geometry through the same access gate as the containing map. */
export async function fetchLayerGeoJSON(layer: LayerConfig, mapId?: string): Promise<GeoJSON.GeoJsonObject> {
  if (layer.source_type === 'postgis') {
    const { data, error } = await getSupabase().rpc('get_layer_geojson', {
      p_layer_id: layer.id, p_map_id: mapId ?? null,
    });
    if (error) throw new Error(error.message);
    return data as GeoJSON.GeoJsonObject;
  }
  if (!layer.source_url) throw new Error('Layer has no GeoJSON URL');
  const response = await fetch(layer.source_url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Bound downloads too, including chunked responses without Content-Length. */
export async function readGeoJSONImport(file: File | null, url: string): Promise<GeoJSON.GeoJsonObject> {
  let text: string;
  if (file) {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Import limit: 10 MB');
    text = await file.text();
  } else {
    const source = new URL(url);
    if (!['http:', 'https:'].includes(source.protocol)) throw new Error('Use an HTTP or HTTPS URL');
    const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Could not import URL: HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The URL returned no data');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMPORT_BYTES) {
        await reader.cancel();
        throw new Error('Import limit: 10 MB');
      }
      chunks.push(value);
    }
    text = await new Blob(chunks as BlobPart[]).text();
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || !data.type) throw new Error();
    return data;
  } catch {
    throw new Error('Choose a valid GeoJSON file or URL');
  }
}

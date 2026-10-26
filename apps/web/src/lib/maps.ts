
export type MapVisibility = 'public' | 'unlisted' | 'private';

export interface OrganizationRef {
  id: string;
  name: string;
  slug: string;
}

export interface MapViewOptions {
  center?: [number, number];
  zoom?: number;
  basemapVisible?: boolean;
  fitBounds?: boolean;
  note?: string;
  downloads?: { label: string; url: string; detail?: string }[];
}

export interface MapConfig {
  id: string;
  /** Build-generated public layer manifest; absent on live UUID viewers. */
  public_layers_url?: string;
  view_options?: MapViewOptions;
  slug: string;
  name: string;
  description: string | null;
  base_map: string;
  visibility: MapVisibility;
  organization_id: string | null;
  organizations?: OrganizationRef | null;
}

export const MAP_COLUMNS =
  'id, slug, name, description, base_map, visibility, organization_id, view_options, organizations(id, name, slug)';

/** Public maps and their shared geometry are one fail-closed build snapshot. */
export async function fetchPublicMaps(): Promise<MapConfig[]> {
  const { getMapBuildData } = await import("./map-build-data");
  return (await getMapBuildData()).maps;
}

/** Bound view settings before handing persisted JSON to the browser renderer. */
export function normalizeMapViewOptions(value: unknown): MapViewOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as MapViewOptions;
  const result: MapViewOptions = {};
  if (Array.isArray(raw.center) && raw.center.length === 2 && raw.center.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.abs(raw.center[0]) <= 90 && Math.abs(raw.center[1]) <= 180) result.center = [raw.center[0], raw.center[1]];
  if (typeof raw.zoom === 'number' && Number.isFinite(raw.zoom)) result.zoom = Math.min(19, Math.max(0, raw.zoom));
  if (typeof raw.basemapVisible === 'boolean') result.basemapVisible = raw.basemapVisible;
  if (typeof raw.fitBounds === 'boolean') result.fitBounds = raw.fitBounds;
  if (typeof raw.note === 'string') result.note = raw.note.slice(0, 4000);
  result.downloads = Array.isArray(raw.downloads) ? raw.downloads.filter(v => v && typeof v.label === 'string' && typeof v.url === 'string').slice(0, 20).map(v => ({ label: v.label.slice(0, 200), url: v.url, detail: typeof v.detail === 'string' ? v.detail.slice(0, 500) : undefined })) : [];
  return result;
}

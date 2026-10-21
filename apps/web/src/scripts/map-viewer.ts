import L from 'leaflet';
import { BASE_MAPS, isBaseMapKey } from '../lib/basemaps';
import {
  buildCategoryColor,
  layerFeatureMarkerOptions,
  layerFeaturePathOptions,
  resolveLayerStyle,
  type LayerConfig,
} from '../lib/layers';
import type { MapConfig } from '../lib/maps';
import { getSupabase } from '../lib/supabase';
import { isCurrentUserAdmin } from './auth';

export function renderMap(
  container: HTMLElement,
  config: MapConfig,
  layers: LayerConfig[] = [],
): L.Map {
  const key = isBaseMapKey(config.base_map) ? config.base_map : 'osm';
  const base = BASE_MAPS[key];

  const map = L.map(container, { center: [32.8407, -83.6324], zoom: 8 });
  L.tileLayer(base.url, { attribution: base.attribution, maxZoom: base.maxZoom }).addTo(map);

  const group = L.layerGroup().addTo(map);
  const bounds = L.latLngBounds([]);

  setTimeout(() => map.invalidateSize(), 0);

  for (const layer of layers) {
    void fetch(layer.source_url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson: GeoJSON.GeoJsonObject) => {
        const style = resolveLayerStyle(layer.style);
        const colorFor = style.categorizeBy
          ? buildCategoryColor(geojson, style.categorizeBy, style.palette)
          : undefined;
        const rendered = L.geoJSON(geojson, {
          style: (feature) => layerFeaturePathOptions(style, feature, colorFor),
          pointToLayer: (feature, latlng) =>
            L.circleMarker(latlng, layerFeatureMarkerOptions(style, feature, colorFor)),
        });
        rendered.addTo(group);
        const layerBounds = rendered.getBounds();
        if (layerBounds.isValid()) {
          bounds.extend(layerBounds);
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
        }
      })
      .catch((error: unknown) => {
        console.warn('[layers] Could not load %s (%s):', layer.name, layer.source_url, error);
      });
  }

  return map;
}

async function fetchLayers(mapId: string): Promise<LayerConfig[]> {
  const { data, error } = await getSupabase().rpc('get_map_layers', { p_map_id: mapId });
  if (error) {
    console.warn('[layers] Could not load layers:', error.message);
    return [];
  }
  return (data ?? []) as unknown as LayerConfig[];
}

async function revealEditLink(mapId: string): Promise<void> {
  const link = document.querySelector<HTMLAnchorElement>('[data-map-edit-link]');
  if (!link) return;

  if (await isCurrentUserAdmin()) {
    link.href = `/admin/maps/?edit=${mapId}`;
    link.hidden = false;
  }
}

/** Reads an inline JSON config and renders it (public prerendered map pages). */
export function initMapViewFromPage(): void {
  const container = document.querySelector<HTMLElement>('[data-map-viewer]');
  const script = document.querySelector<HTMLScriptElement>('[data-map-config]');
  if (!container || !script) return;

  void (async () => {
    try {
      const config = JSON.parse(script.textContent ?? '') as MapConfig;
      const layers = await fetchLayers(config.id);
      container.hidden = false;
      renderMap(container, config, layers);
      updateLayerNote(layers.length);
      void revealEditLink(config.id);
    } catch (error) {
      console.warn('[maps] Invalid map config:', error);
    }
  })();
}

function updateLayerNote(count: number): void {
  const note = document.querySelector<HTMLElement>('[data-map-layer-note]');
  if (note) {
    note.textContent = `${count} layer${count === 1 ? '' : 's'}`;
  }
}

function mapIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/maps\/[up]\/([0-9a-f-]{36})\/?$/i);
  return match ? match[1] : null;
}

function showStatus(root: HTMLElement, text: string, signIn = false): void {
  root.replaceChildren();

  const message = document.createElement('p');
  message.textContent = text;
  root.append(message);

  if (signIn) {
    const link = document.createElement('a');
    link.className = 'button-link';
    link.href = `/signin/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    link.textContent = 'Sign in';
    root.append(link);
  }

  root.hidden = false;
}

/**
 * Viewer for unlisted/private maps. The URL carries the uuid
 * (`/maps/u/<uuid>/` or `/maps/p/<uuid>/`); the `get_map` RPC decides access.
 */
export async function initMapViewFromUrl(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-map-viewer]');
  const status = document.querySelector<HTMLElement>('[data-map-viewer-status]');
  if (!container) return;

  const id =
    mapIdFromPath(window.location.pathname) ?? new URLSearchParams(window.location.search).get('id');

  if (!id) {
    if (status) showStatus(status, 'Map not found.');
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_map', { p_id: id });
  const result = data as { status?: string; map?: MapConfig } | null;

  if (error || !result || result.status === 'missing') {
    if (status) showStatus(status, 'Map not found.');
    return;
  }

  if (result.status === 'private') {
    if (status) showStatus(status, 'This map is private. Sign in to view it.', true);
    return;
  }

  if (!result.map) {
    if (status) showStatus(status, 'Map not found.');
    return;
  }

  const layers = await fetchLayers(result.map.id);
  if (status) status.hidden = true;
  container.hidden = false;
  renderMap(container, result.map, layers);
  void revealEditLink(result.map.id);
}

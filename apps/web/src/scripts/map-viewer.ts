import L from 'leaflet';
import { BASE_MAPS, isBaseMapKey } from '../lib/basemaps';
import { fetchLayerGeoJSON, normalizePresentation, resolveLayerStyle, safeMapUrl, type LayerConfig } from '../lib/layers';
import { createGeoJSONLayer, featureTitle } from '../lib/map-rendering';
import { normalizeMapViewOptions, type MapConfig } from '../lib/maps';
import { getSupabase } from '../lib/supabase';
import { isCurrentUserAdmin } from './auth';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

export function renderMap(container: HTMLElement, config: MapConfig, layers: LayerConfig[] = []): L.Map {
  config = { ...config, view_options: normalizeMapViewOptions(config.view_options) };
  const base = BASE_MAPS[isBaseMapKey(config.base_map) ? config.base_map : 'osm'];
  container.className = 'map-explorer';
  container.replaceChildren();
  const workspace = element('div', '', 'map-workspace');
  const settings = element('details', '', 'map-settings');
  settings.open = matchMedia('(min-width: 760px)').matches;
  settings.append(element('summary', 'Map settings'));
  const controls = element('div', '', 'map-controls');
  const main = element('div', '', 'map-main');
  const canvas = element('div', '', 'map-canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `Interactive map: ${config.name}. Use the places directory below for keyboard access.`);
  const status = element('p', 'Loading selected layers…', 'status map-load-status');
  status.setAttribute('role', 'status');
  const errors = element('div', '', 'map-load-errors'); errors.setAttribute('role', 'status');
  const retry = element('button', 'Retry failed layers'); retry.type = 'button'; retry.hidden = true;
  const directory = element('section', '', 'map-directory');
  directory.setAttribute('aria-label', 'Places on your map');
  const directoryHeading = element('div', '', 'map-directory-heading');
  const searchLabel = element('label', '', 'field');
  searchLabel.append(element('span', 'Search places, precincts or addresses'));
  const search = element('input'); search.type = 'search'; search.placeholder = 'Name, address, district or bus route';
  searchLabel.append(search);
  directoryHeading.append(element('h2', 'Places on your map'), searchLabel);
  const resultStatus = element('p', '', 'status'); resultStatus.setAttribute('role', 'status');
  const list = element('div', '', 'map-place-list');
  const more = element('button', 'Show more places'); more.type = 'button'; more.hidden = true;
  directory.append(directoryHeading, resultStatus, list, more);
  main.append(canvas, status, errors, retry);
  settings.append(controls); workspace.append(settings, main); container.append(workspace, directory);

  const center = config.view_options?.center;
  const validCenter = Array.isArray(center) && center.length === 2 && center.every(Number.isFinite) && Math.abs(center[0]) <= 90 && Math.abs(center[1]) <= 180;
  const map = L.map(canvas, {
    center: validCenter ? center : [32.844, -83.649],
    zoom: config.view_options?.zoom ?? 12,
    scrollWheelZoom: false,
    zoomAnimation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  let alive = true;
  map.on('unload', () => { alive = false; });
  const tiles = L.tileLayer(base.url, { attribution: base.attribution, maxZoom: base.maxZoom });
  const tileWarning = element('p', 'The street basemap is unavailable. Geographic layers still work; turn off the basemap for a plain view.', 'status');
  tileWarning.hidden = true;
  main.append(tileWarning);
  tiles.on('tileerror', () => { tileWarning.hidden = false; });
  const basemapLabel = element('label', '', 'map-basemap-toggle');
  const basemap = element('input'); basemap.type = 'checkbox'; basemap.checked = config.view_options?.basemapVisible !== false;
  if (basemap.checked) tiles.addTo(map);
  basemap.addEventListener('change', () => { basemap.checked ? tiles.addTo(map) : tiles.remove(); tileWarning.hidden = true; writeUrl(); });
  basemapLabel.append(basemap, document.createTextNode('Show street basemap'));
  const fit = element('button', 'Fit map to visible layers'); fit.type = 'button';
  const share = element('button', 'Copy map link'); share.type = 'button';
  share.addEventListener('click', () => {
    void navigator.clipboard.writeText(location.href).then(() => { status.textContent = 'Map link copied.'; }).catch(() => { status.textContent = 'Copy the address from your browser to share this view.'; });
  });
  const params = new URLSearchParams(location.search);
  const keyOf = (layer: LayerConfig) => normalizePresentation(layer.presentation).key || layer.id;
  const allowedKeys = new Map(layers.map(layer => [keyOf(layer), layer.id]));
  const selected = new Set(params.has('layers')
    ? (params.get('layers') ?? '').split(',').flatMap(key => allowedKeys.has(key) ? [allowedKeys.get(key)!] : [])
    : layers.filter(layer => layer.visible_by_default !== false).map(layer => layer.id));
  if (params.get('basemap') === '0') { basemap.checked = false; tiles.remove(); }
  const rendered = new Map<string, L.GeoJSON>();
  const loading = new Map<string, Promise<void>>();
  const failures = new Map<string, string>();
  const checkboxes = new Map<string, HTMLInputElement>();
  const records: { feature: GeoJSON.Feature; layer: LayerConfig; rendered: L.Layer; title: string; search: string }[] = [];
  let limit = 60;
  const groups = new Map<string, HTMLElement>();
  for (const [index, layer] of layers.entries()) {
    const pane = map.createPane(`layer-${index}`); pane.style.zIndex = String(400 + index * 2);
    const display = normalizePresentation(layer.presentation);
    const groupName = display.group || 'Map layers';
    let group = groups.get(groupName);
    if (!group) {
      const details = element('details', '', 'map-layer-group');
      details.open = layers.some(l => selected.has(l.id) && (normalizePresentation(l.presentation).group || 'Map layers') === groupName);
      details.append(element('summary', groupName)); group = element('div'); details.append(group); groups.set(groupName, group); controls.append(details);
    }
    const label = element('label', '', 'map-layer-control');
    const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(layer.id);
    checkboxes.set(layer.id, checkbox);
    const text = element('span'); text.append(element('strong', layer.name));
    if (layer.description) text.append(element('small', layer.description));
    const swatch = element('span', '', 'map-legend-swatch');
    swatch.setAttribute('aria-hidden', 'true');
    const style = resolveLayerStyle(layer.style);
    const icon = style.icon ?? Object.values(style.icons)[0];
    if (icon) { const image = element('img'); image.src = icon.url; image.alt = ''; image.width = 22; image.height = 28; swatch.append(image); }
    else {
      const colors = [...new Set(Object.values(style.categoryStyles).map(s => s.fillColor ?? s.color).filter((v): v is string => typeof v === 'string' && /^#[a-f\d]{3,6}$/i.test(v)))];
      for (const color of colors.length ? colors.slice(0, 9) : [style.fillColor]) { const chip = element('i'); chip.style.backgroundColor = color; swatch.append(chip); }
    }
    label.append(checkbox, swatch, text); group.append(label);
    const legendEntries = display.renderer === 'events' ? [] : Object.keys(style.icons).length ? Object.entries(style.icons).map(([name, icon]) => ({ name, icon, color: undefined as string | undefined })) : Object.entries(style.categoryStyles).map(([name, entry]) => ({ name: /^\d+$/.test(name) ? 'District ' + name : name, icon: undefined, color: entry.fillColor ?? entry.color }));
    if (legendEntries.length > 1) {
      const legend = element('details', '', 'map-category-legend');
      legend.append(element('summary', layer.name + ' legend'));
      for (const entry of legendEntries) {
        const row = element('p');
        if (entry.icon) { const image = element('img'); image.src = entry.icon.url; image.alt = ''; image.width = 18; image.height = 23; row.append(image); }
        else if (entry.color && /^#[a-f\d]{3,6}$/i.test(entry.color)) { const chip = element('i'); chip.style.backgroundColor = entry.color; row.append(chip); }
        row.append(document.createTextNode(entry.name)); legend.append(row);
      }
      group.append(legend);
    }
    checkbox.addEventListener('change', () => {
      checkbox.checked ? selected.add(layer.id) : selected.delete(layer.id);
      limit = 60; writeUrl(); const pending = load(layer); refresh(); void pending.then(refresh);
    });
  }
  for (const name of ['Community & elections', 'State & federal election districts', 'School locations by type', 'Attendance & school-board districts', 'Transit routes & stops']) {
    const group = groups.get(name); if (group?.parentElement) controls.append(group.parentElement);
  }
  if (!layers.length) controls.append(element('p', 'No layers are available on this map.', 'status'));
  controls.append(basemapLabel, fit, share, element('p', 'Select a place on the map or in the directory to see its details.', 'map-help'));
  if (config.view_options?.note) controls.append(element('p', config.view_options.note, 'map-help'));
  for (const download of config.view_options?.downloads ?? []) {
    const url = safeMapUrl(download.url); if (!url) continue;
    const link = element('a', download.label, 'text-link'); link.href = url; controls.append(link);
    if (download.detail) controls.append(element('small', download.detail, 'map-help'));
  }
  const sources = element('details', '', 'map-source-notes'); sources.append(element('summary', 'Sources & data notes')); controls.append(sources);
  for (const layer of layers.filter(l => l.visible_by_default !== false)) {
    const p = normalizePresentation(layer.presentation);
    if (!p.note && !p.sourceUrl) continue;
    const note = element('p'); note.append(element('strong', layer.name));
    if (p.note) note.append(document.createTextNode(` — ${p.note}`));
    if (p.sourceUrl) { const a = element('a', ' Download source GeoJSON'); a.href = p.sourceUrl; note.append(a); }
    sources.append(note);
  }

  function writeUrl(): void {
    if (!alive) return;
    const url = new URL(location.href);
    url.searchParams.set('map', config.slug);
    url.searchParams.set('layers', layers.filter(l => selected.has(l.id)).map(keyOf).join(','));
    basemap.checked ? url.searchParams.delete('basemap') : url.searchParams.set('basemap', '0');
    history.replaceState(null, '', url);
  }
  function fitVisible(): void {
    const bounds = L.latLngBounds([]);
    for (const [id, layer] of rendered) if (selected.has(id) && layer.getBounds().isValid()) bounds.extend(layer.getBounds());
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15, animate: false });
  }
  function focus(record: typeof records[number]): void {
    if ('getLatLng' in record.rendered) map.setView((record.rendered as L.Marker).getLatLng(), 15, { animate: false });
    else if ('getBounds' in record.rendered) map.fitBounds((record.rendered as L.Polygon).getBounds(), { padding: [32, 32], maxZoom: 15, animate: false });
    record.rendered.openPopup();
    canvas.scrollIntoView({ block: 'center', behavior: 'instant' });
    status.textContent = `Showing ${record.title}.`;
  }
  async function related(key: string, property: string, value: string): Promise<void> {
    const layer = layers.find(l => keyOf(l) === key);
    if (!layer) { status.textContent = 'The related layer is not available on this map.'; return; }
    selected.add(layer.id); const checkbox = checkboxes.get(layer.id); if (checkbox) checkbox.checked = true;
    await load(layer); refresh(); writeUrl();
    const matches = records.filter(r => r.layer.id === layer.id && String(r.feature.properties?.[property]) === value);
    if (matches[0]) { focus(matches[0]); if (matches.length > 1) { search.value = value; renderDirectory(); status.textContent = `${matches.length} matching polling places. See the directory for all records.`; } }
    else status.textContent = 'No matching feature in the saved data.';
  }
  async function load(layer: LayerConfig): Promise<void> {
    if (!selected.has(layer.id) || rendered.has(layer.id)) return;
    if (loading.has(layer.id)) return loading.get(layer.id);
    const promise = (async () => {
      try {
        const data = await fetchLayerGeoJSON(layer, config.id);
        if (!alive) return;
        const index = layers.findIndex(l => l.id === layer.id);
        const geo = createGeoJSONLayer(layer, data, { pane: `layer-${index}`, related });
        geo.eachLayer(child => {
          const feature = (child as L.Layer & { feature?: GeoJSON.Feature }).feature;
          if (!feature) return;
          const title = featureTitle(feature, layer);
          const p = feature.properties ?? {};
          const fields = normalizePresentation(layer.presentation).searchFields ?? [];
          records.push({ feature, rendered: child, layer, title, search: `${title} ${fields.map(k => JSON.stringify(p[k] ?? '')).join(' ')}`.toLocaleLowerCase() });
        });
        rendered.set(layer.id, geo); failures.delete(layer.id);
      } catch (error) { if (alive) failures.set(layer.id, error instanceof Error ? error.message : String(error)); }
      finally { loading.delete(layer.id); }
    })();
    loading.set(layer.id, promise);
    return promise;
  }
  function renderDirectory(): void {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = records.filter(r => selected.has(r.layer.id) && (!query || r.search.includes(query)));
    list.replaceChildren();
    for (const record of visible.slice(0, limit)) {
      const row = element('article', '', 'map-place-row');
      const info = element('div'); info.append(element('strong', record.title), element('small', record.layer.name));
      const show = element('button', 'Show on map'); show.type = 'button'; show.setAttribute('aria-label', `Show ${record.title} on map`);
      show.addEventListener('click', () => focus(record)); row.append(info, show); list.append(row);
    }
    more.hidden = visible.length <= limit;
    resultStatus.textContent = !selected.size ? 'Choose a layer to explore places.' : !visible.length ? (query ? 'No places match your search in the selected layers.' : 'No places to show in the selected layers.') : `${visible.length} feature${visible.length === 1 ? '' : 's'}${query ? ' matching your search' : ' in selected layers'}${visible.length > limit ? ` · showing ${limit}` : ''}`;
  }
  function refresh(): void {
    if (!alive) return;
    for (const [id, geo] of rendered) selected.has(id) ? (map.hasLayer(geo) || geo.addTo(map)) : geo.remove();
    const activeFailures = layers.filter(l => selected.has(l.id) && failures.has(l.id));
    errors.textContent = activeFailures.length ? `Could not load: ${activeFailures.map(l => l.name).join(', ')}. Other layers remain available.` : '';
    retry.hidden = !activeFailures.length;
    status.textContent = `${layers.filter(l => selected.has(l.id) && rendered.has(l.id)).length} layers visible${loading.size ? ' · loading…' : ''}`;
    const note = document.querySelector('[data-map-layer-note]'); if (note) note.textContent = status.textContent;
    renderDirectory();
  }
  fit.addEventListener('click', fitVisible);
  more.addEventListener('click', () => { limit += 60; renderDirectory(); });
  search.addEventListener('input', () => { limit = 60; renderDirectory(); });
  retry.addEventListener('click', () => { status.textContent = 'Retrying layers…'; void Promise.all(layers.filter(l => selected.has(l.id) && failures.has(l.id)).map(load)).then(refresh); });
  void Promise.all(layers.filter(l => selected.has(l.id)).map(load)).then(() => {
    if (!alive) return;
    refresh(); map.invalidateSize();
    if (config.view_options?.fitBounds === true || (!validCenter && config.view_options?.zoom === undefined)) fitVisible();
    container.dataset.mapReady = 'true'; writeUrl();
    const event = params.get('event');
    const venue = event ? records.find(r => Array.isArray(r.feature.properties?.events) && r.feature.properties.events.some((e: { id?: string }) => e.id === event)) : undefined;
    if (venue) focus(venue);
  });
  return map;
}

async function fetchLayers(mapId: string): Promise<LayerConfig[]> {
  const { data, error } = await getSupabase().rpc('get_map_layers', { p_map_id: mapId });
  if (error) throw new Error(error.message);
  return (data ?? []) as LayerConfig[];
}

async function revealEditLink(mapId: string): Promise<void> {
  const link = document.querySelector<HTMLAnchorElement>('[data-map-edit-link]');
  if (link && await isCurrentUserAdmin()) { link.href = `/admin/maps/?edit=${mapId}`; link.hidden = false; }
}

function showStatus(root: HTMLElement, text: string, signIn = false): void {
  root.replaceChildren(element('p', text));
  if (signIn) { const link = element('a', 'Sign in', 'button-link'); link.href = `/signin/?next=${encodeURIComponent(location.pathname + location.search)}`; root.append(link); }
  root.hidden = false;
}

export function initMapViewFromPage(): void {
  const container = document.querySelector<HTMLElement>('[data-map-viewer]');
  const script = document.querySelector<HTMLScriptElement>('[data-map-config]');
  if (!container || !script) return;
  void (async () => {
    try { const config = JSON.parse(script.textContent ?? '') as MapConfig; const layers = await fetchLayers(config.id); container.hidden = false; renderMap(container, config, layers); void revealEditLink(config.id); }
    catch { showStatus(container, 'Could not load this map. Reload the page to try again.'); }
  })();
}

export async function initMapViewFromUrl(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-map-viewer]');
  const status = document.querySelector<HTMLElement>('[data-map-viewer-status]');
  if (!container || !status) return;
  const id = location.pathname.match(/^\/maps\/[up]\/([0-9a-f-]{36})\/?$/i)?.[1] ?? new URLSearchParams(location.search).get('id');
  if (!id) { showStatus(status, 'Map not found.'); return; }
  const { data, error } = await getSupabase().rpc('get_map', { p_id: id });
  const result = data as { status?: string; map?: MapConfig } | null;
  if (error || !result?.map) { showStatus(status, result?.status === 'private' ? 'This map is private. Sign in to view it.' : 'Map not found.', result?.status === 'private'); return; }
  try {
    const layers = await fetchLayers(result.map.id); status.hidden = true; container.hidden = false;
    const heading = document.querySelector('h1'); if (heading) heading.textContent = result.map.name;
    renderMap(container, result.map, layers); void revealEditLink(result.map.id);
  } catch { showStatus(status, 'Could not load this map. Reload the page to try again.'); }
}

export function initMapExplorer(): void {
  const root = document.querySelector<HTMLElement>('[data-map-explorer]');
  const select = document.querySelector<HTMLSelectElement>('[data-map-choice]');
  const data = document.querySelector<HTMLScriptElement>('[data-map-catalog]');
  const description = document.querySelector<HTMLElement>('[data-map-description]');
  if (!root || !select || !data) return;
  const maps = JSON.parse(data.textContent ?? '[]') as MapConfig[];
  let instance: L.Map | undefined;
  let revision = 0;
  async function choose(): Promise<void> {
    const config = maps.find(m => m.id === select!.value); if (!config) return;
    const current = ++revision; instance?.remove(); root!.replaceChildren(element('p', 'Loading map…', 'status'));
    delete root!.dataset.mapReady;
    if (description) description.textContent = config.description ?? '';
    const url = new URL(location.href);
    if (url.searchParams.get('map') !== config.slug) { url.searchParams.set('map', config.slug); url.searchParams.delete('layers'); url.searchParams.delete('event'); history.replaceState(null, '', url); }
    try { const layers = await fetchLayers(config.id); if (current !== revision) return; instance = renderMap(root!, config, layers); }
    catch { if (current === revision) { showStatus(root!, 'Could not load map layers.'); const retry = element('button', 'Try again'); retry.addEventListener('click', () => void choose()); root!.append(retry); } }
  }
  const slug = new URLSearchParams(location.search).get('map') ?? 'voting';
  select.value = (maps.find(m => m.slug === slug) ?? maps[0])?.id ?? '';
  select.addEventListener('change', () => void choose());
  window.addEventListener('popstate', () => { select.value = maps.find(m => m.slug === new URLSearchParams(location.search).get('map'))?.id ?? maps[0]?.id ?? ''; void choose(); });
  if (maps.length) void choose(); else root.textContent = 'No public maps are published yet.';
}

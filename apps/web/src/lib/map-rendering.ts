import L from 'leaflet';
import {
  buildCategoryColor, featureIcon, featureStyle, layerFeatureMarkerOptions,
  layerFeaturePathOptions, normalizePresentation, resolveLayerStyle, safeMapUrl,
  type LayerConfig,
} from './layers';

export function featureTitle(feature: GeoJSON.Feature, layer: LayerConfig): string {
  const p = feature.properties ?? {};
  const presentation = normalizePresentation(layer.presentation);
  const title = String(p[presentation.titleProperty || 'name'] ?? layer.name);
  const suffix = presentation.titleSuffix ? p[presentation.titleSuffix] : null;
  return suffix ? `${title} · ${String(suffix)}` : title;
}

function appendText(root: HTMLElement, text: string, tag = 'p'): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  root.append(node);
  return node;
}

function appendLink(root: HTMLElement, text: string, value: unknown): void {
  const url = safeMapUrl(value);
  if (!url) return;
  const paragraph = document.createElement('p');
  const link = document.createElement('a');
  link.href = url;
  link.textContent = text;
  paragraph.append(link);
  root.append(paragraph);
}

function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.map(valueText).join('\n');
  if (value && typeof value === 'object' && 'label' in value && 'lines' in value) return `${String(value.label)}\n${valueText(value.lines)}`;
  if (value && typeof value === 'object') return Object.entries(value).map(([key, v]) => `${key}: ${valueText(v)}`).join('\n');
  return value == null ? '' : String(value);
}

export type RelatedFeature = (key: string, property: string, value: string) => Promise<void>;

export function featurePopup(feature: GeoJSON.Feature, layer: LayerConfig, related?: RelatedFeature): HTMLElement {
  const root = document.createElement('div');
  root.className = 'map-feature-details';
  const p = feature.properties ?? {};
  const display = normalizePresentation(layer.presentation);
  appendText(root, featureTitle(feature, layer), 'h3');
  for (const field of display.popupFields ?? []) {
    const value = p[field.property];
    if (value == null || value === '') continue;
    const text = valueText(value);
    const row = document.createElement('p');
    const label = document.createElement('strong');
    label.textContent = `${field.label}: `;
    row.append(label);
    if (field.format === 'url' && safeMapUrl(value)) {
      const a = document.createElement('a'); a.href = safeMapUrl(value)!; a.textContent = text; row.append(a);
    } else if (field.format === 'email' || field.format === 'phone') {
      const a = document.createElement('a');
      const contact = field.format === 'email' && !text.includes('@') && display.key === 'commission-districts' ? `${text}@maconbibb.us` : text;
      a.href = field.format === 'email' ? `mailto:${encodeURIComponent(contact)}` : `tel:${contact.replace(/[^\d+]/g, '')}`;
      a.textContent = contact; row.append(a);
    } else row.append(document.createTextNode(text));
    root.append(row);
  }
  if (display.renderer === 'events') {
    const events = Array.isArray(p.events) ? [...p.events] as Record<string, unknown>[] : [];
    const selected = new URLSearchParams(location.search).get('event');
    const now = Date.now();
    const future = (e: Record<string, unknown>) => new Date(String(e.end ?? e.start)).getTime() >= now;
    events.sort((a, b) => Number(b.id === selected) - Number(a.id === selected) || Number(future(b)) - Number(future(a)) || (future(a) ? 1 : -1) * String(a.start).localeCompare(String(b.start)));
    appendText(root, `${events.length} events in this saved snapshot. Select an event for details.`);
    for (const event of events) {
      const details = document.createElement('details');
      details.open = event.id === selected;
      const summary = document.createElement('summary');
      const date = new Date(String(event.start));
      const when = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', ...(event.allDay ? {} : { timeStyle: 'short' }), timeZone: 'America/New_York' }).format(date);
      summary.textContent = `${String(event.title)} · ${when}${event.allDay ? '' : ' ET'}`;
      details.append(summary);
      if (event.description) appendText(details, String(event.description));
      if (event.note) appendText(details, String(event.note));
      appendLink(details, String(event.sourceLabel ?? 'View organizer’s event'), event.sourceUrl);
      root.append(details);
    }
  }
  if (related && p.pollingid && (display.renderer === 'polling' || display.renderer === 'precincts')) {
    const button = document.createElement('button');
    button.type = 'button';
    const target = display.renderer === 'polling' ? 'voting-precincts' : 'polling-places';
    button.textContent = display.renderer === 'polling' ? `Show precinct ${p.pollingid}` : `Show polling places for ${p.pollingid}`;
    button.addEventListener('click', () => { void related(target, 'pollingid', String(p.pollingid)); });
    root.append(button);
  }
  if (display.note) appendText(root, display.note);
  if (display.key?.startsWith('transit-') && new Date().toISOString().slice(0, 10) > '2026-10-31') appendText(root, 'This schedule snapshot has expired. Check MBCTA for current service.');
  appendLink(root, 'Original source', p.sourceUrl ?? p.detailsUrl ?? display.sourceUrl);
  if (p.fulladd) appendLink(root, 'Get directions', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(p.fulladd))}`);
  if (display.attribution) appendText(root, `Source: ${display.attribution}`);
  return root;
}

/** Shared by public viewers and admin previews. No downloaded HTML is executed. */
export function createGeoJSONLayer(
  layer: LayerConfig,
  data: GeoJSON.GeoJsonObject,
  options: { pane?: string; related?: RelatedFeature; interactive?: boolean } = {},
): L.GeoJSON {
  const style = resolveLayerStyle(layer.style);
  const colorFor = style.categorizeBy && Object.keys(style.categoryStyles).length === 0
    ? buildCategoryColor(data, style.categorizeBy, style.palette) : undefined;
  const presentation = normalizePresentation(layer.presentation);
  return L.geoJSON(data, {
    pane: options.pane,
    interactive: options.interactive !== false,
    // Leaflet interprets attribution as HTML. Escape source text before passing it.
    attribution: presentation.attribution?.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!),
    style: feature => feature ? layerFeaturePathOptions(featureStyle(style, feature), feature, colorFor) : {},
    pointToLayer: (feature, latlng) => {
      const effective = featureStyle(style, feature);
      const icon = featureIcon(effective, feature);
      return icon ? L.marker(latlng, {
        interactive: options.interactive !== false, keyboard: options.interactive !== false,
        pane: options.pane, title: featureTitle(feature, layer), alt: featureTitle(feature, layer),
        icon: L.icon({ iconUrl: icon.url, iconSize: icon.size, iconAnchor: icon.anchor, popupAnchor: icon.popupAnchor }),
      }) : L.circleMarker(latlng, { ...layerFeatureMarkerOptions(effective, feature, colorFor), pane: options.pane, interactive: options.interactive !== false });
    },
    onEachFeature: (feature, rendered) => {
      if (options.interactive === false) return;
      rendered.bindPopup(() => featurePopup(feature, layer, options.related), { maxHeight: 300, maxWidth: 330, autoPanPadding: L.point(16, 16) });
      const tooltip = document.createElement('span');
      tooltip.textContent = featureTitle(feature, layer);
      rendered.bindTooltip(tooltip, { sticky: true });
    },
  });
}

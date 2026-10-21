import L from 'leaflet';
import {
  buildCategoryColor,
  layerFeatureMarkerOptions,
  layerFeaturePathOptions,
  resolveLayerStyle,
  type LayerConfig,
} from '../lib/layers';
import type { MapConfig } from '../lib/maps';
import { getSupabase } from '../lib/supabase';

const HOME_CENTER: L.LatLngExpression = [32.8407, -83.6324];
const HOME_ZOOM = 8;

/**
 * Render a compact, non-interactive preview of a map's layers. The base map is
 * intentionally omitted so the homepage previews stay light on tiles.
 */
function renderPreview(container: HTMLElement, config: MapConfig): void {
  const map = L.map(container, {
    center: HOME_CENTER,
    zoom: HOME_ZOOM,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
  });

  const group = L.layerGroup().addTo(map);
  const bounds = L.latLngBounds([]);
  setTimeout(() => map.invalidateSize(), 0);

  void getSupabase()
    .rpc('get_map_layers', { p_map_id: config.id })
    .then(({ data }) => {
      const layers = (data ?? []) as unknown as LayerConfig[];
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
              style: (feature) => ({
                ...layerFeaturePathOptions(style, feature, colorFor),
                interactive: false,
              }),
              pointToLayer: (feature, latlng) =>
                L.circleMarker(latlng, {
                  ...layerFeatureMarkerOptions(style, feature, colorFor),
                  interactive: false,
                }),
            });
            rendered.addTo(group);
            const layerBounds = rendered.getBounds();
            if (layerBounds.isValid()) {
              bounds.extend(layerBounds);
              map.fitBounds(bounds, { padding: [16, 16], maxZoom: 14 });
            }
          })
          .catch(() => {
            /* ignore layers that fail to load in the preview */
          });
      }
    });
}

export function initHomeMaps(): void {
  const carousel = document.querySelector<HTMLElement>('[data-map-carousel]');
  const script = document.querySelector<HTMLScriptElement>('[data-home-maps]');
  if (!carousel || !script) return;

  let maps: MapConfig[];
  try {
    maps = JSON.parse(script.textContent ?? '[]') as MapConfig[];
  } catch {
    return;
  }
  if (maps.length === 0) return;

  const byId = new Map(maps.map((map) => [map.id, map]));
  const viewport = carousel.querySelector<HTMLElement>('[data-carousel-viewport]');
  const previews = [...carousel.querySelectorAll<HTMLElement>('[data-map-preview]')];

  // Only build a Leaflet instance once a slide is (nearly) visible, so a large
  // collection does not trigger every tile request up front.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        const config = byId.get(element.dataset.mapId ?? '');
        observer.unobserve(element);
        if (config) renderPreview(element, config);
      }
    },
    { root: viewport ?? null, rootMargin: '0px 400px' },
  );
  for (const preview of previews) observer.observe(preview);

  const prev = carousel.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = carousel.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const count = carousel.querySelector<HTMLElement>('[data-carousel-count]');
  const scroller = viewport ?? carousel;

  if (maps.length <= 1) {
    prev?.remove();
    next?.remove();
    if (count) count.textContent = '';
    return;
  }

  const AUTOPLAY_MS = 5000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let autoplay: number | undefined;
  let inView = false;

  function slideWidth(): number {
    return scroller.clientWidth;
  }

  function currentIndex(): number {
    return Math.round(scroller.scrollLeft / Math.max(slideWidth(), 1));
  }

  function goTo(index: number): void {
    const wrapped = ((index % maps.length) + maps.length) % maps.length;
    scroller.scrollTo({
      left: wrapped * slideWidth(),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  function update(): void {
    const max = scroller.scrollWidth - scroller.clientWidth;
    const index = currentIndex() + 1;
    if (prev) prev.disabled = scroller.scrollLeft <= 2;
    if (next) next.disabled = scroller.scrollLeft >= max - 2;
    if (count) count.textContent = `${Math.min(index, maps.length)} / ${maps.length}`;
  }

  function startAutoplay(): void {
    if (reduceMotion || autoplay !== undefined || document.hidden || !inView) return;
    autoplay = window.setInterval(() => goTo(currentIndex() + 1), AUTOPLAY_MS);
  }

  function stopAutoplay(): void {
    if (autoplay === undefined) return;
    window.clearInterval(autoplay);
    autoplay = undefined;
  }

  function restartAutoplay(): void {
    stopAutoplay();
    startAutoplay();
  }

  prev?.addEventListener('click', () => {
    goTo(currentIndex() - 1);
    restartAutoplay();
  });
  next?.addEventListener('click', () => {
    goTo(currentIndex() + 1);
    restartAutoplay();
  });
  scroller.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  // Pause while the visitor is interacting, then resume when they leave.
  carousel.addEventListener('pointerenter', stopAutoplay);
  carousel.addEventListener('pointerleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);
  carousel.addEventListener('touchstart', stopAutoplay, { passive: true });
  carousel.addEventListener('touchend', startAutoplay, { passive: true });

  // Only animate while the carousel is actually on screen (and the tab is open).
  const visibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (inView) startAutoplay();
        else stopAutoplay();
      }
    },
    { threshold: 0.25 },
  );
  visibility.observe(carousel);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  update();
}

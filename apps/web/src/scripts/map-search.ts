import { baseMapLabel } from '../lib/basemaps';
import type { MapConfig, MapVisibility } from '../lib/maps';
import { getSupabase } from '../lib/supabase';

const VISIBILITY_LABELS: Record<MapVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

function mapHref(map: MapConfig): string {
  // The viewer shell carries the uuid as a query param so it works under the
  // Astro dev server and preview too (Cloudflare `_redirects` only applies to
  // the deployed Worker, not locally served builds).
  if (map.visibility === 'unlisted') return `/maps/view/?id=${map.id}`;
  if (map.visibility === 'private') return `/maps/view/?id=${map.id}`;
  return `/maps/${map.slug}/`;
}

function renderCard(map: MapConfig): HTMLElement {
  const card = document.createElement('a');
  card.className = 'org-card';
  card.href = mapHref(map);

  const name = document.createElement('h2');
  name.textContent = map.name;
  card.append(name);

  if (map.visibility !== 'public') {
    const badge = document.createElement('span');
    badge.className = 'visibility-badge';
    badge.textContent = VISIBILITY_LABELS[map.visibility];
    card.append(badge);
  }

  if (map.description) {
    const description = document.createElement('p');
    description.textContent = map.description;
    card.append(description);
  }

  const meta = document.createElement('span');
  meta.className = 'map-card-meta';
  meta.textContent = [map.organizations?.name, baseMapLabel(map.base_map)]
    .filter(Boolean)
    .join(' · ');
  card.append(meta);

  return card;
}

export function initMapSearch(): void {
  const input = document.querySelector<HTMLInputElement>('[data-map-search]');
  const initial = document.querySelector<HTMLElement>('[data-map-initial]');
  const results = document.querySelector<HTMLElement>('[data-map-search-results]');
  const status = document.querySelector<HTMLElement>('[data-map-search-status]');
  const empty = document.querySelector<HTMLElement>('[data-map-search-empty]');
  const note = document.querySelector<HTMLElement>('[data-map-search-note]');
  if (!input || !results) return;

  const inputEl = input;
  const resultsEl = results;
  const supabase = getSupabase();
  let signedIn = false;
  let timer: number | undefined;
  let requestId = 0;

  /** Signed in: list everything the user may see. Signed out: static public list. */
  async function listAccessible(): Promise<void> {
    if (!signedIn) {
      requestId += 1;
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
      if (status) status.hidden = true;
      if (empty) empty.hidden = true;
      if (initial) initial.hidden = false;
      return;
    }

    const id = ++requestId;
    if (status) {
      status.textContent = 'Loading maps…';
      status.hidden = false;
    }

    const { data, error } = await supabase.rpc('search_maps', {
      p_query: '',
      p_limit: 50,
    });

    if (id !== requestId) return;

    if (error) {
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
      if (status) status.textContent = `Could not load maps: ${error.message}`;
      return;
    }

    const maps = (data ?? []) as unknown as MapConfig[];
    resultsEl.replaceChildren(...maps.map(renderCard));
    resultsEl.hidden = maps.length === 0;
    if (empty) empty.hidden = maps.length > 0;
    if (initial) initial.hidden = true;
    if (status) {
      status.textContent = `${maps.length} map${maps.length === 1 ? '' : 's'} available (includes unlisted and private)`;
    }
  }

  async function search(query: string): Promise<void> {
    const id = ++requestId;
    if (status) {
      status.textContent = 'Searching…';
      status.hidden = false;
    }

    const { data, error } = await supabase.rpc('search_maps', {
      p_query: query,
      p_limit: 24,
    });

    if (id !== requestId) return;

    if (error) {
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
      if (status) status.textContent = `Search failed: ${error.message}`;
      return;
    }

    const maps = (data ?? []) as unknown as MapConfig[];
    resultsEl.replaceChildren(...maps.map(renderCard));
    resultsEl.hidden = maps.length === 0;
    if (empty) empty.hidden = maps.length > 0;
    if (initial) initial.hidden = true;
    if (status) {
      status.textContent = `${maps.length} result${maps.length === 1 ? '' : 's'}`;
    }
  }

  function update(): void {
    const query = inputEl.value.trim();

    if (!query) {
      void listAccessible();
      return;
    }

    if (initial) initial.hidden = true;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void search(query), 200);
  }

  inputEl.addEventListener('input', update);

  inputEl.closest('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    const query = inputEl.value.trim();
    if (query) void search(query);
    else void listAccessible();
  });

  void supabase.auth.getSession().then(({ data: { session } }) => {
    signedIn = Boolean(session);
    if (signedIn && note) note.hidden = false;
    if (signedIn) void listAccessible();
  });
}

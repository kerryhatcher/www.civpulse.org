import { getSupabase } from '../lib/supabase';
import { personImageUrl } from '../lib/people';
import { countySearchPage, readCountyIndex, selectedCounty } from './county-filter';
import { matchesCounty } from '../lib/county-scope';

interface SearchResult {
  entity_type: string; id: string; title: string; description: string | null;
  url: string | null; visibility: string;
}
const labels: Record<string, string> = {
  person: 'Person', organization: 'Organization', election: 'Election', contest: 'Race',
  ballot_question: 'Ballot question', article: 'Article', map: 'Map', layer: 'Layer',
  calendar: 'Calendar', event: 'Event',
};
const pageSize = 20;

function renderResult(result: SearchResult): HTMLElement {
  const card = document.createElement('article'); card.className = 'org-card site-search-result';
  if (result.entity_type === 'person') {
    const fallback = document.createElement('span');
    fallback.className = 'org-card-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = result.title.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(word => word[0]?.toUpperCase() ?? '').join('');
    card.append(fallback);
  }
  const type = document.createElement('p'); type.className = 'site-search-result-type';
  type.textContent = labels[result.entity_type] ?? 'Content';
  const title = document.createElement('h2');
  let target: URL | null = null;
  try {
    if (result.url) {
      const parsed = new URL(result.url, window.location.origin);
      if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
        && (result.entity_type === 'article' || parsed.origin === window.location.origin)) target = parsed;
    }
  } catch { /* Metadata without a usable destination still has a readable result. */ }
  if (target) {
    const link = document.createElement('a'); link.href = target.href; link.textContent = result.title;
    if (result.entity_type === 'article') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    title.append(link);
  } else title.textContent = result.title;
  card.append(title, type);
  if (result.visibility !== 'public') {
    const access = document.createElement('span'); access.className = 'visibility-badge';
    access.textContent = result.visibility === 'private' ? 'Private' : 'Unlisted'; card.append(access);
  }
  if (result.description) { const description = document.createElement('p'); description.textContent = result.description; card.append(description); }
  if (result.entity_type === 'article' && target) {
    const source = document.createElement('span'); source.className = 'candidate-meta'; source.textContent = target.hostname; card.append(source);
  }
  return card;
}

export async function initSiteSearch(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('[data-site-search-form]');
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>('[data-site-search-input]')!;
  const type = form.querySelector<HTMLSelectElement>('[data-site-search-type]')!;
  const results = document.querySelector<HTMLElement>('[data-site-search-results]')!;
  const status = document.querySelector<HTMLElement>('[data-site-search-status]')!;
  const access = document.querySelector<HTMLElement>('[data-site-search-access]')!;
  const previous = document.querySelector<HTMLButtonElement>('[data-site-search-previous]')!;
  const next = document.querySelector<HTMLButtonElement>('[data-site-search-next]')!;
  const supabase = getSupabase();
  let request = 0, offset = 0, timer: number | undefined;
  let ready = false;

  function restoreUrl(): void {
    const params = new URLSearchParams(window.location.search);
    input.value = (params.get('q') ?? '').slice(0, 500);
    const chosen = params.get('type') ?? '';
    type.value = Object.hasOwn(labels, chosen) ? chosen : '';
    const page = Number(params.get('page') ?? '1');
    offset = Number.isSafeInteger(page) && page > 0 && page <= 10000 ? (page - 1) * pageSize : 0;
  }
  function saveUrl(): void {
    const params = new URLSearchParams();
    if (input.value.trim()) params.set('q', input.value.trim());
    if (type.value) params.set('type', type.value);
    if (offset) params.set('page', String(offset / pageSize + 1));
    const query = params.toString(); history.replaceState(null, '', `/search/${query ? '?' + query : ''}`);
  }
  async function search(): Promise<void> {
    const token = ++request;
    results.replaceChildren(); previous.hidden = true; next.hidden = true;
    results.removeAttribute('aria-busy');
    if (!ready) return;
    saveUrl();
    if (!input.value.trim() && !type.value) { status.textContent = 'Enter a search or choose a content type to browse.'; return; }
    status.textContent = 'Searching…';
    results.setAttribute('aria-busy', 'true');
    try {
      const index = await readCountyIndex();
      const query = input.value.trim(), chosenType = type.value || null;
      const data = await countySearchPage(async cursor => {
        if (token !== request) return [];
        const { data, error } = await supabase.rpc('search_site', {
          p_query: query, p_type: chosenType, p_limit: 100, p_offset: cursor,
        });
        if (error) throw error;
        // Keep the raw page length for scanning; each result supplies its own kind.
        return (data ?? []) as SearchResult[];
      }, 'search', offset, pageSize + 1, 100,
      row => matchesCounty(index, row.entity_type, row.id, selectedCounty()));
      if (token !== request) return;
      const rows = (data ?? []) as SearchResult[];
      const visible = rows.slice(0, pageSize);
      const cards = visible.map(renderResult);
      results.replaceChildren(...cards);
      // Load through the person visibility gate, including UUID-only records.
      // Result text stays usable while these optional images load.
      void Promise.allSettled(visible.map(async (row, index) => {
        if (row.entity_type !== 'person') return;
        const { data, error } = await supabase.rpc('get_person', { p_id: row.id });
        if (token !== request || error || data?.status !== 'ok') return;
        const url = personImageUrl(data.person?.image_path);
        const fallback = cards[index]?.querySelector('.org-card-fallback');
        if (!url || !fallback) return;
        const image = document.createElement('img');
        image.className = 'org-card-logo person-card-image';
        image.alt = '';
        image.width = 72;
        image.height = 72;
        image.loading = 'lazy';
        image.addEventListener('error', () => image.replaceWith(fallback), { once: true });
        image.src = url;
        fallback.replaceWith(image);
      }));
      previous.hidden = offset === 0; next.hidden = rows.length <= pageSize;
      status.textContent = visible.length ? `Showing results ${offset + 1}–${offset + visible.length}${rows.length > pageSize ? ' · more available' : ''}`
        : offset ? 'No more results. Choose Previous to return.' : 'No matching content you can access.';
    } catch {
      if (token === request) { results.replaceChildren(); status.textContent = 'Could not search. Please try again.'; }
    } finally { if (token === request) results.removeAttribute('aria-busy'); }
  }
  function update(): void {
    ++request; results.replaceChildren(); previous.hidden = true; next.hidden = true;
    offset = 0; window.clearTimeout(timer); timer = window.setTimeout(() => void search(), 200);
  }
  restoreUrl();
  form.addEventListener('submit', event => { event.preventDefault(); window.clearTimeout(timer); offset = 0; void search(); });
  input.addEventListener('input', update); type.addEventListener('change', update);
  window.addEventListener('countychange', update);
  previous.addEventListener('click', () => { offset = Math.max(0, offset - pageSize); void search(); });
  next.addEventListener('click', () => { offset += pageSize; void search(); });
  window.addEventListener('popstate', () => { restoreUrl(); void search(); });
  const { data: { session } } = await supabase.auth.getSession();
  let identity = session?.user.id ?? null;
  function showAccess(): void { access.textContent = 'Search shows public content. Admins can also search unlisted and private content.'; }
  showAccess(); ready = true; await search();
  supabase.auth.onAuthStateChange((_event, current) => {
    const nextIdentity = current?.user.id ?? null;
    if (nextIdentity === identity) return;
    identity = nextIdentity; showAccess(); ++request; results.replaceChildren(); offset = 0;
    // Start outside the auth callback to avoid Supabase auth-lock reentrancy.
    window.setTimeout(() => void search(), 0);
  });
}

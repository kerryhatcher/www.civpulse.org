import type { Organization } from '../lib/organizations';
import { organizationLogoUrl } from '../lib/supabase-build';
import { getSupabase } from '../lib/supabase';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function renderCard(org: Organization): HTMLElement {
  const card = document.createElement('a');
  card.className = 'org-card';
  card.href = `/orgs/${org.slug}/`;

  const logo = organizationLogoUrl(org.logo_path);
  if (logo) {
    const image = document.createElement('img');
    image.className = 'org-card-logo';
    image.src = logo;
    image.alt = '';
    image.width = 72;
    image.height = 72;
    card.append(image);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'org-card-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = initials(org.name);
    card.append(fallback);
  }

  const name = document.createElement('h2');
  name.textContent = org.name;
  card.append(name);

  if (org.description) {
    const description = document.createElement('p');
    description.textContent = org.description;
    card.append(description);
  }

  return card;
}

export function initOrgSearch(): void {
  const input = document.querySelector<HTMLInputElement>('[data-org-search]');
  const initial = document.querySelector<HTMLElement>('[data-org-initial]');
  const results = document.querySelector<HTMLElement>('[data-org-search-results]');
  const status = document.querySelector<HTMLElement>('[data-org-search-status]');
  const empty = document.querySelector<HTMLElement>('[data-org-search-empty]');
  if (!input || !results) return;

  const inputEl = input;
  const resultsEl = results;
  const supabase = getSupabase();
  let timer: number | undefined;
  let requestId = 0;

  function restoreInitial(): void {
    requestId += 1;
    resultsEl.replaceChildren();
    resultsEl.hidden = true;
    if (status) status.hidden = true;
    if (empty) empty.hidden = true;
    if (initial) initial.hidden = false;
  }

  async function search(query: string): Promise<void> {
    const id = ++requestId;
    if (status) {
      status.textContent = 'Searching…';
      status.hidden = false;
    }

    const { data, error } = await supabase.rpc('search_organizations', {
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

    const organizations = (data ?? []) as unknown as Organization[];
    resultsEl.replaceChildren(...organizations.map(renderCard));
    resultsEl.hidden = organizations.length === 0;
    if (empty) empty.hidden = organizations.length > 0;
    if (status) {
      status.textContent = `${organizations.length} result${
        organizations.length === 1 ? '' : 's'
      }`;
      status.hidden = false;
    }
  }

  function update(): void {
    const query = inputEl.value.trim();

    if (!query) {
      restoreInitial();
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
    else restoreInitial();
  });
}

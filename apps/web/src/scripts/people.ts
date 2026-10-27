import { renderProfileDescription } from '../lib/profile-description';
import { readDirectory } from './directory-data';
import { filterCounty, selectedCounty } from './county-filter';
import { browsePeople, orderPeople, type DirectoryPerson } from '../lib/directories';
import { loadOfficeTerms } from './office-terms';
import { loadProfileArticles } from './profile-articles';
import { loadPersonCandidacies } from './person-candidacies';
import { loadPersonVotes } from './person-votes';
import {
  personHref,
  personImageUrl,
  PERSON_KIND_LABELS,
  PERSON_VISIBILITY_LABELS,
  type OrganizationAffiliation,
  type Person,
  type PersonKind,
  type PersonVisibility,
} from '../lib/people';
import { getSupabase } from '../lib/supabase';
import { isCurrentUserAdmin } from './auth';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function kindLabel(kind: PersonKind): string {
  return PERSON_KIND_LABELS[kind] ?? PERSON_KIND_LABELS.other;
}

function visibilityLabel(visibility: PersonVisibility): string {
  return PERSON_VISIBILITY_LABELS[visibility] ?? 'Public';
}

function renderCard(person: DirectoryPerson): HTMLElement {
  const card = document.createElement('a');
  card.className = 'org-card person-card';
  card.href = personHref(person);

  const image = personImageUrl(person.image_path);
  if (image) {
    const element = document.createElement('img');
    element.className = 'org-card-logo person-card-image';
    element.src = image;
    element.alt = '';
    element.width = 72;
    element.height = 72;
    card.append(element);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'org-card-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = initials(person.full_name);
    card.append(fallback);
  }

  const name = document.createElement('h2');
  name.textContent = person.full_name;
  card.append(name);

  if (person.visibility !== 'public') {
    const badge = document.createElement('span');
    badge.className = 'visibility-badge';
    badge.textContent = visibilityLabel(person.visibility);
    card.append(badge);
  }

  const role = [person.title, kindLabel(person.kind)].filter(Boolean).join(' · ');
  const meta = document.createElement('span');
  meta.className = 'person-card-meta';
  meta.textContent = role;
  card.append(meta);

  if (person.description) {
    const description = document.createElement('p');
    description.textContent = person.description;
    card.append(description);
  }

  return card;
}

/** Public discovery uses static data; signed-in discovery stays permission-checked. */
export function initPeopleSearch(): void {
  const input = document.querySelector<HTMLInputElement>('[data-person-search]');
  const kind = document.querySelector<HTMLSelectElement>('[data-person-kind]');
  const sort = document.querySelector<HTMLSelectElement>('[data-person-sort]');
  const results = document.querySelector<HTMLElement>('[data-person-search-results]');
  const status = document.querySelector<HTMLElement>('[data-person-search-status]');
  const previous = document.querySelector<HTMLButtonElement>('[data-person-previous]');
  const next = document.querySelector<HTMLButtonElement>('[data-person-next]');
  const pagination = document.querySelector<HTMLElement>('[data-person-pagination]');
  const pageLabel = document.querySelector<HTMLElement>('[data-person-page]');
  const initial = document.querySelector<HTMLElement>('[data-person-initial]');
  const empty = document.querySelector<HTMLElement>('[data-person-search-empty]');
  const note = document.querySelector<HTMLElement>('[data-person-search-note]');
  if (!input || !kind || !sort || !results || !status || !previous || !next || !pagination || !pageLabel) return;
  const ui = { input, kind, sort, results, status, previous, next, pagination, pageLabel };
  const supabase = getSupabase();
  const pageSize = 24;
  let page = 0;
  let requestId = 0;
  let timer: number | undefined;

  async function load(focus = false): Promise<void> {
    const id = ++requestId;
    ui.previous.disabled = ui.next.disabled = true;
    ui.results.setAttribute('aria-busy', 'true');
    ui.status.hidden = false;
    ui.status.textContent = 'Loading people…';
    try {
      const snapshot = await readDirectory('people');
      const rankAcrossPages = ui.sort.value === 'civic_first';
      const needsAll = selectedCounty() !== 'all' || rankAcrossPages;
      const rpcSort = rankAcrossPages ? 'first_asc' : ui.sort.value;
      let { data, error } = snapshot ? {data: browsePeople(snapshot, ui.input.value.trim(), ui.kind.value, ui.sort.value, page * pageSize, pageSize),error:null} : needsAll ? {data:null,error:null} : await supabase.rpc('browse_people', {
        p_query: ui.input.value.trim(), p_kind: ui.kind.value || null,
        p_sort: rpcSort, p_limit: pageSize, p_offset: page * pageSize,
      });
      if (!snapshot && needsAll && !error) {
        const all: Person[] = [];
        for (let offset = 0; ; offset += 100) {
          const result = await supabase.rpc('browse_people', {
            p_query: ui.input.value.trim(), p_kind: ui.kind.value || null,
            p_sort: rpcSort, p_limit: 100, p_offset: offset,
          });
          if (id !== requestId) return;
          if (result.error) throw result.error;
          const response = result.data as { people: Person[]; total: number };
          all.push(...response.people);
          if (all.length >= response.total || !response.people.length) break;
        }
        const scoped = orderPeople(await filterCounty(all, 'person'), ui.sort.value);
        data = { people: scoped.slice(page * pageSize, (page + 1) * pageSize), total: scoped.length };
      }
      if (id !== requestId) return;
      if (error) throw error;
      const response = data as { people: Person[]; total: number };
      const pages = Math.max(1, Math.ceil(response.total / pageSize));
      if (page >= pages) { page = pages - 1; void load(focus); return; }
      ui.results.replaceChildren(...response.people.map(renderCard));
      ui.results.hidden = response.people.length === 0;
      if (initial) initial.hidden = true;
      if (empty) empty.hidden = response.people.length > 0;
      ui.status.textContent = response.total === 0 ? '0 people found' :
        `Showing ${page * pageSize + 1}–${page * pageSize + response.people.length} of ${response.total} people`;
      ui.pageLabel.textContent = `Page ${page + 1} of ${pages}`;
      ui.pagination.hidden = response.total === 0;
      ui.previous.disabled = page === 0;
      ui.next.disabled = page + 1 >= pages;
      if (focus) { ui.status.tabIndex = -1; ui.status.focus(); }
    } catch (error) {
      if (id !== requestId) return;
      ui.results.replaceChildren();
      ui.results.hidden = true;
      if (initial) initial.hidden = true;
      if (empty) empty.hidden = true;
      ui.pagination.hidden = true;
      ui.status.textContent = `Could not load people. Try searching again. ${error instanceof Error ? error.message : ''}`;
    } finally {
      if (id === requestId) ui.results.removeAttribute('aria-busy');
    }
  }

  function update(delay = 0): void {
    window.clearTimeout(timer);
    ++requestId; // Invalidate in-flight responses as soon as criteria change.
    page = 0;
    ui.previous.disabled = ui.next.disabled = true;
    timer = window.setTimeout(() => void load(), delay);
  }
  ui.input.addEventListener('input', () => update(200));
  ui.kind.addEventListener('change', () => update());
  window.addEventListener('countychange', () => update());
  ui.sort.addEventListener('change', () => update());
  ui.input.closest('form')?.addEventListener('submit', event => { event.preventDefault(); update(); });
  ui.input.closest('form')?.addEventListener('reset', () => update());
  ui.previous.addEventListener('click', () => { page--; void load(true); });
  ui.next.addEventListener('click', () => { page++; void load(true); });
  void supabase.auth.getSession().then(async () => {
    if (note) note.hidden = !(await isCurrentUserAdmin());
    update();
  });
}

// --- Shared person viewer ----------------------------------------------

interface PersonViewResponse {
  status?: string;
  person?: Person;
  organizations?: OrganizationAffiliation[];
}

function personIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/people\/[up]\/([0-9a-f-]{36})\/?$/i);
  return match ? match[1] : null;
}

function showViewerStatus(root: HTMLElement, text: string, signIn = false): void {
  root.replaceChildren();

  const message = document.createElement('p');
  message.textContent = text;
  root.append(message);

  if (signIn) {
    const link = document.createElement('a');
    link.className = 'button-link';
    link.href = `/signin/?next=${encodeURIComponent(
      window.location.pathname + window.location.search,
    )}`;
    link.textContent = 'Sign in';
    root.append(link);
  }

  root.hidden = false;
}

function contactEntries(person: Person): { label: string; value: string; href: string | null }[] {
  const address = [
    person.address_line,
    person.address_line2,
    [person.city, person.state].filter(Boolean).join(', ') || null,
    person.postal_code,
  ].filter((line): line is string => Boolean(line));

  const entries: { label: string; value: string | null; href: string | null }[] = [
    { label: 'Email', value: person.email, href: person.email ? `mailto:${person.email}` : null },
    {
      label: 'Phone',
      value: person.phone,
      href: person.phone ? `tel:${person.phone.replace(/[^+\d]/g, '')}` : null,
    },
    {
      label: 'Fax',
      value: person.fax,
      href: person.fax ? `tel:${person.fax.replace(/[^+\d]/g, '')}` : null,
    },
    { label: 'Mailing address', value: address.join('\n'), href: null },
    { label: 'Website', value: person.website_url, href: person.website_url },
    { label: 'Social', value: person.social_url, href: person.social_url },
  ];

  return entries.filter(
    (entry): entry is { label: string; value: string; href: string | null } =>
      Boolean(entry.value),
  );
}

function fillPersonView(response: PersonViewResponse): void {
  const viewer = document.querySelector<HTMLElement>('[data-person-viewer]');
  const person = response.person;
  if (!viewer || !person) return;

  const setText = (selector: string, value: string | null | undefined): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value ?? '';
  };

  setText('[data-person-kind]', kindLabel(person.kind));
  setText('[data-person-name]', person.full_name);

  const title = document.querySelector<HTMLElement>('[data-person-title]');
  if (title) {
    title.textContent = person.title ?? '';
    title.hidden = !person.title;
  }

  const image = document.querySelector<HTMLImageElement>('[data-person-image]');
  const fallback = document.querySelector<HTMLElement>('[data-person-fallback]');
  const imageUrl = personImageUrl(person.image_path);
  if (image && fallback) {
    if (imageUrl) {
      image.src = imageUrl;
      image.alt = `${person.full_name} portrait`;
      image.hidden = false;
      fallback.hidden = true;
    } else {
      fallback.textContent = initials(person.full_name);
      fallback.hidden = false;
      image.hidden = true;
    }
  }

  const bio = document.querySelector<HTMLElement>('[data-person-bio]');
  if (bio) {
    bio.innerHTML = renderProfileDescription(person.description ?? '');
    bio.hidden = !person.description;
  }

  const contactSection = document.querySelector<HTMLElement>('[data-person-contact-section]');
  const contact = document.querySelector<HTMLElement>('[data-person-contact]');
  const entries = contactEntries(person);
  if (contactSection && contact) {
    contact.replaceChildren();
    for (const entry of entries) {
      const wrapper = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = entry.label;
      const detail = document.createElement('dd');
      if (entry.href) {
        const link = document.createElement('a');
        link.href = entry.href;
        link.textContent = entry.value;
        detail.append(link);
      } else {
        detail.textContent = entry.value;
      }
      wrapper.append(term, detail);
      contact.append(wrapper);
    }
    contactSection.hidden = entries.length === 0;
  }

  const affiliationSection = document.querySelector<HTMLElement>(
    '[data-person-affiliations-section]',
  );
  const affiliations = document.querySelector<HTMLElement>('[data-person-affiliations]');
  if (affiliationSection && affiliations) {
    const organizations = response.organizations ?? [];
    affiliations.replaceChildren();
    for (const org of organizations) {
      const item = document.createElement('p');
      item.className = 'affiliation-item';

      const link = document.createElement('a');
      link.href = `/orgs/${org.slug}/`;
      link.textContent = org.name;
      item.append(link);

      const role = document.createElement('span');
      role.className = 'affiliation-role';
      role.textContent = org.role;
      item.append(' · ', role);

      affiliations.append(item);
    }
    affiliationSection.hidden = organizations.length === 0;
  }

  viewer.hidden = false;
}

/** Viewer for any person uuid (public, unlisted, or private). */
export async function initPersonViewFromUrl(): Promise<void> {
  const viewer = document.querySelector<HTMLElement>('[data-person-viewer]');
  const status = document.querySelector<HTMLElement>('[data-person-viewer-status]');
  if (!viewer || !status) return;

  const id =
    personIdFromPath(window.location.pathname) ??
    new URLSearchParams(window.location.search).get('id');

  if (!id) {
    showViewerStatus(status, 'Person not found.');
    return;
  }

  const { data, error } = await getSupabase().rpc('get_person', { p_id: id });
  const response = data as PersonViewResponse | null;

  if (error || !response || response.status === 'missing') {
    showViewerStatus(status, 'Person not found.');
    return;
  }

  if (response.status === 'private') {
    showViewerStatus(status, 'This person record is private. An admin account is required to view it.', true);
    return;
  }

  status.hidden = true;
  fillPersonView(response);
  if (response.person) {
    void loadOfficeTerms(response.person.id);
    void loadPersonCandidacies(response.person.id);
  void loadPersonVotes(response.person.id);
    void loadProfileArticles('person', response.person.id);
  }

  if (response.person && (await isCurrentUserAdmin())) {
    const edit = document.querySelector<HTMLAnchorElement>('[data-person-edit-link]');
    if (edit) {
      edit.href = `/admin/people/?edit=${response.person.id}`;
      edit.hidden = false;
    }
  }
}

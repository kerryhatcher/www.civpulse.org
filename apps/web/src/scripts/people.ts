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

function renderCard(person: Person): HTMLElement {
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

/** Public people directory. Search uses `search_people`, which widens to
 * unlisted/private records for admins. */
export function initPeopleSearch(): void {
  const input = document.querySelector<HTMLInputElement>('[data-person-search]');
  const initial = document.querySelector<HTMLElement>('[data-person-initial]');
  const results = document.querySelector<HTMLElement>('[data-person-search-results]');
  const status = document.querySelector<HTMLElement>('[data-person-search-status]');
  const empty = document.querySelector<HTMLElement>('[data-person-search-empty]');
  const note = document.querySelector<HTMLElement>('[data-person-search-note]');
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
      status.textContent = 'Loading people…';
      status.hidden = false;
    }

    const { data, error } = await supabase.rpc('search_people', { p_query: '', p_limit: 50 });

    if (id !== requestId) return;

    if (error) {
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
      if (status) status.textContent = `Could not load people: ${error.message}`;
      return;
    }

    const people = (data ?? []) as unknown as Person[];
    resultsEl.replaceChildren(...people.map(renderCard));
    resultsEl.hidden = people.length === 0;
    if (empty) empty.hidden = people.length > 0;
    if (initial) initial.hidden = true;
    if (status) {
      status.textContent = `${people.length} ${
        people.length === 1 ? 'person' : 'people'
      } available (includes unlisted and private)`;
    }
  }

  async function search(query: string): Promise<void> {
    const id = ++requestId;
    if (status) {
      status.textContent = 'Searching…';
      status.hidden = false;
    }

    const { data, error } = await supabase.rpc('search_people', { p_query: query, p_limit: 24 });

    if (id !== requestId) return;

    if (error) {
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
      if (status) status.textContent = `Search failed: ${error.message}`;
      return;
    }

    const people = (data ?? []) as unknown as Person[];
    resultsEl.replaceChildren(...people.map(renderCard));
    resultsEl.hidden = people.length === 0;
    if (empty) empty.hidden = people.length > 0;
    if (initial) initial.hidden = true;
    if (status) {
      status.textContent = `${people.length} result${people.length === 1 ? '' : 's'}`;
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
    bio.textContent = person.description ?? '';
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

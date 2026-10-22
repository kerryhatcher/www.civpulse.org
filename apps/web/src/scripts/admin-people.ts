import { uploadProfileImage, initImagePreview } from '../lib/media';
import {
  COMMON_ROLES,
  personHref,
  personImageUrl,
  PERSON_COLUMNS,
  PERSON_KIND_LABELS,
  PERSON_VISIBILITY_LABELS,
  type AffiliationRow,
  type Person,
  type PersonKind,
  type PersonVisibility,
} from '../lib/people';
import { getSupabase } from '../lib/supabase';

type MessageKind = 'info' | 'error' | 'success';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function setMessage(
  root: Document | HTMLElement,
  selector: string,
  text: string,
  kind: MessageKind = 'info',
): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
  element.hidden = false;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function kindValue(value: string): PersonKind {
  return (Object.keys(PERSON_KIND_LABELS) as PersonKind[]).includes(value as PersonKind)
    ? (value as PersonKind)
    : 'other';
}

function visibilityValue(value: string): PersonVisibility {
  return (['public', 'unlisted', 'private'] as PersonVisibility[]).includes(
    value as PersonVisibility,
  )
    ? (value as PersonVisibility)
    : 'public';
}

export async function initPeopleAdmin(): Promise<void> {
  const gate = document.querySelector<HTMLElement>('[data-admin-gate]');
  const denied = document.querySelector<HTMLElement>('[data-admin-denied]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const personForm = document.querySelector<HTMLFormElement>('[data-person-form]');
  const affiliationForm = document.querySelector<HTMLFormElement>('[data-affiliation-form]');
  const personList = document.querySelector<HTMLElement>('[data-person-list]');
  const affiliationList = document.querySelector<HTMLElement>('[data-affiliation-list]');
  if (!panel || !personForm || !affiliationForm || !personList || !affiliationList) return;

  const personFormEl = personForm;
  const affiliationFormEl = affiliationForm;
  const personListEl = personList;
  const affiliationListEl = affiliationList;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('/signin/?next=/admin/people/');
    return;
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  gate?.remove();

  if (!adminRow) {
    if (denied) denied.hidden = false;
    return;
  }

  panel.hidden = false;

  // --- Element references ------------------------------------------------

  const personId = personFormEl.querySelector<HTMLInputElement>('input[name="id"]');
  const personName = personFormEl.querySelector<HTMLInputElement>('input[name="full_name"]');
  const personSlug = personFormEl.querySelector<HTMLInputElement>('input[name="slug"]');
  const personImage = personFormEl.querySelector<HTMLInputElement>('input[name="image"]');
  const personImageRemove = personFormEl.querySelector<HTMLButtonElement>('[data-person-image-remove]');
  const personPreview = personFormEl.querySelector<HTMLImageElement>(
    '[data-person-image-preview]',
  );
  const personSubmit = personFormEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const personCancel = personFormEl.querySelector<HTMLButtonElement>('[data-person-cancel]');
  const personHeading = document.querySelector<HTMLElement>('[data-person-form-title]');

  const affiliationOriginalPerson = affiliationFormEl.querySelector<HTMLInputElement>(
    'input[name="original_person_id"]',
  );
  const affiliationOriginalOrg = affiliationFormEl.querySelector<HTMLInputElement>(
    'input[name="original_organization_id"]',
  );
  const affiliationPerson = affiliationFormEl.querySelector<HTMLSelectElement>(
    'select[name="person_id"]',
  );
  const affiliationOrg = affiliationFormEl.querySelector<HTMLSelectElement>(
    'select[name="organization_id"]',
  );
  const affiliationRole = affiliationFormEl.querySelector<HTMLInputElement>('input[name="role"]');
  const affiliationSubmit = affiliationFormEl.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  const affiliationCancel = affiliationFormEl.querySelector<HTMLButtonElement>(
    '[data-affiliation-cancel]',
  );
  const affiliationHeading = document.querySelector<HTMLElement>('[data-affiliation-form-title]');
  const roleOptions = document.querySelector<HTMLDataListElement>('#affiliation-role-options');

  // --- State -------------------------------------------------------------

  let people: Person[] = [];
  let affiliations: AffiliationRow[] = [];
  const organizationNames = new Map<string, string>();
  let slugTouched = false;
  let editingImagePath: string | null = null;

  // --- Lookups -----------------------------------------------------------

  async function loadOrganizations(): Promise<void> {
    const { data, error } = await supabase.from('organizations').select('id, name').order('name');

    if (error) {
      setMessage(affiliationFormEl, '[data-affiliation-message]', error.message, 'error');
      return;
    }

    const organizations = (data ?? []) as { id: string; name: string }[];
    organizationNames.clear();
    for (const org of organizations) organizationNames.set(org.id, org.name);

    affiliationOrg?.replaceChildren(new Option('Select an organization…', ''));
    for (const org of organizations) affiliationOrg?.append(new Option(org.name, org.id));
    if (organizations.length === 1 && affiliationOrg && !affiliationOrg.value) {
      affiliationOrg.value = organizations[0].id;
    }
  }

  async function loadPeople(): Promise<void> {
    const { data, error } = await supabase
      .from('people')
      .select(PERSON_COLUMNS)
      .order('full_name');

    if (error) {
      setMessage(personListEl, '[data-person-message]', error.message, 'error');
      return;
    }

    people = (data ?? []) as unknown as Person[];

    affiliationPerson?.replaceChildren(new Option('Select a person…', ''));
    for (const person of people) affiliationPerson?.append(new Option(person.full_name, person.id));
    if (people.length === 1 && affiliationPerson && !affiliationPerson.value) {
      affiliationPerson.value = people[0].id;
    }

    renderPersonList();
  }

  async function loadAffiliations(): Promise<void> {
    const { data, error } = await supabase
      .from('person_organizations')
      .select('person_id, organization_id, role');

    if (error) {
      setMessage(affiliationListEl, '[data-affiliation-message]', error.message, 'error');
      return;
    }

    affiliations = (data ?? []) as AffiliationRow[];
    renderAffiliationList();
  }

  // --- Person list -------------------------------------------------------

  function personNameById(id: string): string {
    return people.find((person) => person.id === id)?.full_name ?? 'Unknown person';
  }

  function renderPersonList(): void {
    if (people.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No people yet. Add the first one above.';
      personListEl.replaceChildren(empty);
      return;
    }

    personListEl.replaceChildren(
      ...people.map((person) => {
        const row = document.createElement('article');
        row.className = 'org-row';

        const image = personImageUrl(person.image_path);
        if (image) {
          const picture = document.createElement('img');
          picture.className = 'org-row-logo person-row-image';
          picture.src = image;
          picture.alt = '';
          picture.width = 48;
          picture.height = 48;
          row.append(picture);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'org-row-fallback';
          fallback.setAttribute('aria-hidden', 'true');
          fallback.textContent = initials(person.full_name);
          row.append(fallback);
        }

        const info = document.createElement('div');
        info.className = 'org-row-info';
        const name = document.createElement('a');
        name.className = 'org-row-name';
        name.href = personHref(person);
        name.textContent = person.full_name;
        const meta = document.createElement('span');
        meta.className = 'org-row-meta';
        const count = affiliations.filter((affiliation) => affiliation.person_id === person.id).length;
        meta.textContent = `${PERSON_KIND_LABELS[person.kind]} · ${
          PERSON_VISIBILITY_LABELS[person.visibility]
        } · ${count} affiliation${count === 1 ? '' : 's'}`;
        info.append(name, meta);
        row.append(info);

        const actions = document.createElement('div');
        actions.className = 'org-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => startPersonEdit(person));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => void removePerson(person));

        actions.append(edit, remove);
        row.append(actions);

        return row;
      }),
    );
  }

  function resetPersonForm(): void {
    personFormEl.reset();
    if (personId) personId.value = '';
    slugTouched = false;
    editingImagePath = null;
    setPreview(null);
    if (personCancel) personCancel.hidden = true;
    if (personHeading) personHeading.textContent = 'Add a person';
    if (personSubmit) personSubmit.textContent = 'Create person';
  }

  const clearImagePreview = initImagePreview(personImage, personPreview, (message) => {
    setPreview(editingImagePath);
    setMessage(personFormEl, '[data-person-message]', message, 'error');
  });

  function setPreview(path: string | null): void {
    clearImagePreview();
    if (personImageRemove) personImageRemove.hidden = !path;
    if (!personPreview) return;
    const url = personImageUrl(path);
    if (url) {
      personPreview.src = url;
      personPreview.hidden = false;
    } else {
      personPreview.removeAttribute('src');
      personPreview.hidden = true;
    }
  }

  function startPersonEdit(person: Person): void {
    if (!personId) return;
    personId.value = person.id;
    const set = (name: string, value: string | null) => {
      const field = personFormEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`,
      );
      if (field) field.value = value ?? '';
    };
    set('full_name', person.full_name);
    set('slug', person.slug);
    const kind = personFormEl.querySelector<HTMLSelectElement>('select[name="kind"]');
    const visibility = personFormEl.querySelector<HTMLSelectElement>('select[name="visibility"]');
    if (kind) kind.value = person.kind;
    if (visibility) visibility.value = person.visibility;
    set('title', person.title);
    set('description', person.description);
    set('email', person.email);
    set('phone', person.phone);
    set('fax', person.fax);
    set('website_url', person.website_url);
    set('social_url', person.social_url);
    set('address_line', person.address_line);
    set('address_line2', person.address_line2);
    set('city', person.city);
    set('state', person.state);
    set('postal_code', person.postal_code);
    if (personImage) personImage.value = '';
    editingImagePath = person.image_path;
    slugTouched = true;
    setPreview(person.image_path);
    if (personCancel) personCancel.hidden = false;
    if (personHeading) personHeading.textContent = `Editing ${person.full_name}`;
    if (personSubmit) personSubmit.textContent = 'Save changes';
    personFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removePerson(person: Person): Promise<void> {
    if (!window.confirm(`Delete “${person.full_name}”? This cannot be undone.`)) return;

    const { error } = await supabase.from('people').delete().eq('id', person.id);
    if (error) {
      setMessage(personListEl, '[data-person-message]', error.message, 'error');
      return;
    }

    setMessage(personListEl, '[data-person-message]', 'Person deleted.', 'success');
    await loadPeople();
    await loadAffiliations();
  }

  async function savePerson(): Promise<void> {
    const values = new FormData(personFormEl);
    const id = String(values.get('id') ?? '');
    const fullName = String(values.get('full_name') ?? '').trim();
    const slug = String(values.get('slug') ?? '').trim() || slugify(fullName);

    if (!fullName || !slug) {
      setMessage(
        personFormEl,
        '[data-person-message]',
        'A full name (and valid slug) is required.',
        'error',
      );
      return;
    }

    if (personSubmit) personSubmit.disabled = true;
    setMessage(personFormEl, '[data-person-message]', 'Saving…');

    try {
      let imagePath = id ? editingImagePath : null;
      const file = personImage?.files?.[0];

      if (file) {
        imagePath = await uploadProfileImage('person-images', file);
      }

      const payload = {
        slug,
        full_name: fullName,
        kind: kindValue(String(values.get('kind') ?? 'other')),
        visibility: visibilityValue(String(values.get('visibility') ?? 'public')),
        title: textOrNull(values.get('title')),
        description: textOrNull(values.get('description')),
        email: textOrNull(values.get('email')),
        phone: textOrNull(values.get('phone')),
        fax: textOrNull(values.get('fax')),
        website_url: textOrNull(values.get('website_url')),
        social_url: textOrNull(values.get('social_url')),
        address_line: textOrNull(values.get('address_line')),
        address_line2: textOrNull(values.get('address_line2')),
        city: textOrNull(values.get('city')),
        state: textOrNull(values.get('state')),
        postal_code: textOrNull(values.get('postal_code')),
        image_path: imagePath,
      };

      const { error } = id
        ? await supabase.from('people').update(payload).eq('id', id)
        : await supabase.from('people').insert(payload);

      if (error) throw new Error(error.message);

      setMessage(
        personFormEl,
        '[data-person-message]',
        id ? 'Person updated.' : 'Person created.',
        'success',
      );
      resetPersonForm();
      await loadPeople();
    } catch (error) {
      setMessage(
        personFormEl,
        '[data-person-message]',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      if (personSubmit) personSubmit.disabled = false;
    }
  }

  // --- Affiliation list --------------------------------------------------

  function renderAffiliationList(): void {
    const sorted = [...affiliations].sort((a, b) => {
      const person = personNameById(a.person_id).localeCompare(personNameById(b.person_id), undefined, {
        sensitivity: 'base',
      });
      if (person !== 0) return person;
      return (organizationNames.get(a.organization_id) ?? '').localeCompare(
        organizationNames.get(b.organization_id) ?? '',
        undefined,
        { sensitivity: 'base' },
      );
    });

    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No affiliations yet. Link a person to an organization above.';
      affiliationListEl.replaceChildren(empty);
      return;
    }

    affiliationListEl.replaceChildren(
      ...sorted.map((affiliation) => {
        const row = document.createElement('article');
        row.className = 'org-row';

        const info = document.createElement('div');
        info.className = 'org-row-info';
        const name = document.createElement('span');
        name.className = 'org-row-name';
        name.textContent = personNameById(affiliation.person_id);
        const meta = document.createElement('span');
        meta.className = 'org-row-meta';
        meta.textContent = `${affiliation.role} · ${
          organizationNames.get(affiliation.organization_id) ?? 'Unknown organization'
        }`;
        info.append(name, meta);
        row.append(info);

        const actions = document.createElement('div');
        actions.className = 'org-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => startAffiliationEdit(affiliation));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => void removeAffiliation(affiliation));

        actions.append(edit, remove);
        row.append(actions);

        return row;
      }),
    );
  }

  function resetAffiliationForm(): void {
    affiliationFormEl.reset();
    if (affiliationOriginalPerson) affiliationOriginalPerson.value = '';
    if (affiliationOriginalOrg) affiliationOriginalOrg.value = '';
    if (affiliationCancel) affiliationCancel.hidden = true;
    if (affiliationHeading) affiliationHeading.textContent = 'Add an affiliation';
    if (affiliationSubmit) affiliationSubmit.textContent = 'Add affiliation';
    if (people.length === 1 && affiliationPerson) affiliationPerson.value = people[0].id;
    if (organizationNames.size === 1 && affiliationOrg) {
      affiliationOrg.value = [...organizationNames.keys()][0];
    }
  }

  function startAffiliationEdit(affiliation: AffiliationRow): void {
    if (!affiliationOriginalPerson || !affiliationOriginalOrg) return;
    affiliationOriginalPerson.value = affiliation.person_id;
    affiliationOriginalOrg.value = affiliation.organization_id;
    if (affiliationPerson) affiliationPerson.value = affiliation.person_id;
    if (affiliationOrg) affiliationOrg.value = affiliation.organization_id;
    if (affiliationRole) affiliationRole.value = affiliation.role;
    if (affiliationCancel) affiliationCancel.hidden = false;
    if (affiliationHeading) {
      affiliationHeading.textContent = `Editing ${personNameById(affiliation.person_id)}`;
    }
    if (affiliationSubmit) affiliationSubmit.textContent = 'Save affiliation';
    affiliationFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removeAffiliation(affiliation: AffiliationRow): Promise<void> {
    if (!window.confirm(`Remove “${affiliation.role}” at this organization?`)) return;

    const { error } = await supabase
      .from('person_organizations')
      .delete()
      .eq('person_id', affiliation.person_id)
      .eq('organization_id', affiliation.organization_id);

    if (error) {
      setMessage(affiliationListEl, '[data-affiliation-message]', error.message, 'error');
      return;
    }

    setMessage(affiliationListEl, '[data-affiliation-message]', 'Affiliation removed.', 'success');
    await loadAffiliations();
  }

  async function saveAffiliation(): Promise<void> {
    const values = new FormData(affiliationFormEl);
    const personIdValue = String(values.get('person_id') ?? '').trim();
    const organizationId = String(values.get('organization_id') ?? '').trim();
    const role = String(values.get('role') ?? '').trim();
    const originalPerson = String(values.get('original_person_id') ?? '').trim();
    const originalOrg = String(values.get('original_organization_id') ?? '').trim();

    if (!personIdValue || !organizationId || !role) {
      setMessage(
        affiliationFormEl,
        '[data-affiliation-message]',
        'A person, organization, and role are required.',
        'error',
      );
      return;
    }

    if (affiliationSubmit) affiliationSubmit.disabled = true;
    setMessage(affiliationFormEl, '[data-affiliation-message]', 'Saving…');

    try {
      if (originalPerson && originalOrg && (originalPerson !== personIdValue || originalOrg !== organizationId)) {
        const { error: deleteError } = await supabase
          .from('person_organizations')
          .delete()
          .eq('person_id', originalPerson)
          .eq('organization_id', originalOrg);
        if (deleteError) throw new Error(deleteError.message);
      }

      const { error } = await supabase
        .from('person_organizations')
        .upsert(
          { person_id: personIdValue, organization_id: organizationId, role },
          { onConflict: 'person_id,organization_id' },
        );

      if (error) throw new Error(error.message);

      setMessage(
        affiliationFormEl,
        '[data-affiliation-message]',
        originalPerson ? 'Affiliation updated.' : 'Affiliation added.',
        'success',
      );
      resetAffiliationForm();
      await loadAffiliations();
    } catch (error) {
      setMessage(
        affiliationFormEl,
        '[data-affiliation-message]',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      if (affiliationSubmit) affiliationSubmit.disabled = false;
    }
  }

  // --- Wiring ------------------------------------------------------------

  personName?.addEventListener('input', () => {
    if (!personSlug || slugTouched || personId?.value) return;
    personSlug.value = slugify(personName.value);
  });
  personSlug?.addEventListener('input', () => {
    slugTouched = true;
  });

  personFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void savePerson();
  });
  affiliationFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveAffiliation();
  });

  personCancel?.addEventListener('click', resetPersonForm);
  personImage?.addEventListener('change', () => {
    if (personImageRemove) personImageRemove.hidden = !(personImage.files?.length || editingImagePath);
    if (personImage.files?.length) {
      setMessage(personFormEl, '[data-person-message]', 'Image selected. Save the person to update the profile.');
    }
  });
  personImageRemove?.addEventListener('click', () => {
    editingImagePath = null;
    if (personImage) personImage.value = '';
    setPreview(null);
    setMessage(personFormEl, '[data-person-message]', 'Image removed from this draft. Save the person to update the profile.');
  });
  affiliationCancel?.addEventListener('click', resetAffiliationForm);

  if (roleOptions) {
    roleOptions.replaceChildren(...COMMON_ROLES.map((role) => new Option(role, role)));
  }

  await loadOrganizations();
  await loadPeople();
  await loadAffiliations();

  const editId = new URLSearchParams(window.location.search).get('edit');
  const match = editId ? people.find((person) => person.id === editId) : undefined;
  if (match) startPersonEdit(match);
}

import { uploadProfileImage, initImagePreview } from '../lib/media';
import { getSupabase } from '../lib/supabase';
import { organizationLogoUrl } from '../lib/supabase-build';
import type { Organization } from '../lib/organizations';

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

function setMessage(root: ParentNode, text: string, kind: MessageKind = 'info'): void {
  const element = root.querySelector<HTMLElement>('[data-org-message]');
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
  element.hidden = false;
}

export async function initOrganizationAdmin(): Promise<void> {
  const gate = document.querySelector<HTMLElement>('[data-admin-gate]');
  const denied = document.querySelector<HTMLElement>('[data-admin-denied]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const form = document.querySelector<HTMLFormElement>('[data-org-form]');
  const list = document.querySelector<HTMLElement>('[data-org-list]');
  if (!panel || !form || !list) return;

  // Aliases keep the non-null types inside nested functions.
  const formEl = form;
  const listEl = list;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('/signin/?next=/admin/organizations/');
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

  const idField = formEl.querySelector<HTMLInputElement>('input[name="id"]');
  const nameField = formEl.querySelector<HTMLInputElement>('input[name="name"]');
  const slugField = formEl.querySelector<HTMLInputElement>('input[name="slug"]');
  const fileField = formEl.querySelector<HTMLInputElement>('input[name="logo"]');
  const preview = formEl.querySelector<HTMLImageElement>('[data-org-logo-preview]');
  const submitButton = formEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const cancelButton = formEl.querySelector<HTMLButtonElement>('[data-org-cancel]');
  const heading = document.querySelector<HTMLElement>('[data-org-form-title]');

  let slugTouched = false;
  let editingLogoPath: string | null = null;
  let allOrganizations: Organization[] = [];

  slugField?.addEventListener('input', () => {
    slugTouched = true;
  });

  nameField?.addEventListener('input', () => {
    if (!slugField || slugTouched || idField?.value) return;
    slugField.value = slugify(nameField.value);
  });

  const clearImagePreview = initImagePreview(fileField, preview, (message) => {
    setPreview(editingLogoPath);
    setMessage(formEl, message, 'error');
  });

  function setPreview(path: string | null): void {
    clearImagePreview();
    if (!preview) return;
    const url = organizationLogoUrl(path);
    if (url) {
      preview.src = url;
      preview.hidden = false;
    } else {
      preview.removeAttribute('src');
      preview.hidden = true;
    }
  }

  function resetForm(): void {
    formEl.reset();
    if (idField) idField.value = '';
    editingLogoPath = null;
    slugTouched = false;
    setPreview(null);
    if (cancelButton) cancelButton.hidden = true;
    if (heading) heading.textContent = 'Add an organization';
    if (submitButton) submitButton.textContent = 'Create organization';
  }

  function startEdit(org: Organization): void {
    if (!idField) return;
    idField.value = org.id;
    const set = (name: string, value: string | null) => {
      const field = formEl.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (field) field.value = value ?? '';
    };
    set('name', org.name);
    set('slug', org.slug);
    set('description', org.description);
    set('email', org.email);
    set('phone', org.phone);
    set('address_line', org.address_line);
    set('website_url', org.website_url);
    set('social_url', org.social_url);
    if (fileField) fileField.value = '';
    editingLogoPath = org.logo_path;
    slugTouched = true;
    setPreview(org.logo_path);
    if (cancelButton) cancelButton.hidden = false;
    if (heading) heading.textContent = `Editing ${org.name}`;
    if (submitButton) submitButton.textContent = 'Save changes';
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderRow(org: Organization): HTMLElement {
    const row = document.createElement('article');
    row.className = 'org-row';

    const logo = organizationLogoUrl(org.logo_path);
    if (logo) {
      const image = document.createElement('img');
      image.className = 'org-row-logo';
      image.src = logo;
      image.alt = '';
      image.width = 48;
      image.height = 48;
      row.append(image);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'org-row-fallback';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = org.name.slice(0, 1).toUpperCase();
      row.append(fallback);
    }

    const info = document.createElement('div');
    info.className = 'org-row-info';
    const name = document.createElement('a');
    name.className = 'org-row-name';
    name.href = `/orgs/${org.slug}/`;
    name.textContent = org.name;
    const meta = document.createElement('span');
    meta.className = 'org-row-meta';
    meta.textContent = `/orgs/${org.slug}/`;
    info.append(name, meta);
    row.append(info);

    const actions = document.createElement('div');
    actions.className = 'org-row-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => startEdit(org));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button-danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => void removeOrganization(org));

    actions.append(edit, remove);
    row.append(actions);

    return row;
  }

  async function loadOrganizations(): Promise<void> {
    const { data, error } = await supabase
      .from('organizations')
      .select(
        'id, slug, name, description, email, phone, address_line, website_url, social_url, logo_path',
      )
      .order('name');

    if (error) {
      setMessage(listEl, error.message, 'error');
      return;
    }

    const organizations = (data ?? []) as Organization[];
    allOrganizations = organizations;

    if (organizations.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No organizations yet. Add the first one above.';
      listEl.replaceChildren(empty);
      return;
    }

    listEl.replaceChildren(...organizations.map(renderRow));
  }

  async function removeOrganization(org: Organization): Promise<void> {
    if (!window.confirm(`Delete “${org.name}”? This cannot be undone.`)) return;

    const { error } = await supabase.from('organizations').delete().eq('id', org.id);
    if (error) {
      setMessage(listEl, error.message, 'error');
      return;
    }

    setMessage(listEl, 'Organization deleted.', 'success');
    await loadOrganizations();
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void save();
  });

  async function save(): Promise<void> {
    const values = new FormData(formEl);
    const name = String(values.get('name') ?? '').trim();
    const slug = String(values.get('slug') ?? '').trim() || slugify(name);
    const id = String(values.get('id') ?? '');

    if (!name || !slug) {
      setMessage(formEl, 'A name (and valid slug) is required.', 'error');
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setMessage(formEl, 'Saving…');

    try {
      let logoPath = id ? editingLogoPath : null;
      const file = fileField?.files?.[0];

      if (file) {
        logoPath = await uploadProfileImage('org-logos', file);
      }

      const payload = {
        slug,
        name,
        description: textOrNull(values.get('description')),
        email: textOrNull(values.get('email')),
        phone: textOrNull(values.get('phone')),
        address_line: textOrNull(values.get('address_line')),
        website_url: textOrNull(values.get('website_url')),
        social_url: textOrNull(values.get('social_url')),
        logo_path: logoPath,
      };

      const { error } = id
        ? await supabase.from('organizations').update(payload).eq('id', id)
        : await supabase.from('organizations').insert(payload);

      if (error) throw new Error(error.message);

      setMessage(formEl, id ? 'Organization updated.' : 'Organization created.', 'success');
      resetForm();
      await loadOrganizations();
    } catch (error) {
      setMessage(formEl, error instanceof Error ? error.message : String(error), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  cancelButton?.addEventListener('click', resetForm);

  resetForm();
  await loadOrganizations();

  const editId = new URLSearchParams(window.location.search).get('edit');
  const match = editId ? allOrganizations.find((org) => org.id === editId) : undefined;
  if (match) startEdit(match);
}

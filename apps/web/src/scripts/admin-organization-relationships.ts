import type { SupabaseClient } from '@supabase/supabase-js';
import type { Organization } from '../lib/organizations';

interface RelatedOrganization {
  id: string;
  related_organization_id: string;
  related_organization_name: string;
  related_organization_slug: string;
  relationship: string;
  reverse_relationship: string;
  source_url: string | null;
}

export function initOrganizationRelationships(supabase: SupabaseClient, organizations: () => Organization[]) {
  const root = document.querySelector<HTMLElement>('[data-org-relationships]')!;
  const form = root.querySelector<HTMLFormElement>('[data-org-relationship-form]')!;
  const list = root.querySelector<HTMLElement>('[data-org-relationship-list]')!;
  const status = root.querySelector<HTMLElement>('[data-org-relationship-message]')!;
  const select = form.elements.namedItem('related_organization_id') as HTMLSelectElement;
  let current: Organization | null = null;
  let revision = 0;
  let saving = false;

  function message(text: string, error = false) {
    status.textContent = text; status.hidden = false; status.dataset.kind = error ? 'error' : 'info';
  }
  function clear() { form.reset(); (form.elements.namedItem('relationship_id') as HTMLInputElement).value = ''; }
  function field(name: string) { return form.elements.namedItem(name) as HTMLInputElement; }

  async function load() {
    if (!current) return;
    const request = ++revision;
    const { data, error } = await supabase.rpc('get_organization_relationships', { p_organization_id: current.id });
    if (request !== revision) return;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as RelatedOrganization[];
    list.replaceChildren(...rows.map(row => {
      const item = document.createElement('article'); item.className = 'org-row';
      const info = document.createElement('div'); info.className = 'org-row-info';
      const name = document.createElement('a'); name.href = `/orgs/${row.related_organization_slug}/`; name.textContent = row.related_organization_name;
      const label = document.createElement('span'); label.className = 'org-row-meta'; label.textContent = row.relationship;
      info.append(name, label);
      const actions = document.createElement('div'); actions.className = 'org-row-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit relationship';
      edit.addEventListener('click', () => {
        if (saving) return;
        field('relationship_id').value = row.id; select.value = row.related_organization_id;
        field('relationship').value = row.relationship; field('reverse_relationship').value = row.reverse_relationship;
        field('source_url').value = row.source_url ?? '';
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove relationship'; remove.className = 'button-danger';
      remove.addEventListener('click', () => void removeLink(row));
      actions.append(edit, remove); item.append(info, actions); return item;
    }));
    if (!rows.length) list.textContent = 'No related organizations yet.';
  }

  function setSaving(value: boolean) {
    saving = value;
    for (const control of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button')) control.disabled = value;
  }
  async function removeLink(row: RelatedOrganization) {
    if (!current || saving || !window.confirm(`Remove the relationship with “${row.related_organization_name}” from both profiles?`)) return;
    const organizationId = current.id; setSaving(true);
    try {
      const { error } = await supabase.from('organization_relationships').delete().eq('id', row.id);
      if (current?.id !== organizationId) return;
      if (error) throw new Error(error.message);
      clear(); await load(); if (current?.id === organizationId) message('Relationship removed from both profiles. Rebuild the public site to publish.');
    } catch (error) { if (current?.id === organizationId) message(error instanceof Error ? error.message : String(error), true); }
    finally { setSaving(false); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); void save();
  });
  async function save() {
    if (!current || saving || !form.reportValidity()) return;
    const organizationId = current.id;
    const payload = { organization_id: organizationId, related_organization_id: select.value,
      relationship: field('relationship').value.trim(), reverse_relationship: field('reverse_relationship').value.trim(), source_url: field('source_url').value.trim() || null };
    if (!payload.relationship || !payload.reverse_relationship || payload.related_organization_id === organizationId) { message('Choose another organization and enter both labels.', true); return; }
    if (payload.source_url && !/^https?:\/\//.test(payload.source_url)) { message('The source URL must start with https:// or http://.', true); return; }
    const id = field('relationship_id').value; setSaving(true);
    try {
      const { error } = id ? await supabase.from('organization_relationships').update(payload).eq('id', id)
        : await supabase.from('organization_relationships').insert(payload);
      if (current?.id !== organizationId) return;
      if (error) throw new Error(error.message);
      clear(); await load(); if (current?.id === organizationId) message('Relationship saved on both profiles. Rebuild the public site to publish.');
    } catch (error) { if (current?.id === organizationId) message(error instanceof Error ? error.message : String(error), true); }
    finally { setSaving(false); }
  }
  root.querySelector('[data-org-relationship-cancel]')?.addEventListener('click', clear);
  return {
    reset() { current = null; revision++; clear(); list.replaceChildren(); root.hidden = true; status.hidden = true; },
    selectOrganization(org: Organization) {
      current = org; revision++; clear(); list.replaceChildren(); status.hidden = true; root.hidden = false;
      root.querySelector('[data-org-relationships-context]')!.textContent = `Relationships for ${org.name}`;
      select.replaceChildren(...organizations().filter(other => other.id !== org.id).map(other => new Option(other.name, other.id)));
      void load().catch(error => message(error instanceof Error ? error.message : String(error), true));
    },
  };
}

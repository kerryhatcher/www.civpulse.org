import { getSupabase } from '../lib/supabase';
import { personHref } from '../lib/people';
import type { RelatedPerson } from '../lib/person-relationships';

export async function loadPersonRelationships(id: string): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-person-relationships]');
  if (!root) return;
  const list = root.querySelector<HTMLElement>('[data-person-relationship-list]')!;
  const status = root.querySelector<HTMLElement>('[data-person-relationships-status]')!;
  try {
    const { data, error } = await getSupabase().rpc('get_person_relationships', { p_person_id: id });
    if (error) throw error;
    const rows = (data ?? []) as RelatedPerson[];
    const items = rows.map(row => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = personHref({ id: row.related_person_id, slug: row.related_person_slug, visibility: row.related_person_visibility });
      link.textContent = row.related_person_name;
      item.append(link, document.createTextNode(` — ${row.relationship}`));
      if (row.source_url && /^https?:\/\//i.test(row.source_url)) {
        const source = document.createElement('a'); source.href = row.source_url; source.rel = 'noopener noreferrer'; source.textContent = 'Source';
        item.append(document.createTextNode(' · '), source);
      }
      return item;
    });
    list.replaceChildren(...items); status.hidden = true; root.hidden = !rows.length;
  } catch {
    // Keep published evidence on an enhancement failure; never replace it with
    // an empty list or a claim that no relationship exists.
    root.hidden = false; status.hidden = false;
    status.textContent = 'Could not refresh related people. Published links, if any, remain below.';
  }
}
export async function initPersonRelationships(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-person-relationships]');
  if (!root?.dataset.personId) return;
  const { data } = await getSupabase().auth.getSession();
  // Anonymous public pages already contain their build snapshot. Hidden links
  // are fetched only with a signed-in session, never put in static HTML.
  if (data.session) await loadPersonRelationships(root.dataset.personId);
}

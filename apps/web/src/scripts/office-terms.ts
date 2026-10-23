import { historyLink } from '../lib/history';
import { officeLabel, serviceDates, type ProfileOfficeTerm } from '../lib/offices';
import { personHref } from '../lib/people';
import { getSupabase } from '../lib/supabase';

export async function loadOfficeTerms(personId?: string, organizationId?: string): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-office-terms]');
  if (!root) return;
  const status = root.querySelector<HTMLElement>('[data-office-status]')!;
  const groups = root.querySelector<HTMLElement>('[data-office-groups]')!;
  root.hidden = false;
  groups.hidden = true;
  status.hidden = false;
  status.textContent = 'Loading offices…';
  try {
    const supabase = getSupabase();
    await supabase.auth.getSession();
    const { data, error } = await supabase.rpc('get_office_terms', {
      p_person_id: personId ?? null, p_organization_id: organizationId ?? null,
    });
    if (error) throw error;
    const terms = (data ?? []) as ProfileOfficeTerm[];
    for (const group of ['current', 'former', 'upcoming']) {
      const selected = terms.filter(term => term.service_status === group);
      root.querySelector<HTMLElement>(`[data-office-group="${group}"]`)!.hidden = selected.length === 0;
      root.querySelector(`[data-office-list="${group}"]`)!.replaceChildren(...selected.map(term => {
        const item = document.createElement('li');
        const card = document.createElement('div');
        card.className = 'org-card person-candidacy-card';
        const name = document.createElement('h4');
        name.textContent = officeLabel({ name: term.office_name, district: term.district, seat: term.seat });
        const link = document.createElement('a');
        link.textContent = organizationId ? term.person_name : term.organization_name;
        link.href = organizationId ? personHref({ id: term.person_id, slug: term.person_slug, visibility: term.person_visibility }) : `/orgs/${term.organization_slug}/`;
        const dates = document.createElement('span');
        dates.textContent = serviceDates(term).replace('– present', group === 'upcoming' ? '– end not recorded' : '– present');
        const method = document.createElement('span');
        method.textContent = term.selection_method === 'elected' ? 'Elected' : 'Appointed';
        card.append(name, link, dates, method, historyLink('offices', term.office_id), historyLink('office_terms', term.id));
        if (term.source_url) {
          const source = document.createElement('a');
          source.href = term.source_url;
          source.textContent = 'Source';
          source.target = '_blank';
          source.rel = 'noopener noreferrer';
          card.append(source);
        }
        item.append(card);
        return item;
      }));
    }
    root.hidden = terms.length === 0;
    status.hidden = true;
    groups.hidden = false;
  } catch {
    status.textContent = 'Could not load offices. Please reload to try again.';
  }
}
export function initOfficeTerms(): void {
  const root = document.querySelector<HTMLElement>('[data-office-terms]');
  if (root?.dataset.personId || root?.dataset.organizationId) {
    void loadOfficeTerms(root.dataset.personId, root.dataset.organizationId);
  }
}

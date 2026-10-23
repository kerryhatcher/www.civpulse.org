import { getSupabase } from '../lib/supabase';
import { isCurrentUserAdmin } from './auth';

type Account = { id: string; email: string; display_name: string | null; role: 'user' | 'admin' };

export async function initUsersAdmin(): Promise<void> {
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const form = document.querySelector<HTMLFormElement>('[data-user-search]');
  const list = document.querySelector<HTMLElement>('[data-user-list]');
  const status = document.querySelector<HTMLElement>('[data-user-status]');
  const previous = document.querySelector<HTMLButtonElement>('[data-users-previous]');
  const next = document.querySelector<HTMLButtonElement>('[data-users-next]');
  if (!panel || !form || !list || !status || !previous || !next) return;
  const elements = { panel, form, list, status, previous, next };
  const supabase = getSupabase();
  try {
    if (!(await supabase.auth.getSession()).data.session) {
      window.location.replace('/signin/?next=/admin/users/');
      return;
    }
    if (!(await isCurrentUserAdmin())) {
      document.querySelector<HTMLElement>('[data-admin-denied]')!.hidden = false;
      return;
    }
    panel.hidden = false;
  } catch {
    document.querySelector<HTMLElement>('[data-admin-gate]')!.textContent = 'Could not check access. Reload to try again.';
    return;
  } finally {
    if (!panel.hidden || !document.querySelector<HTMLElement>('[data-admin-denied]')?.hidden) {
      document.querySelector('[data-admin-gate]')?.remove();
    }
  }
  let offset = 0;
  let query = '';
  let busy = false;
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    elements.previous.disabled = elements.next.disabled = true;
    elements.form.querySelector<HTMLButtonElement>('button')!.disabled = true;
    elements.list.replaceChildren();
    elements.status.textContent = 'Loading accounts…';
    try {
      const { data, error } = await supabase.rpc('admin_list_users', { p_query: query, p_offset: offset });
      if (error) throw error;
      const accounts = (data ?? []) as Account[];
      elements.status.textContent = accounts.length ? `Showing accounts ${offset + 1}–${offset + accounts.length}.` : 'No accounts found.';
      for (const account of accounts) {
        const row = document.createElement('div');
        row.className = 'org-row';
        const details = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = account.display_name || account.email;
        const email = document.createElement('p');
        email.textContent = account.email;
        const role = document.createElement('p');
        role.textContent = account.role === 'admin' ? 'Admin' : 'User';
        details.append(name, email, role);
        row.append(details);
        if (account.role === 'user') {
          const promote = document.createElement('button');
          promote.type = 'button';
          promote.textContent = 'Make admin';
          promote.setAttribute('aria-label', `Make ${account.email} an admin`);
          promote.addEventListener('click', () => {
            if (!window.confirm(`Make ${account.email} an admin? They will be able to edit all content and promote other users.`)) return;
            promote.disabled = true;
            void (async () => {
              try {
                const { error } = await supabase.rpc('promote_user_to_admin', { p_user_id: account.id });
                if (error) throw error;
                role.textContent = 'Admin';
                promote.remove();
                elements.status.textContent = `${account.email} is now an admin.`;
              } catch {
                elements.status.textContent = 'Could not promote this user. Please try again.';
                promote.disabled = false;
              }
            })();
          });
          row.append(promote);
        }
        elements.list.append(row);
      }
      elements.next.disabled = accounts.length < 50;
    } catch {
      elements.status.textContent = 'Could not load accounts. Search again to retry.';
    } finally {
      elements.previous.disabled = offset === 0;
      elements.form.querySelector<HTMLButtonElement>('button')!.disabled = false;
      busy = false;
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    query = String(new FormData(form).get('query') ?? '').trim();
    offset = 0;
    void load();
  });
  previous.addEventListener('click', () => { if (!busy) { offset = Math.max(0, offset - 50); void load(); } });
  next.addEventListener('click', () => { if (!busy) { offset += 50; void load(); } });
  await load();
}

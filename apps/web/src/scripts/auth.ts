import { getSupabase } from '../lib/supabase';

type MessageKind = 'info' | 'error' | 'success';

function setMessage(root: ParentNode, text: string, kind: MessageKind = 'info'): void {
  const element = root.querySelector<HTMLElement>('[data-auth-message]');
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
  element.hidden = false;
}

function clearMessage(root: ParentNode): void {
  const element = root.querySelector<HTMLElement>('[data-auth-message]');
  if (!element) return;
  element.textContent = '';
  element.hidden = true;
}

function nextPath(fallback = '/'): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

async function withSubmitLock<T>(form: HTMLFormElement, run: () => Promise<T>): Promise<void> {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    await run();
  } finally {
    if (submit) submit.disabled = false;
  }
}

export function initSignIn(): void {
  const form = document.querySelector<HTMLFormElement>('[data-auth-form="signin"]');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');

    if (!email || !password) {
      setMessage(form, 'Enter your email and password.', 'error');
      return;
    }

    clearMessage(form);
    setMessage(form, 'Signing in…');

    void withSubmitLock(form, async () => {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(form, error.message, 'error');
        return;
      }
      window.location.assign(nextPath());
    });
  });
}

export function initSignUp(): void {
  const form = document.querySelector<HTMLFormElement>('[data-auth-form="signup"]');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');
    const displayName = String(values.get('display_name') ?? '').trim();

    if (!email || !password) {
      setMessage(form, 'Enter an email and a password.', 'error');
      return;
    }

    clearMessage(form);
    setMessage(form, 'Creating your account…');

    void withSubmitLock(form, async () => {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: displayName ? { data: { display_name: displayName } } : undefined,
      });

      if (error) {
        setMessage(form, error.message, 'error');
        return;
      }

      if (data.session) {
        window.location.assign(nextPath());
        return;
      }

      form.reset();
      setMessage(form, 'Check your email to confirm your account.', 'success');
    });
  });
}

export async function initAccount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-account]');
  if (!root) return;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('/signin/?next=/account/');
    return;
  }

  setText(root, '[data-account-email]', session.user.email ?? '—');
  setText(root, '[data-account-id]', session.user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', session.user.id)
    .maybeSingle();

  setText(root, '[data-account-name]', profile?.display_name ?? '—');
  root.hidden = false;
  void initConnectedApps(root);

  root
    .querySelector<HTMLButtonElement>('[data-account-signout]')
    ?.addEventListener('click', () => {
      void supabase.auth.signOut().then(() => window.location.assign('/'));
    });
}

async function initConnectedApps(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>('[data-grants-status]');
  const list = root.querySelector<HTMLElement>('[data-grants-list]');
  const retry = root.querySelector<HTMLButtonElement>('[data-grants-retry]');
  if (!status || !list || !retry) return;
  const statusElement = status;
  const listElement = list;
  const retryButton = retry;
  const oauth = getSupabase().auth.oauth;

  async function load(): Promise<void> {
    retryButton.hidden = true;
    listElement.replaceChildren();
    statusElement.textContent = 'Loading connected apps…';
    try {
      const { data, error } = await oauth.listGrants();
      if (error) throw error;
      statusElement.textContent = data?.length ? '' : 'No connected apps.';
      for (const grant of data ?? []) {
        const item = document.createElement('li');
        const name = document.createElement('strong');
        name.textContent = grant.client.name || grant.client.id;
        const scopes = document.createElement('p');
        scopes.textContent = `Requested permissions: ${grant.scopes.join(', ') || 'Account access'}`;
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.textContent = 'Revoke access';
        revoke.setAttribute('aria-label', `Revoke access for ${name.textContent}`);
        revoke.addEventListener('click', () => {
          revoke.disabled = true;
          statusElement.textContent = 'Revoking access…';
          void (async () => {
            try {
              const { error: revokeError } = await oauth.revokeGrant({ clientId: grant.client.id });
              if (revokeError) throw revokeError;
              item.remove();
              statusElement.textContent = listElement.children.length ? 'Access revoked.' : 'Access revoked. No connected apps.';
            } catch {
              statusElement.textContent = 'Could not revoke access. Please try again.';
              revoke.disabled = false;
            }
          })();
        });
        item.append(name, scopes, revoke);
        listElement.append(item);
      }
    } catch {
      statusElement.textContent = 'Could not load connected apps. Please try again.';
      retryButton.hidden = false;
    }
  }

  retryButton.addEventListener('click', () => { void load(); });
  await load();
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return false;

  const { data } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return Boolean(data);
}

export async function initAdminEditLink(
  selector = '[data-org-edit-link], [data-person-edit-link], [data-election-edit-link]',
): Promise<void> {
  const links = document.querySelectorAll<HTMLElement>(selector);
  if (links.length === 0) return;

  if (!(await isCurrentUserAdmin())) return;

  for (const link of links) link.hidden = false;
}

export async function initAuthNav(): Promise<void> {
  const link = document.querySelector<HTMLAnchorElement>('[data-nav-auth]');
  const adminLink = document.querySelector<HTMLAnchorElement>('[data-nav-admin]');
  if (!link) return;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  const path = window.location.pathname.replace(/\/+$/, '');

  link.textContent = 'Account';
  link.href = '/account/';
  if (path === '/account') {
    link.setAttribute('aria-current', 'page');
  }

  if (!adminLink) return;

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!adminRow) return;

  adminLink.hidden = false;
  if (path.startsWith('/admin')) {
    adminLink.setAttribute('aria-current', 'page');
  }
}

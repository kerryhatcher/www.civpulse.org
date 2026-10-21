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

  root
    .querySelector<HTMLButtonElement>('[data-account-signout]')
    ?.addEventListener('click', () => {
      void supabase.auth.signOut().then(() => window.location.assign('/'));
    });
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

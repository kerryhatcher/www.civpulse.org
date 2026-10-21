import { getSupabase } from '../lib/supabase';

interface AuthorizationClient {
  id?: string;
  name?: string;
  uri?: string;
  logo_uri?: string;
}

/**
 * Consent screen for the Supabase OAuth 2.1 server. MCP clients (AI agents)
 * are redirected here with ?authorization_id=… after the user signs in.
 */
export async function initOAuthConsent(): Promise<void> {
  const status = document.querySelector<HTMLElement>('[data-consent-status]');
  const panel = document.querySelector<HTMLElement>('[data-consent-panel]');
  if (!status || !panel) return;

  const setStatus = (text: string): void => {
    status.textContent = text;
    status.hidden = false;
  };

  const authorizationId = new URLSearchParams(window.location.search).get('authorization_id');
  if (!authorizationId) {
    setStatus('This page requires an authorization_id query parameter.');
    return;
  }

  const supabase = getSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const consentPath = `/oauth/consent/?authorization_id=${encodeURIComponent(authorizationId)}`;
    window.location.replace(`/signin/?next=${encodeURIComponent(consentPath)}`);
    return;
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    setStatus(error?.message ?? 'This authorization request is invalid or has expired.');
    return;
  }

  // The user already consented (or the decision was just made): continue.
  if ('redirect_url' in data) {
    window.location.assign(data.redirect_url);
    return;
  }

  const client = (data.client ?? {}) as AuthorizationClient;

  const setText = (selector: string, value: string | undefined): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value ?? '';
  };

  setText('[data-consent-client]', client.name ?? client.id ?? 'An application');
  setText('[data-consent-user]', data.user?.email ?? session.user.email ?? '');
  setText('[data-consent-redirect]', data.redirect_uri);

  const scopes = data.scope ? data.scope.split(/\s+/).filter(Boolean) : [];
  const scopeList = document.querySelector<HTMLElement>('[data-consent-scopes]');
  if (scopeList) {
    scopeList.replaceChildren(
      ...scopes.map((scope) => {
        const item = document.createElement('li');
        item.textContent = scope;
        return item;
      }),
    );
  }

  status.hidden = true;
  panel.hidden = false;

  const approve = document.querySelector<HTMLButtonElement>('[data-consent-approve]');
  const deny = document.querySelector<HTMLButtonElement>('[data-consent-deny]');

  const setBusy = (busy: boolean): void => {
    if (approve) approve.disabled = busy;
    if (deny) deny.disabled = busy;
  };

  approve?.addEventListener('click', async () => {
    setBusy(true);
    setStatus('Completing authorization…');
    // The SDK redirects the browser to the client on success.
    const { error: approveError } = await supabase.auth.oauth.approveAuthorization(authorizationId);
    if (approveError) {
      setStatus(approveError.message);
      setBusy(false);
    }
  });

  deny?.addEventListener('click', async () => {
    setBusy(true);
    setStatus('Denying access…');
    const { error: denyError } = await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (denyError) {
      setStatus(denyError.message);
      setBusy(false);
    }
  });
}

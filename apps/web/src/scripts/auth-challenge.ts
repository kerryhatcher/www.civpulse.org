type Turnstile = {
  render: (container: HTMLElement, options: {
    sitekey: string; action: string; size: 'flexible' | 'compact';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'timeout-callback': () => void;
    'error-callback': () => void;
  }) => string;
  reset: (widgetId: string) => void;
};

declare global { interface Window { turnstile?: Turnstile } }
let loading: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timer = window.setTimeout(() => fail(), 15000);
    function fail(): void {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error('Security check could not load'));
    }
    script.addEventListener('load', () => {
      window.clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    }, { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.append(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

/** Supabase Auth validates this token server-side; the browser never receives a secret. */
export function initAuthChallenge(form: HTMLFormElement): { token: () => string; reset: () => void } {
  const root = form.querySelector<HTMLElement>('[data-auth-challenge]');
  const container = root?.querySelector<HTMLElement>('[data-turnstile-widget]');
  const status = root?.querySelector<HTMLElement>('[data-challenge-status]');
  const retry = root?.querySelector<HTMLButtonElement>('[data-challenge-retry]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  let token = '';
  let api: Turnstile | undefined;
  let widgetId: string | undefined;
  if (submit) submit.disabled = true;
  if (!root || !container || !status || !retry) return { token: () => '', reset: () => {} };
  const elements = { root, container, status, retry };
  function invalidate(message: string): void {
    token = '';
    if (submit) submit.disabled = true;
    elements.status.textContent = message;
    elements.retry.hidden = false;
  }
  async function render(): Promise<void> {
    token = '';
    if (submit) submit.disabled = true;
    elements.retry.hidden = true;
    elements.status.textContent = 'Loading security check…';
    try {
      api = await loadTurnstile();
      if (widgetId !== undefined) { api.reset(widgetId); return; }
      widgetId = api.render(elements.container, {
        sitekey: elements.root.dataset.sitekey!,
        action: elements.root.dataset.action!,
        size: elements.container.getBoundingClientRect().width < 300 ? 'compact' : 'flexible',
        callback: value => {
          token = value;
          if (submit) submit.disabled = !value;
          elements.status.textContent = value ? 'Security check complete.' : 'Complete the security check.';
          elements.retry.hidden = Boolean(value);
        },
        'expired-callback': () => invalidate('Security check expired. Please try again.'),
        'timeout-callback': () => invalidate('Security check timed out. Please try again.'),
        'error-callback': () => invalidate('Could not complete the security check. Please retry.'),
      });
    } catch {
      invalidate('Could not load the security check. Check your connection or content blocker, then retry.');
    }
  }
  retry.addEventListener('click', () => { void render(); });
  void render();
  return {
    token: () => token,
    reset: () => {
      token = '';
      if (submit) submit.disabled = true;
      elements.status.textContent = 'Complete a new security check to try again.';
      if (api && widgetId !== undefined) api.reset(widgetId);
    },
  };
}

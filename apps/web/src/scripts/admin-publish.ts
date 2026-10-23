import { getSupabase } from '../lib/supabase';
import { isCurrentUserAdmin } from './auth';

type Build = { id: string; state: string; createdAt: string | null; finishedAt: string | null };
type PublishStatus = { build: Build | null; dashboardUrl: string; alreadyExists?: boolean };
const activeStates = ['queued', 'initializing', 'running'];
const storageKey = 'civpulse-publish-build';

export async function initPublishAdmin(): Promise<void> {
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const publish = document.querySelector<HTMLButtonElement>('[data-publish]');
  const refresh = document.querySelector<HTMLButtonElement>('[data-publish-refresh]');
  const message = document.querySelector<HTMLElement>('[data-publish-message]');
  const state = document.querySelector<HTMLElement>('[data-build-state]');
  const details = document.querySelector<HTMLElement>('[data-build-details]');
  const dashboard = document.querySelector<HTMLAnchorElement>('[data-build-dashboard]');
  if (!panel || !publish || !refresh || !message || !state || !details || !dashboard) return;
  const ui = { panel, publish, refresh, message, state, details, dashboard };
  let supabase;
  try {
    supabase = getSupabase();
    if (!(await supabase.auth.getSession()).data.session) {
      window.location.replace('/signin/?next=/admin/publish/');
      return;
    }
    if (!(await isCurrentUserAdmin())) {
      document.querySelector<HTMLElement>('[data-admin-denied]')!.hidden = false;
      document.querySelector('[data-admin-gate]')?.remove();
      return;
    }
    panel.hidden = false;
    document.querySelector('[data-admin-gate]')?.remove();
  } catch {
    document.querySelector<HTMLElement>('[data-admin-gate]')!.textContent = 'Could not check access. Reload to try again.';
    return;
  }
  const client = supabase;
  let busy = false;
  let stopped = false;
  let canPublish = false;
  let buildId: string | undefined;
  try { buildId = sessionStorage.getItem(storageKey) || undefined; } catch { /* Storage is optional. */ }
  let timer: ReturnType<typeof setTimeout> | undefined;

  function remember(id?: string): void {
    buildId = id;
    try {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    } catch { /* Private browsing can disable storage. */ }
  }
  function schedule(): void {
    clearTimeout(timer);
    if (!stopped && !document.hidden) timer = setTimeout(() => { void update('status'); }, 10_000);
  }
  function render(result: PublishStatus): void {
    const build = result.build;
    const active = build ? activeStates.includes(build.state) : false;
    const labels: Record<string, string> = {
      queued: 'Queued — waiting for a build slot.',
      initializing: 'Preparing the build.',
      running: 'Building and deploying. Checks must pass before publication.',
      succeeded: 'Published successfully.',
      failed: 'Build failed. The changes were not published. Check the Cloudflare logs before retrying.',
      canceled: 'Build canceled. The changes were not published.',
      skipped: 'Build skipped. This request did not publish a new version.',
      unknown: 'Build outcome is unavailable. Check the Cloudflare logs.',
    };
    ui.state.textContent = build ? labels[build.state] ?? labels.unknown : 'No builds found.';
    ui.details.hidden = !build;
    const setText = (selector: string, text: string) => { ui.details.querySelector<HTMLElement>(selector)!.textContent = text; };
    const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : '—';
    if (build) {
      setText('[data-build-id]', build.id);
      setText('[data-build-created]', date(build.createdAt));
      setText('[data-build-finished]', date(build.finishedAt));
    }
    // The function constructs this URL; additionally restrict browser navigation to Cloudflare.
    const url = new URL(result.dashboardUrl);
    ui.dashboard.hidden = url.origin !== 'https://dash.cloudflare.com';
    if (!ui.dashboard.hidden) ui.dashboard.href = url.href;
    canPublish = !active && (!build || build.state !== 'unknown');
    ui.message.textContent = active
      ? 'A build is in progress. Status updates every 10 seconds. You can leave this page and return later.'
      : canPublish ? 'Ready to publish saved changes. Unsaved edits are not included.'
        : 'Check the build logs and refresh status before publishing.';
    if (active && build) {
      remember(build.id);
      schedule();
    } else {
      remember();
    }
  }

  async function update(action: 'status' | 'publish'): Promise<void> {
    if (busy || stopped) return;
    busy = true;
    clearTimeout(timer);
    ui.publish.disabled = ui.refresh.disabled = true;
    ui.message.textContent = action === 'publish' ? 'Requesting publication…' : 'Checking build status…';
    try {
      const { data, error } = await client.functions.invoke('publish', {
        body: { action, ...(action === 'status' && buildId ? { buildId } : {}) },
        timeout: 60_000,
      });
      if (stopped) return;
      if (error) {
        let text = 'Could not reach the publishing service. Refresh status before trying again.';
        if (error.context instanceof Response) {
          const body = await error.context.json().catch(() => null);
          if (typeof body?.error === 'string') text = body.error;
          if (error.context.status === 404) remember();
          if ([401, 403].includes(error.context.status)) {
            stopped = true;
            ui.panel.hidden = true;
            document.querySelector<HTMLElement>('[data-admin-denied]')!.hidden = false;
          }
        }
        throw new Error(text);
      }
      render(data as PublishStatus);
    } catch (error) {
      if (stopped) return;
      canPublish = false;
      ui.message.textContent = error instanceof Error ? error.message : 'Could not load build status. Refresh status to retry.';
      ui.state.textContent = 'Status unavailable. Publication has not been confirmed.';
      // A failed/ambiguous POST must never be retried automatically. Only poll status.
      if (buildId || action === 'publish') schedule();
    } finally {
      busy = false;
      ui.publish.disabled = stopped || !canPublish;
      ui.refresh.disabled = stopped;
    }
  }
  ui.publish.addEventListener('click', () => { if (canPublish) void update('publish'); });
  ui.refresh.addEventListener('click', () => { void update('status'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else void update('status');
  });
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      stopped = true;
      clearTimeout(timer);
      ui.panel.hidden = true;
      document.querySelector<HTMLElement>('[data-admin-denied]')!.hidden = false;
    }
  });
  window.addEventListener('pagehide', () => { clearTimeout(timer); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) void update('status'); });
  await update('status');
}

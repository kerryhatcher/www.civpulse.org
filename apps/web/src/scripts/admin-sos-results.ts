import type { Election } from '../lib/elections';
import { getSupabase } from '../lib/supabase';

type Health = { status: string; enabled?: boolean; starts_at?: string | null; ends_at?: string | null; poll_interval_seconds?: number; poll_transition_at?: string | null; next_poll_at?: string | null; last_success_at?: string | null; pending_since?: string | null; current_revision?: string | null };
type Settings = { starts: string; ends: string; interval: number; transition: string | null };
const SOURCE = /^https:\/\/results\.sos\.ga\.gov\/cdn\/results\/Georgia\/export-[A-Za-z0-9_-]+\.json$/;

/** UTC only: never interpret an operator's timestamp in the browser's local zone. */
export function utcTimestamp(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || value.startsWith('0000-')) return null;
  const normalized = date.toISOString();
  return normalized === value || normalized.replace('.000Z', 'Z') === value ? normalized : null;
}

/** Initialized only after the existing elections admin session/role gate succeeds. */
export function initSosResultsAdmin(): void {
  const root = document.querySelector<HTMLElement>('[data-sos-admin]');
  if (!root) return;
  const panel = root;
  const select = panel.querySelector<HTMLSelectElement>('[data-sos-election]')!;
  const form = panel.querySelector<HTMLFormElement>('[data-sos-form]')!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const reviewed = field('sos_reviewed') as HTMLInputElement;
  const accepted = field('sos_accepted') as HTMLInputElement;
  const button = (name: string) => panel.querySelector<HTMLButtonElement>(`[data-sos-${name}]`)!;
  const healthText = panel.querySelector<HTMLElement>('[data-sos-health]')!;
  const message = panel.querySelector<HTMLElement>('[data-sos-message]')!;
  const supabase = getSupabase();
  let elections: Election[] = [];
  let health: Health | null = null;
  let prepared = '';
  let busy = false;
  let reading = false;
  let healthRequest = 0;
  let version = 0;
  let operationVersion = 0;
  const election = () => elections.find(row => row.id === select.value);
  function settings(): Settings | null {
    const starts = utcTimestamp(field('sos_starts_at').value.trim());
    const ends = utcTimestamp(field('sos_ends_at').value.trim());
    const rawTransition = field('sos_transition_at').value.trim();
    const transition = rawTransition ? utcTimestamp(rawTransition) : null;
    const interval = Number(field('sos_interval').value);
    if (!starts || !ends || starts >= ends || ![300, 3600].includes(interval) || (rawTransition && !transition) || (transition && (transition < starts || transition >= ends))) return null;
    return { starts, ends, interval, transition };
  }
  function signature(): string {
    const row = election(), values = settings();
    return row && values ? JSON.stringify({ id: row.id, date: row.election_date, visibility: row.visibility, source: row.results_json_url, ...values }) : '';
  }
  function eligible(): boolean {
    const row = election();
    return !!row && row.visibility === 'public' && SOURCE.test(row.results_json_url ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(row.election_date);
  }
  function render(): void {
    const row = election();
    select.disabled = busy;
    for (const input of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')) input.disabled = busy || reading || !row;
    button('refresh').disabled = busy || reading || !row;
    button('save').disabled = busy || reading || health === null || !eligible() || !reviewed.checked || !settings() || health?.enabled === true;
    // Emergency pause does not require a valid source/window: the original RPC
    // must still stop an existing feed after its saved URL or visibility changes.
    button('pause').disabled = busy || !row;
    button('activate').disabled = busy || reading || !eligible() || !reviewed.checked || !accepted.checked || !prepared || prepared !== signature() || health?.enabled !== false || new Date(settings()?.ends ?? 0).getTime() <= Date.now();
    button('retry').disabled = busy || !row;
    button('abandon').disabled = busy || !row;
  }
  function notify(text: string, error = false): void {
    message.hidden = false; message.dataset.kind = error ? 'error' : 'success'; message.textContent = text;
  }
  function clearReview(): void { prepared = ''; reviewed.checked = false; accepted.checked = false; }
  function identity(): void {
    const row = election();
    panel.querySelector<HTMLElement>('[data-sos-identity]')!.hidden = !row;
    panel.querySelector<HTMLElement>('[data-sos-id]')!.textContent = row?.id ?? '';
    panel.querySelector<HTMLElement>('[data-sos-date]')!.textContent = row ? `${row.election_date} · ${row.visibility}` : '';
    panel.querySelector<HTMLElement>('[data-sos-source]')!.textContent = row?.results_json_url || 'No saved SOS URL. Save it with the existing election form first.';
  }
  async function refresh(populate = false): Promise<void> {
    const row = election(), token = version, request = ++healthRequest;
    if (!row) { reading = false; render(); healthText.textContent = 'Select an election to read its collection health.'; return; }
    reading = true; render(); healthText.textContent = 'Reading collection health…';
    const { data, error } = await Promise.resolve(supabase.rpc('get_sos_results_health', { p_election_id: row.id })).catch(() => ({ data: null, error: true }));
    if (token !== version || request !== healthRequest) return;
    reading = false;
    if (error || !data || typeof data !== 'object' || typeof data.status !== 'string') {
      health = null; prepared = ''; healthText.textContent = 'Could not read collection health. Refresh before activating.'; render(); return;
    }
    health = data as Health;
    const cadence = health.poll_interval_seconds ? `${health.poll_interval_seconds / 60} minutes` : 'not configured';
    healthText.textContent = health.status === 'missing'
      ? 'Status: missing. No matching public feed health is available. This does not confirm that an existing configuration is disabled. Pause selected feed can still stop it after a source or visibility change.'
      : `Status: ${health.status}. Feed enabled: ${health.enabled === true ? 'yes' : health.enabled === false ? 'no' : 'not available'}. Current cadence: ${cadence}. Saved window: ${health.starts_at ?? 'not set'} → ${health.ends_at ?? 'not set'}. Transition: ${health.poll_transition_at ?? 'none'}. Next check: ${health.next_poll_at ?? 'none'}. Last successful check: ${health.last_success_at ?? 'none'}. Pending since: ${health.pending_since ?? 'none'}. Revision: ${health.current_revision ?? 'none'}.`;
    if (populate) {
      field('sos_starts_at').value = displayTime(health.starts_at);
      field('sos_ends_at').value = displayTime(health.ends_at);
      field('sos_transition_at').value = displayTime(health.poll_transition_at);
      field('sos_interval').value = health.poll_interval_seconds === 300 ? '300' : '3600';
    }
    const values = settings();
    const effective = values?.transition && Date.parse(values.transition) <= Date.now() ? 300 : values?.interval;
    if (health.enabled || (prepared && (!sameTime(health.starts_at, values?.starts) || !sameTime(health.ends_at, values?.ends) || health.poll_interval_seconds !== effective || (values?.transition ? !sameTime(health.poll_transition_at, values.transition) : health.poll_transition_at != null)))) prepared = '';
    render();
  }
  async function rpc(name: string, args: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (operationVersion !== version) throw Error('Election details changed. Refresh and review before continuing.');
    const { data, error } = await supabase.rpc(name, args);
    if (operationVersion !== version) throw Error('Election details changed. Refresh and review before continuing.');
    if (error) throw Error('The request was rejected. Refresh health and review permissions, source binding, window, and any live job lease.');
    return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
  }
  function displayTime(value: unknown): string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
  }
  function sameTime(a: unknown, b: unknown): boolean {
    return typeof a === 'string' && typeof b === 'string' && Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b);
  }
  async function perform(action: () => Promise<void>): Promise<void> {
    if (busy || !election()) return;
    busy = true; operationVersion = version; render();
    try { await action(); }
    catch (error) { prepared = ''; notify(error instanceof Error ? error.message : 'Could not update collection. Refresh and try again.', true); }
    finally { busy = false; await refresh(); render(); }
  }
  select.addEventListener('change', () => {
    version++; health = null; clearReview(); form.reset(); identity(); render(); void refresh(true);
  });
  form.addEventListener('input', () => { prepared = ''; accepted.checked = false; render(); });
  accepted.addEventListener('input', event => { event.stopPropagation(); render(); });
  form.addEventListener('change', render);
  button('refresh').addEventListener('click', () => { if (!busy) void refresh(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const row = election(), values = settings();
    if (button('save').disabled || !row || !values) return;
    void perform(async () => {
      const paused = await rpc('configure_sos_results_feed', { p_election_id: row.id, p_enabled: false, p_starts_at: values.starts, p_ends_at: values.ends });
      if (paused?.enabled !== false || paused?.election_id !== row.id || paused?.source_url !== row.results_json_url) throw Error('Feed activation was not requested, but the saved feed binding could not be verified. Review the election and refresh health.');
      const cadence = await rpc('configure_sos_results_poll_cadence', { p_election_id: row.id, p_interval_seconds: values.interval, p_transition_at: values.transition, p_after_interval_seconds: 300 });
      if (cadence?.enabled !== false || cadence?.election_id !== row.id || cadence?.poll_interval_seconds !== values.interval || cadence?.poll_after_interval_seconds !== 300 || (values.transition ? !sameTime(cadence?.poll_transition_at, values.transition) : cadence?.poll_transition_at != null)) throw Error('Feed remains paused; saved cadence could not be verified.');
      const window = await rpc('configure_sos_results_feed_window', { p_election_id: row.id, p_starts_at: values.starts, p_ends_at: values.ends });
      if (window?.enabled !== false || window?.election_id !== row.id || window?.source_url !== row.results_json_url || !sameTime(window?.starts_at, values.starts) || !sameTime(window?.ends_at, values.ends)) throw Error('Feed remains paused; the saved polling window could not be verified.');
      prepared = signature(); accepted.checked = false;
      notify('Feed configured and verified while paused. Collection has not started. Complete acceptance before using Activate reviewed feed.');
    });
  });
  button('activate').addEventListener('click', () => {
    const row = election(), values = settings();
    if (button('activate').disabled || !row || !values) return;
    void perform(async () => {
      const saved = await rpc('configure_sos_results_feed', { p_election_id: row.id, p_enabled: true, p_starts_at: values.starts, p_ends_at: values.ends });
      if (saved?.enabled !== true || saved?.election_id !== row.id || saved?.source_url !== row.results_json_url || !sameTime(saved?.starts_at, values.starts) || !sameTime(saved?.ends_at, values.ends)) throw Error('Activation response could not be verified. Refresh health and pause the selected feed if needed.');
      clearReview(); notify('Reviewed feed activated. The coordinator owns polling; inspect collection health and public readback.');
    });
  });
  button('pause').addEventListener('click', () => {
    const row = election(); if (!row || button('pause').disabled) return;
    void perform(async () => {
      const saved = await rpc('configure_sos_results_feed', { p_election_id: row.id, p_enabled: false, p_starts_at: null, p_ends_at: null });
      if (saved?.enabled !== false || saved?.election_id !== row.id) throw Error('Pause response could not be verified. Refresh health and retry.');
      clearReview(); notify('Feed paused. Existing results and evidence remain available; work already in flight may finish.');
    });
  });
  for (const action of ['retry', 'abandon'] as const) button(action).addEventListener('click', () => {
    const row = election(); if (!row || button(action).disabled) return;
    if (action === 'abandon' && !window.confirm(`Abandon only the uncommitted pending job for ${row.name} (${row.id})? This ends the job without deleting evidence. Committed pointers require retry.`)) return;
    void perform(async () => {
      await rpc('recover_sos_results_job', { p_election_id: row.id, p_action: action });
      notify(action === 'retry' ? 'Pending job scheduled for retry with its original receipt.' : 'Uncommitted job abandoned. Evidence was not deleted.');
    });
  });
  document.addEventListener('elections-updated', event => {
    const selected = select.value, prior = election();
    elections = (event as CustomEvent<Election[]>).detail;
    select.replaceChildren(new Option('Select an election…', ''), ...elections.map(row => new Option(`${row.name} · ${row.election_date} · ${row.visibility}`, row.id)));
    select.value = elections.some(row => row.id === selected) ? selected : '';
    const current = election();
    if (!prior || !current || prior.results_json_url !== current.results_json_url || prior.election_date !== current.election_date || prior.visibility !== current.visibility) { version++; health = null; clearReview(); }
    identity(); render(); if (current) void refresh();
  });
  render();
}

import QRCode from 'qrcode';
import { getSupabase } from '../lib/supabase';
import { normalizeTargetUrl, shortLinkUrl } from '../lib/short-links';
import { isCurrentUserAdmin } from './auth';

type Link = { id: string; code: string; title: string; target_url: string; active: boolean; created_at: string; updated_at: string };
type Stats = { redirect_count: number; last_visited_at: string | null };

export async function initLinksAdmin(): Promise<void> {
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const form = document.querySelector<HTMLFormElement>('[data-link-form]');
  if (!panel || !form) return;
  const ui = {
    panel, form,
    message: document.querySelector<HTMLElement>('[data-link-message]')!,
    list: document.querySelector<HTMLElement>('[data-link-list]')!,
    listMessage: document.querySelector<HTMLElement>('[data-list-message]')!,
    details: document.querySelector<HTMLElement>('[data-link-details]')!,
    stats: document.querySelector<HTMLElement>('[data-link-stats]')!,
    url: document.querySelector<HTMLAnchorElement>('[data-short-url]')!,
    qr: document.querySelector<HTMLImageElement>('[data-qr-preview]')!,
    png: document.querySelector<HTMLAnchorElement>('[data-qr-png]')!,
    svg: document.querySelector<HTMLAnchorElement>('[data-qr-svg]')!,
    qrMessage: document.querySelector<HTMLElement>('[data-qr-message]')!,
    previous: document.querySelector<HTMLButtonElement>('[data-previous]')!,
    next: document.querySelector<HTMLButtonElement>('[data-next]')!,
    search: document.querySelector<HTMLFormElement>('[data-link-search]')!,
    save: form.querySelector<HTMLButtonElement>('[type="submit"]')!,
    newLink: document.querySelector<HTMLButtonElement>('[data-new-link]')!,
  };
  const supabase = getSupabase();
  const origin = panel.dataset.shortOrigin || window.location.origin;
  try {
    if (!(await supabase.auth.getSession()).data.session) {
      window.location.replace(`/signin/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!(await isCurrentUserAdmin())) {
      document.querySelector<HTMLElement>('[data-admin-denied]')!.hidden = false;
      document.querySelector('[data-admin-gate]')?.remove();
      return;
    }
    document.querySelector('[data-admin-gate]')?.remove();
    panel.hidden = false;
  } catch {
    document.querySelector<HTMLElement>('[data-admin-gate]')!.textContent = 'Could not check access. Reload to try again.';
    return;
  }
  let selected: Link | null = null;
  let offset = 0;
  let query = '';
  let busy = false;
  let listing = false;
  let revision = 0;
  let svgObjectUrl: string | null = null;
  const field = (name: string) => ui.form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const fail = (error: unknown) => error instanceof Error ? error.message : String((error as { message?: string })?.message || 'Please try again.');
  function selectNew() {
    revision++;
    selected = null;
    ui.form.reset(); field('id').value = '';
    ui.details.hidden = true; ui.newLink.hidden = true;
    ui.message.textContent = '';
    ui.form.querySelector('[data-form-heading]')!.textContent = 'Create a short link';
    history.replaceState(null, '', window.location.pathname);
    if (svgObjectUrl) { URL.revokeObjectURL(svgObjectUrl); svgObjectUrl = null; }
  }
  async function refreshStats(linkId: string, currentRevision: number) {
    ui.stats.textContent = 'Loading usage…';
    const { data, error } = await supabase.from('short_link_stats').select('redirect_count,last_visited_at').eq('link_id', linkId).maybeSingle();
    if (currentRevision !== revision) return;
    if (error) { ui.stats.textContent = 'Could not load usage. Select Refresh usage to retry.'; return; }
    const stats = data as Stats | null;
    ui.stats.textContent = `${Number(stats?.redirect_count ?? 0).toLocaleString()} redirects · Last visit: ${stats?.last_visited_at ? new Date(stats.last_visited_at).toLocaleString() : 'Never'}`;
  }
  async function edit(link: Link) {
    const currentRevision = ++revision;
    selected = link;
    for (const key of ['id', 'title', 'target_url', 'active'] as const) field(key).value = String(link[key]);
    ui.form.querySelector('[data-form-heading]')!.textContent = 'Edit short link';
    ui.newLink.hidden = false; ui.details.hidden = false;
    const url = shortLinkUrl(origin, link.code);
    ui.url.href = url; ui.url.textContent = url;
    history.replaceState(null, '', `${window.location.pathname}?id=${encodeURIComponent(link.id)}`);
    ui.qr.hidden = ui.png.hidden = ui.svg.hidden = true;
    ui.png.removeAttribute('href'); ui.svg.removeAttribute('href');
    if (svgObjectUrl) { URL.revokeObjectURL(svgObjectUrl); svgObjectUrl = null; }
    ui.qrMessage.textContent = 'Preparing QR downloads…';
    void refreshStats(link.id, currentRevision);
    try {
      const options = { errorCorrectionLevel: 'M' as const, margin: 4, width: 1024 };
      const [png, svg] = await Promise.all([QRCode.toDataURL(url, options), QRCode.toString(url, { ...options, type: 'svg' })]);
      if (currentRevision !== revision) return;
      svgObjectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      ui.qr.src = png; ui.png.href = png; ui.svg.href = svgObjectUrl;
      ui.png.download = `civpulse-${link.code}.png`; ui.svg.download = `civpulse-${link.code}.svg`;
      ui.qr.hidden = ui.png.hidden = ui.svg.hidden = false;
      ui.qrMessage.textContent = 'Both QR downloads contain the short URL above and stay valid after destination edits.';
    } catch { if (currentRevision === revision) ui.qrMessage.textContent = 'Could not generate QR downloads. Open this link again to retry.'; }
  }
  async function load() {
    if (listing) return;
    listing = true; ui.previous.disabled = ui.next.disabled = true;
    ui.list.replaceChildren(); ui.listMessage.textContent = 'Loading short links…';
    try {
      let request = supabase.from('short_links').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 49);
      if (query) {
        const pattern = `"%${query.replace(/[\\"%_]/g, char => `\\${char}`)}%"`;
        request = request.or(`title.ilike.${pattern},code.ilike.${pattern},target_url.ilike.${pattern}`);
      }
      const { data, error } = await request;
      if (error) throw error;
      const links = (data ?? []) as Link[];
      ui.listMessage.textContent = links.length ? `Showing links ${offset + 1}–${offset + links.length}.` : 'No short links found.';
      for (const link of links) {
        const row = document.createElement('article'); row.className = 'org-row';
        const info = document.createElement('div'); info.className = 'org-row-info';
        const title = document.createElement('strong'); title.textContent = link.title;
        const meta = document.createElement('p'); meta.textContent = `/l/${link.code} · ${link.active ? 'Active' : 'Paused'}`;
        const target = document.createElement('p'); target.textContent = link.target_url;
        info.append(title, meta, target);
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Edit & QR';
        button.setAttribute('aria-label', `Edit ${link.title} and download QR code`);
        button.addEventListener('click', () => { if (!busy) { ui.message.textContent = ''; void edit(link); ui.form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
        row.append(info, button); ui.list.append(row);
      }
      ui.next.disabled = links.length < 50;
    } catch (error) { ui.listMessage.textContent = `Could not load short links: ${fail(error)} Search again to retry.`; }
    finally { ui.previous.disabled = offset === 0; listing = false; }
  }
  ui.form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    let target: string;
    try { target = normalizeTargetUrl(field('target_url').value); }
    catch (error) { ui.message.textContent = fail(error); return; }
    busy = true; ui.save.disabled = ui.newLink.disabled = true;
    ui.message.textContent = 'Saving…';
    try {
      const { data, error } = await supabase.rpc('save_short_link', { p_id: field('id').value || null, p_title: field('title').value.trim(), p_target_url: target, p_active: field('active').value === 'true' });
      if (error) throw error;
      const link = data as Link;
      await edit(link);
      ui.message.textContent = link.active ? 'Saved. This short link is active immediately.' : 'Saved. This short link is paused; its URL and QR code are reserved.';
      offset = 0; await load();
    } catch (error) { ui.message.textContent = `Could not save: ${fail(error)}`; }
    finally { busy = false; ui.save.disabled = ui.newLink.disabled = false; }
  });
  ui.newLink.addEventListener('click', () => { if (!busy) selectNew(); });
  ui.search.addEventListener('submit', event => { event.preventDefault(); if (!listing) { query = String(new FormData(ui.search).get('query') ?? '').trim(); offset = 0; void load(); } });
  ui.previous.addEventListener('click', () => { if (!listing) { offset = Math.max(0, offset - 50); void load(); } });
  ui.next.addEventListener('click', () => { if (!listing) { offset += 50; void load(); } });
  document.querySelector('[data-refresh-stats]')!.addEventListener('click', () => { if (selected) void refreshStats(selected.id, revision); });
  document.querySelector('[data-copy-link]')!.addEventListener('click', async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(shortLinkUrl(origin, selected.code)); ui.message.textContent = 'Short URL copied.'; }
    catch { ui.message.textContent = 'Could not copy automatically. Select and copy the short URL above.'; }
  });
  await load();
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) { ui.message.textContent = 'Invalid short link record URL.'; return; }
    const { data, error } = await supabase.from('short_links').select('*').eq('id', id).maybeSingle();
    if (error || !data) ui.message.textContent = 'Could not find this short link. Select one from the list or create a new link.';
    else await edit(data as Link);
  }
}

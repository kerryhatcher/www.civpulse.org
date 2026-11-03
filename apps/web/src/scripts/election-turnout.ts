import { getSupabase } from '../lib/supabase';
import { readTurnoutSnapshot, turnoutByCounty, type TurnoutCell, type TurnoutPage, type TurnoutRow } from '../lib/election-turnout';
import { selectedCounty } from './county-filter';

const measureLabels: Record<string, string> = {
  requested: 'Requested', issued: 'Issued', returned: 'Returned', accepted: 'Accepted',
  rejected: 'Rejected', spoiled_canceled: 'Spoiled / canceled', outstanding: 'Outstanding',
};
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const stamp = (value: string) => new Date(value).toLocaleString('en-US', {
  timeZone: 'America/New_York', timeZoneName: 'short',
});

function chart(title: string, rows: TurnoutRow[], values: { label: string; cell: TurnoutCell | undefined }[]) {
  const figure = el('figure');
  figure.dataset.table = rows[0].table;
  figure.append(el('figcaption', title));
  const max = Math.max(0, ...values.map(({ cell }) => cell?.value ?? 0));
  figure.append(el('p', `Ballots · scale 0–${max.toLocaleString('en-US')}`, 'body-note'));
  const list = el('ol');
  for (const { label, cell } of values) {
    const item = el('li');
    const heading = el('div', undefined, 'turnout-bar-label');
    heading.append(el('span', label), el('strong', cell?.value == null ? 'Not reported' : cell.value.toLocaleString('en-US')));
    item.append(heading);
    if (cell?.value != null) {
      const track = el('div', undefined, 'turnout-track');
      track.setAttribute('aria-hidden', 'true');
      const bar = el('div', undefined, 'turnout-bar');
      bar.style.width = `${max > 0 ? 100 * cell.value / max : 0}%`;
      track.append(bar);
      item.append(track);
    }
    list.append(item);
  }
  figure.append(list);
  for (const row of rows.filter((row, i) => rows.findIndex(r => r.source_title === row.source_title && r.as_of_label === row.as_of_label) === i)) {
    if (row.as_of_label) figure.append(el('p', `${row.source_title} · ${row.as_of_label}`, 'body-note'));
  }
  return figure;
}

let stopPolling: (() => void) | undefined;

export async function initElectionTurnout(electionId: string): Promise<void> {
  stopPolling?.();
  const section = document.querySelector<HTMLElement>('[data-election-turnout]');
  if (!section) return;
  const status = section.querySelector<HTMLElement>('[data-turnout-status]')!;
  const body = section.querySelector<HTMLElement>('[data-turnout-body]')!;
  const charts = section.querySelector<HTMLElement>('[data-turnout-charts]')!;
  const source = section.querySelector<HTMLElement>('[data-turnout-source]')!;
  const retry = section.querySelector<HTMLButtonElement>('[data-turnout-retry]')!;
  const reports = section.querySelector<HTMLAnchorElement>('[data-turnout-reports]')!;
  reports.href = `/elections/results/?id=${encodeURIComponent(electionId)}`;
  let snapshot: TurnoutPage | undefined;
  let stopped = false;
  let loading = false;
  let fingerprint = "";
  function render() {
    if (!snapshot) return;

    charts.replaceChildren();
    for (const group of turnoutByCounty(snapshot.rows, selectedCounty())) {
      const county = el('section');
      county.dataset.turnoutCountyGroup = group.id;
      county.append(el('h3', `${group.label} County`));
      const grid = el('div', undefined, 'turnout-charts');
      const rows = group.rows;
      const turnout = rows.filter(row => row.table === 'turnout');
      const early = rows.filter(row => row.table === 'early');
      if (turnout.length) grid.append(chart('Reported turnout by ballot style', turnout, turnout.map(row => ({ label: row.ballot_style, cell: row.measures.turnout }))));
      if (early.length) grid.append(chart('Early voting ballots accepted', early, early.map(row => ({ label: row.ballot_style, cell: row.measures.accepted }))));
      for (const row of rows.filter(row => row.table === 'absentee')) {
        const figure = chart(`Absentee ballots · ${row.ballot_style}`, [row], Object.entries(measureLabels).map(([key, label]) => ({ label, cell: row.measures[key] })));
        const ratio = row.measures.acceptance_ratio;
        if (ratio) figure.append(el('p', `Accepted / returned: ${ratio.value == null ? 'Not reported' : ratio.display}`, 'body-note'));
        grid.append(figure);
      }
      if (!grid.childElementCount) grid.append(el('p', 'No chartable turnout measures reported for this county. View all reports for details.'));
      county.append(grid);
      charts.append(county);
    }
    if (!charts.childElementCount) charts.append(el('p', 'No turnout is reported for the county selected in the header. Choose another county or All counties to explore available reports.'));
  }
  async function load(background = false) {
    if (stopped || loading) return;
    loading = true;
    retry.hidden = true;
    if (!background) {
      body.hidden = true;
      status.hidden = false;
      status.textContent = 'Loading turnout…';
    }

    try {
      const incoming = await readTurnoutSnapshot(async (reportId, offset) => {
        const { data, error } = await getSupabase().rpc('get_structured_turnout', {
          p_election_id: electionId, p_report_id: reportId, p_offset: offset, p_limit: 100,
        });
        if (error) throw error;
        return data as TurnoutPage;
      });
      if (stopped) return;
      const nextFingerprint = JSON.stringify(incoming);
      if (background && nextFingerprint === fingerprint) {
        status.hidden = true;
        return;
      }
      snapshot = incoming;
      fingerprint = nextFingerprint;
      if (snapshot.status !== 'ok' || !snapshot.rows.length) {

        section!.hidden = true;
        status.textContent = 'No structured turnout has been published for this election yet.';
        return;
      }
      render();
      source.replaceChildren(el('span', `Collected ${stamp(snapshot.report.captured_at)}. `));
      const link = el('a', 'Georgia Secretary of State source');
      const url = new URL(snapshot.report.source_url);
      if (url.protocol === 'https:') { link.href = url.href; source.append(link); }
      status.hidden = true;
      body.hidden = false;
      section!.hidden = false;
    } catch {
      if (stopped) return;
      section!.hidden = false;
      status.hidden = false;
      status.textContent = background && snapshot?.status === 'ok'
        ? 'Turnout updates are temporarily unavailable. Showing the last loaded report.'
        : 'Turnout could not be loaded. Try again.';

      retry.hidden = false;
    } finally {
      loading = false;
    }
  }
  retry.onclick = () => { void load(snapshot?.status === 'ok'); };
  window.addEventListener('countychange', render);
  const refresh = () => {
    if (!document.hidden && navigator.onLine) void load(true);
  };
  const timer = setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('online', refresh);
  stopPolling = () => {
    stopped = true;
    clearInterval(timer);
    retry.onclick = null;
    window.removeEventListener('countychange', render);
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('online', refresh);
  };
  await load();
}

import { getSupabase } from '../lib/supabase';
import { readTurnoutSnapshot, type TurnoutCell, type TurnoutPage, type TurnoutRow } from '../lib/election-turnout';

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
    figure.append(el('p', `${row.source_title} · ${row.as_of_label || 'Source as-of time not reported'}`, 'body-note'));
  }
  return figure;
}

export async function initElectionTurnout(electionId: string): Promise<void> {
  const section = document.querySelector<HTMLElement>('[data-election-turnout]');
  if (!section) return;
  const status = section.querySelector<HTMLElement>('[data-turnout-status]')!;
  const body = section.querySelector<HTMLElement>('[data-turnout-body]')!;
  const county = section.querySelector<HTMLSelectElement>('[data-turnout-county]')!;
  const charts = section.querySelector<HTMLElement>('[data-turnout-charts]')!;
  const source = section.querySelector<HTMLElement>('[data-turnout-source]')!;
  const retry = section.querySelector<HTMLButtonElement>('[data-turnout-retry]')!;
  const reports = section.querySelector<HTMLAnchorElement>('[data-turnout-reports]')!;
  reports.href = `/elections/results/?id=${encodeURIComponent(electionId)}`;
  async function load() {
    retry.hidden = true;
    body.hidden = true;
    status.hidden = false;
    status.textContent = 'Loading turnout…';
    try {
      const snapshot = await readTurnoutSnapshot(async (reportId, offset) => {
        const { data, error } = await getSupabase().rpc('get_structured_turnout', {
          p_election_id: electionId, p_report_id: reportId, p_offset: offset, p_limit: 100,
        });
        if (error) throw error;
        return data as TurnoutPage;
      });
      if (snapshot.status !== 'ok' || !snapshot.rows.length) {
        section!.hidden = true;
        return;
      }
      const counties = [...new Map(snapshot.rows.map(row => [row.county_fips, row.county_label])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1]));
      county.replaceChildren(...counties.map(([id, label]) => {
        const option = el('option', label);
        option.value = id;
        return option;
      }));
      county.value = counties.some(([id]) => id === '13021') ? '13021' : counties[0][0];
      function render() {
        const rows = snapshot.rows.filter(row => row.county_fips === county.value);
        charts.replaceChildren();
        const turnout = rows.filter(row => row.table === 'turnout');
        const early = rows.filter(row => row.table === 'early');
        if (turnout.length) charts.append(chart('Reported turnout by ballot style', turnout, turnout.map(row => ({ label: row.ballot_style, cell: row.measures.turnout }))));
        if (early.length) charts.append(chart('Early voting ballots accepted', early, early.map(row => ({ label: row.ballot_style, cell: row.measures.accepted }))));
        for (const row of rows.filter(row => row.table === 'absentee')) {
          const figure = chart(`Absentee ballots · ${row.ballot_style}`, [row], Object.entries(measureLabels).map(([key, label]) => ({ label, cell: row.measures[key] })));
          const ratio = row.measures.acceptance_ratio;
          if (ratio) figure.append(el('p', `Accepted / returned: ${ratio.value == null ? 'Not reported' : ratio.display}`, 'body-note'));
          charts.append(figure);
        }
        if (!charts.childElementCount) charts.append(el('p', 'No chartable turnout measures reported for this county. View all reports for details.'));
      }
      county.onchange = render;
      render();
      source.replaceChildren(el('span', `Collected ${stamp(snapshot.report.captured_at)}. `));
      const link = el('a', 'Georgia Secretary of State source');
      const url = new URL(snapshot.report.source_url);
      if (url.protocol === 'https:') { link.href = url.href; source.append(link); }
      status.hidden = true;
      body.hidden = false;
      section!.hidden = false;
    } catch {
      section!.hidden = false;
      status.textContent = 'Turnout could not be loaded. Try again.';
      retry.hidden = false;
    }
  }
  retry.onclick = () => { void load(); };
  await load();
}

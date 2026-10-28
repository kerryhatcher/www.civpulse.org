import { readElectionReports } from '../lib/election-report-reader';
import { precinctTurnout, turnoutRate, turnoutFill } from '../lib/precinct-turnout';
import type * as Leaflet from 'leaflet';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text: string) {
  const node = document.createElement(tag); node.textContent = text; return node;
}
const number = (value: number | null | undefined) => value == null ? 'Not reported' : value.toLocaleString('en-US');
export async function initElectionPrecinctTurnout(electionId: string): Promise<void> {
  const section = document.querySelector<HTMLElement>('[data-precinct-turnout]');
  if (!section) return;
  const status = section.querySelector<HTMLElement>('[data-precinct-status]')!;
  const body = section.querySelector<HTMLElement>('[data-precinct-body]')!;
  const canvas = section.querySelector<HTMLElement>('[data-precinct-map]')!;
  const styles = section.querySelector<HTMLSelectElement>('[data-precinct-style]')!;
  const table = section.querySelector<HTMLElement>('[data-precinct-rows]')!;
  const retry = section.querySelector<HTMLButtonElement>('[data-precinct-retry]')!;
  let map: Leaflet.Map | undefined;
  let resize: ResizeObserver | undefined;
  let generation = 0;
  async function load(refresh = false) {
    const request = ++generation;
    section!.hidden = false;
    retry.hidden = true;
    body.hidden = true;
    status.textContent = 'Loading precinct turnout…';
    try {
      const url = section!.dataset.boundariesUrl;
      if (!url) { status.textContent = 'Public precinct boundaries are not available for this map.'; return; }
      const reports = await readElectionReports(electionId, refresh);
      if (request !== generation) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Precinct boundaries unavailable');
      const geometry = await response.json() as GeoJSON.FeatureCollection;
      if (request !== generation) return;
      if (!geometry.features?.length || geometry.features.some(f => f.properties?.county !== 'Bibb' || !f.properties?.precinctid)) throw new Error('Unexpected precinct boundaries');
      geometry.features.sort((a, b) => String(a.properties!.precinctid).localeCompare(String(b.properties!.precinctid), 'en', { numeric: true }));
      const { default: L } = await import('leaflet');
      if (request !== generation) return;
      const choices = [...new Set(reports.filter(r => r.scope.county === 'Bibb' && r.scope.unit_type === 'precinct' && r.scope.counting_group === 'all').map(r => r.scope.ballot_style))].sort();
      if (!choices.length) choices.push('all');
      styles.replaceChildren(...choices.map(value => { const option = el('option', value === 'all' ? 'All ballot styles' : value); option.value = value; return option; }));
      styles.value = choices.includes('all') ? 'all' : choices[0];
      styles.disabled = choices.length < 2;
      resize?.disconnect();
      map?.remove();
      body.hidden = false;
      map = L.map(canvas, { zoomSnap: 0.25, scrollWheelZoom: false, zoomAnimation: !matchMedia('(prefers-reduced-motion: reduce)').matches });
      // Plain county map keeps the percentage fill readable and needs no tile requests.
      map.attributionControl.addAttribution('Macon-Bibb County Government IT GIS');
      let polygons: Leaflet.GeoJSON | undefined;
      resize = new ResizeObserver(() => {
        if (!canvas.clientWidth || !canvas.clientHeight) return;
        map?.invalidateSize({ pan: false });
        if (polygons) map?.fitBounds(polygons.getBounds(), { padding: [12, 12], animate: false });
      });
      resize.observe(canvas);
      function render() {
        const selected = precinctTurnout(reports, styles.value);
        polygons?.remove();
        table.replaceChildren();
        let available = 0;
        const mapped = new Set<string>();
        polygons = L.geoJSON(geometry, {
          style: feature => ({ color: '#4c6159', weight: 1, ...turnoutFill(turnoutRate(selected.get(String(feature?.properties?.precinctid)))) }),
          onEachFeature: (feature, layer) => {
            const code = String(feature.properties!.precinctid);
            const label = `${code} · ${String(feature.properties!.name)}`;
            const report = selected.get(code);
            const rate = turnoutRate(report);
            if (rate !== null) available++;
            mapped.add(code);
            const counts = report?.snapshot.turnout;
            const basis = counts?.voters != null ? 'voters' : 'ballots';
            const percent = rate === null ? 'Not reported' : `${rate.toFixed(2)}%`;
            const reportLabel = report ? `${report.snapshot.status} · ${new Date(report.observed_at).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}` : 'No precinct report';
            const popup = el('div', '');
            popup.append(el('strong', label), el('p', `Turnout: ${percent}`), el('p', `${number(counts?.voters ?? counts?.ballots)} ${basis} / ${number(counts?.registered)} registered`), el('p', reportLabel));
            layer.bindPopup(popup);
            layer.bindTooltip(el('span', `${label}: ${percent}`));
            const row = el('tr', ''); const heading = el('th', ''); heading.scope = 'row';
            const button = el('button', label); button.type = 'button';
            button.onclick = () => { map!.fitBounds((layer as Leaflet.Polygon).getBounds(), { maxZoom: 13, animate: false }); layer.openPopup(); };
            heading.append(button);
            row.append(heading, el('td', `${number(counts?.voters ?? counts?.ballots)} ${basis}`), el('td', number(counts?.registered)), el('td', percent), el('td', reportLabel)); table.append(row);
          },
        }).addTo(map!);
        map!.fitBounds(polygons.getBounds(), { padding: [12, 12], animate: false });
        const unmatched = [...selected.keys()].filter(code => !mapped.has(code));
        status.textContent = `${available} of ${geometry.features.length} precincts have a reported turnout percentage.${available ? '' : ' Precinct-level participation and registered-voter counts are required; county totals cannot supply these percentages.'}${unmatched.length ? ` ${unmatched.length} reported precincts could not be matched to these boundaries.` : ''}`;
      }
      styles.onchange = render;
      render();
    } catch {
      if (request !== generation) return;
      resize?.disconnect();
      map?.remove(); map = undefined;
      body.hidden = true;
      status.textContent = 'Precinct turnout could not be loaded. Try again.';
      retry.hidden = false;
    }
  }
  retry.onclick = () => { void load(true); };
  window.addEventListener('electionreportschange', event => {
    if ((event as CustomEvent<{electionId:string}>).detail?.electionId === electionId) void load();
  });
  await load();
}

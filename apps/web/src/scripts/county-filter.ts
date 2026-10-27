import { COUNTY_SESSION_KEY, DEFAULT_COUNTY, normalizeCounty, matchesCounty, type CountyIndex } from '../lib/county-scope';

let memoryCounty: string | undefined;
export function selectedCounty(): string {
  if (memoryCounty) return memoryCounty;
  try { return normalizeCounty(sessionStorage.getItem(COUNTY_SESSION_KEY)); }
  catch { return DEFAULT_COUNTY; }
}
let indexRequest: Promise<CountyIndex> | undefined;
export function readCountyIndex(): Promise<CountyIndex> {
  return indexRequest ??= fetch('/county-data.json').then(async response => {
    if (!response.ok) throw new Error('County filters could not load. Please reload to try again.');
    return response.json();
  });
}
export async function filterCounty<T extends { id: string }>(rows: T[], kind: string): Promise<T[]> {
  if (selectedCounty() === 'all') return rows;
  const index = await readCountyIndex();
  return rows.filter(row => matchesCounty(index, kind, row.id, selectedCounty()));
}

/** Filter before paginating so an out-of-county page cannot hide later matches. */
export async function countySearchPage<T extends { id: string }>(
  read: (offset: number) => Promise<T[]>, kind: string, offset: number, size: number, batchSize = 100,
  predicate?: (row: T) => boolean,
): Promise<T[]> {
  const matched: T[] = [];
  for (let cursor = 0; ; cursor += batchSize) {
    const rows = await read(cursor);
    matched.push(...(predicate ? rows.filter(predicate) : await filterCounty(rows, kind)));
    if (matched.length >= offset + size || rows.length < batchSize) return matched.slice(offset, offset + size);
  }
}
export function initCountyFilter(): void {
  const select = document.querySelector<HTMLSelectElement>('[data-county-filter]');
  if (!select) return;
  select.value = selectedCounty();
  select.addEventListener('change', () => {
    memoryCounty = normalizeCounty(select.value);
    try { sessionStorage.setItem(COUNTY_SESSION_KEY, memoryCounty); } catch { /* Keep the selection in memory when storage is disabled. */ }
    window.dispatchEvent(new Event('countychange'));
  });
  async function apply(): Promise<void> {
    try {
      const index = await readCountyIndex();
      document.querySelectorAll<HTMLElement>('[data-county-kind][data-county-id]').forEach(element => {
        element.hidden = !matchesCounty(index, element.dataset.countyKind!, element.dataset.countyId!, selectedCounty());
      });
      const list = document.querySelector<HTMLElement>('[data-county-list]');
      const empty = document.querySelector<HTMLElement>('[data-county-list-empty]');
      if (list && empty) empty.hidden = [...list.children].some(child => !(child as HTMLElement).hidden);
      const status = document.querySelector<HTMLElement>('[data-county-status]');
      if (status) status.textContent = selectedCounty() === 'all' ? 'Showing all counties.'
        : `County filter: ${select!.selectedOptions[0].textContent}. Statewide records and records without county coverage are included.`;
    } catch (error) {
      const status = document.querySelector<HTMLElement>('[data-county-status]');
      if (status) status.textContent = error instanceof Error ? error.message : 'County filters could not load.';
    }
  }
  window.addEventListener('countychange', () => void apply());
  void apply();
}

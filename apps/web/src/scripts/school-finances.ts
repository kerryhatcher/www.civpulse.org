import { getSupabase } from '../lib/supabase';
import { financePageCsv, formatFinanceMoney, type FinanceDataset, type SchoolFinanceResult } from '../lib/school-finances';

export async function initSchoolFinances() {
  const form = document.querySelector<HTMLFormElement>('[data-finance-form]');
  if (!form) return;
  const status = document.querySelector<HTMLElement>('[data-finance-status]')!;
  const explanation = document.querySelector<HTMLElement>('[data-finance-explanation]')!;
  const summary = document.querySelector<HTMLElement>('[data-finance-summary]')!;
  const totals = document.querySelector<HTMLElement>('[data-finance-totals]')!;
  const period = document.querySelector<HTMLElement>('[data-finance-period]')!;
  const table = document.querySelector<HTMLTableElement>('[data-finance-table]')!;
  const previous = document.querySelector<HTMLButtonElement>('[data-finance-previous]')!;
  const next = document.querySelector<HTMLButtonElement>('[data-finance-next]')!;
  const download = document.querySelector<HTMLButtonElement>('[data-finance-download]')!;
  const source = document.querySelector<HTMLDetailsElement>('[data-finance-source]')!;
  const provenance = document.querySelector<HTMLElement>('[data-finance-provenance]')!;
  const dataset = form.elements.namedItem('dataset') as HTMLSelectElement;
  const year = form.elements.namedItem('year') as HTMLSelectElement;
  const query = form.elements.namedItem('q') as HTMLInputElement;
  const sort = form.elements.namedItem('sort') as HTMLSelectElement;
  const params = new URLSearchParams(location.search);
  dataset.value = params.get('dataset') === 'payroll' ? 'payroll' : 'payments';
  query.value = (params.get('q') ?? '').slice(0, 200);
  sort.value = params.get('sort') === 'name' ? 'name' : 'amount';
  const requestedYear = params.get('year');
  let personId = /^[a-f0-9-]{36}$/i.test(params.get('person') ?? '') ? params.get('person') : null;
  const personScope = document.querySelector<HTMLElement>('[data-finance-person-scope]')!;
  if (personId) {
    personScope.hidden = false;
    const clear = document.querySelector<HTMLAnchorElement>('[data-finance-clear-person]')!;
    clear.href = `/finances/?dataset=payroll${requestedYear && /^20\d{2}$/.test(requestedYear) ? `&year=${requestedYear}` : ''}`;
  }
  if (requestedYear && /^20\d{2}$/.test(requestedYear)) year.add(new Option(requestedYear, requestedYear, true, true));
  let offset = 0, generation = 0, current: SchoolFinanceResult | null = null;
  function text(tag: string, content: string) { const node = document.createElement(tag); node.textContent = content; return node; }
  async function load() {
    const request = ++generation, selectedDataset = dataset.value as FinanceDataset, selectedYear = year.value;
    current = null;
    table.hidden = summary.hidden = source.hidden = previous.hidden = next.hidden = download.hidden = true;
    status.textContent = 'Loading published school finances…';
    explanation.textContent = selectedDataset === 'payroll'
      ? 'These are annual payroll records, not verified unique employees or full-time headcounts. School and work location are not reported. Salary and travel are shown separately.'
      : 'These are organization/recipient summaries, not invoices or a list of outside suppliers. SALARY and BENEFITS entries overlap payroll; never add the datasets together.';
    const url = new URL(location.href);
    url.search = new URLSearchParams({ dataset: selectedDataset, ...(selectedYear ? { year: selectedYear } : {}), ...(query.value ? { q: query.value } : {}), ...(personId ? { person: personId } : {}), sort: sort.value }).toString();
    history.replaceState(null, '', url);
    try {
      const { data, error } = await getSupabase().rpc('browse_school_finances', { p_dataset: selectedDataset, p_year: selectedYear ? Number(selectedYear) : null, p_query: query.value, p_offset: offset, p_limit: 50, p_sort: sort.value, p_person_id: personId });
      if (request !== generation) return;
      if (error) throw new Error(error.message);
      const result = data as SchoolFinanceResult;
      year.replaceChildren(new Option('Latest available', ''));
      for (const value of result.years) year.add(new Option(String(value), String(value)));
      if (selectedYear && !result.years.includes(Number(selectedYear))) year.add(new Option(`${selectedYear} (not available)`, selectedYear));
      year.value = selectedYear;
      if (!result.release) { status.textContent = 'No published data for this selection. Choose another year or dataset. Missing data does not mean zero spending.'; return; }
      current = result;
      const payroll = selectedDataset === 'payroll', release = result.release;
      status.textContent = result.total ? `${offset + 1}–${Math.min(offset + 50, result.total)} of ${result.total.toLocaleString()} matching records.` : 'No matching records. Try a different name or fewer search words.';
      summary.hidden = source.hidden = false;
      totals.textContent = `${result.total.toLocaleString()} matching source records · ${payroll ? 'Salary' : 'Reported payments'}: ${formatFinanceMoney(result.filtered_amount)}${payroll && result.filtered_travel !== null ? ` · Travel: ${formatFinanceMoney(result.filtered_travel)}` : ''}.`;
      period.textContent = `FY${release.fiscal_year}: July 1, ${release.fiscal_year - 1}–June 30, ${release.fiscal_year}. The complete published dataset has ${release.row_count.toLocaleString()} source records. Totals above follow your search.`;
      table.caption!.textContent = `Bibb school ${payroll ? 'payroll and travel' : 'payment summaries'} · FY${release.fiscal_year}`;
      const head = document.createElement('tr');
      for (const label of payroll ? ['Reported name','Job title','Salary','Travel','Source row'] : ['Reported recipient','Reported payments','Amount','Source row']) {
        const th = text('th', label) as HTMLTableCellElement; th.scope = 'col'; head.append(th);
      }
      table.tHead!.replaceChildren(head); const body = table.tBodies[0]; body.replaceChildren();
      for (const row of result.rows) {
        const tr = document.createElement('tr'), name = text('th', row.name) as HTMLTableCellElement; name.scope = 'row';
        if (payroll && row.person_id) {
          const profile = text('a', row.name) as HTMLAnchorElement;
          profile.href = `/people/view/?id=${encodeURIComponent(row.person_id)}`;
          name.replaceChildren(profile);
          name.append(text('small', row.identity_review_required ? 'Identity needs review · separate source profile' : 'Identity reviewed'));
        }
        if (!payroll && row.category === 'payroll_aggregate') name.append(text('small', 'Payroll aggregate · overlaps payroll dataset'));
        if (!payroll && row.recipient) {
          const recipient = row.recipient;
          const profile = text('a', row.name) as HTMLAnchorElement;
          profile.href = recipient.kind === 'person' ? `/people/view/?id=${encodeURIComponent(recipient.record_id)}` : `/orgs/${encodeURIComponent(recipient.slug)}/`;
          name.replaceChildren(profile);
          name.append(text('small', recipient.is_stub ? 'Provisional recipient stub · needs review' : recipient.identity_review_required ? 'Linked recipient · identity needs review' : 'Recipient identity reviewed'));
          if (recipient.name !== row.name) name.append(text('small', `Linked to: ${recipient.name}`));
        }
        tr.append(name);
        for (const value of payroll ? [row.title ?? 'Not reported',formatFinanceMoney(row.amount),row.travel === null ? 'Not reported' : formatFinanceMoney(row.travel),String(row.source_row_number)] : [String(row.payment_count ?? 'Not reported'),formatFinanceMoney(row.amount),String(row.source_row_number)]) tr.append(text('td',value));
        body.append(tr);
      }
      table.hidden = result.rows.length === 0; previous.hidden = offset === 0; next.hidden = offset + 50 >= result.total; download.hidden = !result.rows.length;
      provenance.replaceChildren();
      const link = text('a', 'Open Georgia source') as HTMLAnchorElement;
      const sourceUrl = new URL(release.source_url);
      if (sourceUrl.protocol === 'https:' && sourceUrl.hostname === 'open.ga.gov') { link.href = sourceUrl.href; provenance.append(link); }
      provenance.append(text('p', `Reporting organization: ${release.source_organization} (Open Georgia ${release.source_organization_id}).`));
      if (release.organization_slug && /^[a-z0-9-]+$/.test(release.organization_slug)) {
        const profile = text('a', 'View organization profile') as HTMLAnchorElement; profile.href = `/orgs/${release.organization_slug}/`; provenance.append(profile);
      }
      provenance.append(text('p', `Retrieved: ${new Date(release.retrieved_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}. Published: ${new Date(release.published_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}. Original file: ${release.source_filename}.`), text('p','Source rows are data-row numbers in the original export, excluding its header. Search result pages are not full source exports.'), text('p',`Export filters: ${JSON.stringify(release.source_filters)}.`),text('p',`Original SHA-256: ${release.source_sha256}`));
    } catch {
      if (request === generation) status.textContent = 'School finances could not be loaded. Select Search finances to retry.';
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); offset = 0; void load(); });
  dataset.addEventListener('change', () => { personId = null; personScope.hidden = true; year.replaceChildren(new Option('Latest available','')); offset = 0; void load(); });
  year.addEventListener('change', () => { offset = 0; void load(); });
  previous.addEventListener('click', () => { offset = Math.max(0,offset - 50); void load(); });
  next.addEventListener('click', () => { offset += 50; void load(); });
  download.addEventListener('click', () => {
    if (!current?.release) return;
    const url = URL.createObjectURL(new Blob([financePageCsv(current)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `bibb-school-${current.release.dataset}-${current.release.fiscal_year}-page-${offset / 50 + 1}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  await load();
}

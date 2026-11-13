import { historyLink } from '../lib/history';
import { officeLabel, parseServiceDate, serviceDates, type Office, type OfficeTerm } from '../lib/offices';
import { getSupabase } from '../lib/supabase';

type Named = { id: string; name: string };
export async function initOfficesAdmin(): Promise<void> {
  const officeForm = document.querySelector<HTMLFormElement>('[data-office-form]');
  const termForm = document.querySelector<HTMLFormElement>('[data-term-form]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  if (!officeForm || !termForm || !panel) return;
  const forms = { offices: officeForm, office_terms: termForm };
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.replace('/signin/?next=/admin/offices/'); return; }
  const { data: admin, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  document.querySelector('[data-admin-gate]')?.remove();
  if (adminError || !admin) {
    document.querySelector<HTMLElement>('[data-admin-denied]')!.hidden = false;
    return;
  }
  panel.hidden = false;
  let offices: Office[] = [];
  let terms: OfficeTerm[] = [];
  let organizations: Named[] = [];
  let people: Named[] = [];
  function message(root: HTMLElement, text: string, error = false) {
    const target = root.querySelector<HTMLElement>('[data-message]') ?? document.querySelector<HTMLElement>('[data-list-message]')!;
    target.textContent = text;
    target.dataset.kind = error ? 'error' : 'success';
    target.hidden = false;
  }
  function field(form: HTMLFormElement, name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
    return form.elements.namedItem(name) as HTMLInputElement;
  }
  function reset(table: keyof typeof forms) {
    const form = forms[table];
    form.reset();
    field(form, 'id').value = '';
    form.querySelector<HTMLElement>('[data-cancel]')!.hidden = true;
    form.querySelector<HTMLElement>('[data-form-heading]')!.textContent = table === 'offices' ? 'Add an office' : 'Add service';
  }
  function edit(table: keyof typeof forms, record: Office | OfficeTerm) {
    const form = forms[table];
    reset(table);
    for (const [key, value] of Object.entries(record)) {
      const input = form.elements.namedItem(key) as HTMLInputElement | null;
      if (input) input.value = value ?? '';
      if (input && (key === 'starts_on' || key === 'ends_on') && 'starts_on_precision' in record) {
        const precision = key === 'starts_on' ? record.starts_on_precision : (record as OfficeTerm).ends_on_precision;
        if (precision === 'year' && value) input.value = String(value).slice(0, 4);
      }
    }
    form.querySelector<HTMLElement>('[data-cancel]')!.hidden = false;
    form.querySelector<HTMLElement>('[data-form-heading]')!.textContent = table === 'offices' ? 'Edit office' : 'Edit service';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const orgName = (id: string) => organizations.find(org => org.id === id)?.name ?? 'Unknown organization';
  const personName = (id: string) => people.find(person => person.id === id)?.name ?? 'Unknown person';
  function render(table: keyof typeof forms, records: (Office | OfficeTerm)[]) {
    const list = document.querySelector<HTMLElement>(table === 'offices' ? '[data-office-list]' : '[data-term-list]')!;
    list.replaceChildren();
    if (!records.length) { list.textContent = table === 'offices' ? 'No offices recorded.' : 'No service recorded.'; return; }
    for (const record of records) {
      const row = document.createElement('article');
      row.className = 'org-row';
      const info = document.createElement('div');
      info.className = 'org-row-info';
      const heading = document.createElement('span');
      heading.className = 'org-row-name';
      const meta = document.createElement('span');
      meta.className = 'org-row-meta';
      if ('name' in record) {
        heading.textContent = officeLabel(record);
        meta.textContent = orgName(record.organization_id);
      } else {
        const office = offices.find(o => o.id === record.office_id);
        heading.textContent = `${personName(record.person_id)} · ${office ? officeLabel(office) : 'Unknown office'}`;
        meta.textContent = `${office ? orgName(office.organization_id) : ''} · ${record.selection_method === 'elected' ? 'Elected' : 'Appointed'} · ${serviceDates(record)}`;
      }
      info.append(heading, meta);
      const actions = document.createElement('div');
      actions.className = 'org-row-actions';
      actions.append(historyLink(table, record.id));
      const change = document.createElement('button');
      change.type = 'button'; change.textContent = 'Edit';
      change.addEventListener('click', () => edit(table, record));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = 'Delete'; remove.className = 'button-danger';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete this ${table === 'offices' ? 'office' : 'service record'}?`)) return;
        remove.disabled = true;
        try {
          const { error } = await supabase.from(table).delete().eq('id', record.id);
          if (error) throw error;
          if (field(forms[table], 'id').value === record.id) reset(table);
          await load();
          message(list, 'Deleted.');
        } catch (error) { message(list, String((error as Error).message ?? error), true); }
        finally { remove.disabled = false; }
      });
      actions.append(change, remove); row.append(info, actions); list.append(row);
    }
  }
  function options(form: HTMLFormElement, name: string, rows: Named[]) {
    const select = field(form, name) as HTMLSelectElement;
    const previous = select.value;
    select.replaceChildren(new Option('Select…', ''), ...rows.map(row => new Option(row.name, row.id)));
    select.value = previous;
  }
  async function load() {
    const results = await Promise.all([
      supabase.from('offices').select('id,organization_id,name,district,seat,description').order('name'),
      supabase.from('office_terms').select('id,office_id,person_id,selection_method,starts_on,ends_on,source_url,starts_on_precision,ends_on_precision').order('starts_on', { ascending: false }),
      supabase.from('organizations').select('id,name').order('name'),
      supabase.from('people').select('id,full_name').order('full_name'),
    ]);
    for (const result of results) if (result.error) throw result.error;
    offices = results[0].data as unknown as Office[];
    terms = results[1].data as unknown as OfficeTerm[];
    organizations = results[2].data as unknown as Named[];
    people = (results[3].data as unknown as { id: string; full_name: string }[]).map(p => ({ id: p.id, name: p.full_name }));
    options(forms.offices, 'organization_id', organizations);
    options(forms.office_terms, 'person_id', people);
    options(forms.office_terms, 'office_id', offices.map(o => ({ id: o.id, name: `${officeLabel(o)} · ${orgName(o.organization_id)}` })));
    render('offices', offices); render('office_terms', terms);
  }
  for (const table of ['offices', 'office_terms'] as const) {
    const form = forms[table];
    form.querySelector('[data-cancel]')!.addEventListener('click', () => reset(table));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
      const values = new FormData(form);
      const value = (name: string) => String(values.get(name) ?? '').trim();
      const id = value('id');
      let start: ReturnType<typeof parseServiceDate> = null;
      let end: ReturnType<typeof parseServiceDate> = null;
      if (table === 'office_terms') {
        try {
          start = parseServiceDate(value('starts_on'), 'start');
          end = parseServiceDate(value('ends_on'), 'end');
          if (!start) throw new Error('Enter the first date or year of service.');
        } catch (error) { message(form, (error as Error).message, true); return; }
      }
      const payload: Record<string, string | null> = table === 'offices' ? {
        organization_id: value('organization_id'), name: value('name'), district: value('district'), seat: value('seat'), description: value('description') || null,
      } : {
        office_id: value('office_id'), person_id: value('person_id'), selection_method: value('selection_method'), starts_on: start!.date,
        ends_on: end?.date ?? null,
        starts_on_precision: start!.precision,
        ends_on_precision: end?.precision ?? 'day', source_url: value('source_url') || null,
      };
      if (table === 'office_terms' && value('ends_on') && String(payload.ends_on) < String(payload.starts_on)) {
        message(form, 'The last day must be on or after the first day.', true); return;
      }
      if (table === 'office_terms' && value('source_url') && !/^https?:\/\/\S+$/i.test(value('source_url'))) {
        message(form, 'Use an HTTP or HTTPS source URL.', true); return;
      }
      button.disabled = true;
      try {
        const { error } = id ? await supabase.from(table).update(payload).eq('id', id) : await supabase.from(table).insert(payload);
        if (error) throw error;
        reset(table); await load(); message(form, 'Saved.');
      } catch (error) { message(form, String((error as Error).message ?? error), true); }
      finally { button.disabled = false; }
    });
  }
  try { await load(); }
  catch (error) { message(panel, `Could not load offices: ${String((error as Error).message ?? error)}`, true); }
}

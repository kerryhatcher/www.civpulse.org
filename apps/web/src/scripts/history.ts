import { getSupabase } from '../lib/supabase';
import { HISTORY_TYPES, historyLink } from '../lib/history';

type Revision = {
  id: string; changed_at: string; transaction_id: string; table_name: string;
  object_id: string; operation: string; actor_name: string; actor_id: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
};
const ignored = new Set(['search_vector', 'search_document', 'site_search_document', 'updated_at']);
function valueText(value: unknown): string {
  if (value === undefined) return 'Not present';
  if (value === null) return 'Empty';
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}
function renderRevision(rev: Revision): HTMLLIElement {
  const li = document.createElement('li');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const title = document.createElement('strong');
  const record = rev.after ?? rev.before ?? {};
  const label = [record.full_name, record.name, record.title, record.office].find(value => typeof value === 'string' && value.trim());
  title.textContent = `${rev.operation === 'INSERT' ? 'Created' : rev.operation === 'DELETE' ? 'Deleted' : 'Updated'} · ${HISTORY_TYPES[rev.table_name] ?? rev.table_name}${label ? ` · ${label}` : ''}`;
  const meta = document.createElement('span');
  meta.className = 'history-meta';
  meta.textContent = `${new Date(rev.changed_at).toLocaleString()} · ${rev.actor_name}`;
  summary.append(title, meta);
  const reference = document.createElement('p');
  reference.className = 'history-meta';
  reference.textContent = `Revision ${rev.id} · Transaction ${rev.transaction_id} · Record ${rev.object_id}${rev.actor_id ? ` · Editor ID ${rev.actor_id}` : ''}`;
  reference.append(' · ', historyLink(rev.table_name, rev.object_id));
  const changes = document.createElement('div');
  changes.className = 'history-changes';
  for (const key of new Set([...Object.keys(rev.before ?? {}), ...Object.keys(rev.after ?? {})])) {
    const before = rev.before?.[key]; const after = rev.after?.[key];
    if (ignored.has(key) || JSON.stringify(before) === JSON.stringify(after)) continue;
    const field = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = key.replaceAll('_', ' ');
    const values = document.createElement('div');
    values.className = 'history-values';
    for (const [label, value] of [['Before', before], ['After', after]] as const) {
      const column = document.createElement('div');
      const caption = document.createElement('strong'); caption.textContent = label;
      const content = document.createElement('pre'); content.textContent = valueText(value);
      column.append(caption, content); values.append(column);
    }
    field.append(heading, values); changes.append(field);
  }
  details.append(summary, reference, changes); li.append(details); return li;
}
export async function initHistory(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('[data-history-filter]');
  const list = document.querySelector<HTMLOListElement>('[data-history-list]');
  const status = document.querySelector<HTMLElement>('[data-history-status]');
  const access = document.querySelector<HTMLElement>('[data-history-access]');
  const more = document.querySelector<HTMLButtonElement>('[data-history-more]');
  if (!form || !list || !status || !access || !more) return;
  const type = form.elements.namedItem('type') as HTMLSelectElement;
  const id = form.elements.namedItem('id') as HTMLInputElement;
  const params = new URLSearchParams(location.search);
  type.value = params.get('type') ?? ''; id.value = params.get('id') ?? '';
  let cursor: string | null = null; let generation = 0;
  const submit = form.querySelector<HTMLButtonElement>('button')!;
  async function load(reset = false): Promise<void> {
    const request = ++generation;
    if (reset) { cursor = null; list!.replaceChildren(); }
    status!.textContent = 'Loading changes…'; more!.hidden = true; submit.disabled = true;
    try {
      const { data, error } = await getSupabase().rpc('get_object_history', {
        p_table: type.value || null, p_object_id: id.value.trim() || null,
        p_before: cursor, p_limit: 25,
      });
      if (request !== generation) return;
      if (error) throw error;
      const revisions = data.revisions as Revision[];
      access!.textContent = data.admin
        ? 'Admin view: includes private, unlisted, and deleted records and editor account IDs.'
        : 'Public view: only revisions that were public when recorded and whose linked records are still public. Editor emails and account IDs are hidden.';
      list!.append(...revisions.map(renderRevision));
      cursor = revisions.at(-1)?.id ?? cursor;
      status!.textContent = list!.children.length ? `${list!.children.length} ${list!.children.length === 1 ? 'change' : 'changes'} shown, newest first.`
        : 'No visible history. This record may have no tracked changes, may be hidden, or may not exist. Select a record using its “View history” link.';
      more!.hidden = revisions.length < 25;
    } catch {
      if (request === generation) status!.textContent = 'Could not load history. Try “Show history” again.';
    } finally { if (request === generation) submit.disabled = false; }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = new URLSearchParams();
    if (type.value) query.set('type', type.value);
    if (id.value.trim()) query.set('id', id.value.trim());
    history.replaceState(null, '', `/history/?${query}`);
    void load(true);
  });
  more.addEventListener('click', () => void load());
  getSupabase().auth.onAuthStateChange(() => { window.setTimeout(() => void load(true), 0); });
  await load(true);
}

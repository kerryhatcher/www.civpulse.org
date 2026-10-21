import type { BallotQuestion, Election } from '../lib/elections';
import { getSupabase } from '../lib/supabase';

/** Called only after the elections admin gate succeeds; RLS enforces writes. */
export async function initBallotQuestionAdmin(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('[data-question-form]');
  const list = document.querySelector<HTMLElement>('[data-question-list]');
  const filter = document.querySelector<HTMLSelectElement>('[data-question-filter]');
  if (!form || !list || !filter) return;
  const formEl = form, listEl = list, filterEl = filter;
  const supabase = getSupabase();
  const electionSelect = formEl.querySelector<HTMLSelectElement>('[name=election_id]')!;
  const cancel = formEl.querySelector<HTMLButtonElement>('[data-question-cancel]')!;
  const submit = formEl.querySelector<HTMLButtonElement>('[type=submit]')!;
  const heading = formEl.querySelector<HTMLElement>('[data-question-form-title]')!;
  let questions: BallotQuestion[] = [];
  let elections: Election[] = [];

  function message(text: string, error = false, inList = false): void {
    const el = document.querySelector<HTMLElement>(inList ? '[data-question-list-message]' : '[data-question-message]')!;
    el.textContent = text;
    el.dataset.kind = error ? 'error' : 'success';
    el.hidden = false;
  }
  function reset(): void {
    const selected = electionSelect.value;
    formEl.reset();
    (formEl.elements.namedItem('id') as HTMLInputElement).value = '';
    electionSelect.value = selected;
    heading.textContent = 'Add a ballot question';
    submit.textContent = 'Create ballot question';
    cancel.hidden = true;
  }
  function edit(question: BallotQuestion): void {
    for (const key of ['id', 'election_id', 'title', 'question_text', 'description', 'jurisdiction', 'source_url', 'position', 'choices'] as const) {
      const field = formEl.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      field.value = key === 'choices' ? question.choices.join('\n') : String(question[key] ?? '');
    }
    heading.textContent = 'Edit ballot question';
    submit.textContent = 'Save ballot question';
    cancel.hidden = false;
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function render(): void {
    listEl.replaceChildren();
    const selected = questions.filter(q => !filterEl.value || q.election_id === filterEl.value);
    if (!selected.length) {
      const empty = document.createElement('p');
      empty.className = 'status'; empty.textContent = 'No ballot questions added yet.';
      listEl.append(empty);
    }
    for (const question of selected) {
      const row = document.createElement('div'); row.className = 'org-row';
      const content = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = question.title;
      const detail = document.createElement('p');
      detail.textContent = [elections.find(e => e.id === question.election_id)?.name, question.jurisdiction, question.choices.join(' / ')].filter(Boolean).join(' · ');
      content.append(title, detail);
      const actions = document.createElement('div'); actions.className = 'org-row-actions';
      const editButton = document.createElement('button'); editButton.type = 'button'; editButton.textContent = 'Edit'; editButton.addEventListener('click', () => edit(question));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete ballot question “${question.title}”?`)) return;
        remove.disabled = true;
        const { error } = await supabase.from('ballot_questions').delete().eq('id', question.id).select('id').single();
        if (error) { message(error.message, true, true); remove.disabled = false; return; }
        if ((formEl.elements.namedItem('id') as HTMLInputElement).value === question.id) reset();
        message('Ballot question deleted.', false, true);
        await load();
      });
      actions.append(editButton, remove); row.append(content, actions); listEl.append(row);
    }
  }
  async function load(): Promise<void> {
    const { data, error } = await supabase.from('ballot_questions').select('id, election_id, title, question_text, description, jurisdiction, choices, source_url, position').order('position').order('title');
    if (error) { message(error.message, true, true); return; }
    questions = (data ?? []) as BallotQuestion[];
    render();
  }
  document.addEventListener('elections-updated', (event) => {
    elections = (event as CustomEvent<Election[]>).detail;
    for (const select of [electionSelect, filterEl]) {
      const previous = select.value;
      select.replaceChildren(new Option(select === filterEl ? 'All elections' : 'Select an election…', ''));
      for (const election of elections) select.append(new Option(election.name, election.id));
      if (elections.some(e => e.id === previous)) select.value = previous;
      else if (select === electionSelect && elections.length === 1) select.value = elections[0].id;
    }
    // Deleting an election also cascades its ballot questions.
    questions = questions.filter(q => elections.some(e => e.id === q.election_id));
    render();
  });
  formEl.addEventListener('submit', async event => {
    event.preventDefault();
    if (!formEl.reportValidity()) return;
    const values = new FormData(formEl);
    const text = (key: string): string => String(values.get(key) ?? '').trim();
    const choices = text('choices').split('\n').map(c => c.trim()).filter(Boolean);
    const source = text('source_url');
    if (!text('title') || !text('question_text') || choices.length < 2 || choices.length > 20 || new Set(choices).size !== choices.length) {
      message('A title, full wording, and 2–20 distinct response choices are required.', true); return;
    }
    if (source && !/^https?:\/\//i.test(source)) { message('Use an HTTP or HTTPS source URL.', true); return; }
    const position = Number(text('position'));
    if (!Number.isSafeInteger(position) || position < -2147483648 || position > 2147483647) { message('Order must be a whole number between -2147483648 and 2147483647.', true); return; }
    submit.disabled = true;
    message('Saving…');
    const id = text('id');
    const payload = { election_id: text('election_id'), title: text('title'), question_text: text('question_text'), description: text('description') || null, jurisdiction: text('jurisdiction') || null, choices, source_url: source || null, position };
    const query = id ? supabase.from('ballot_questions').update(payload).eq('id', id) : supabase.from('ballot_questions').insert(payload);
    const { error } = await query.select('id').single();
    submit.disabled = false;
    if (error) { message(error.message, true); return; }
    message(id ? 'Ballot question updated.' : 'Ballot question created.');
    reset(); await load();
  });
  cancel.addEventListener('click', reset);
  filterEl.addEventListener('change', render);
  await load();
}

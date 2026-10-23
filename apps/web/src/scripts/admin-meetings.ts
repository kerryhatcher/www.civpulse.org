import { getSupabase } from '../lib/supabase';
import { MEETING_BUCKET, MEETING_FILE_TYPES, type MeetingRecord } from '../lib/meetings';

type Person = { id: string; full_name: string };

function message(text: string, error = false): void {
  const target = document.querySelector<HTMLElement>('[data-meeting-status]');
  if (target) { target.textContent = text; target.dataset.kind = error ? 'error' : 'success'; }
}

function action(label: string, run: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label;
  button.addEventListener('click', run);
  return button;
}

export async function initMeetingAdmin(): Promise<void> {
  const supabase = getSupabase();
  const gate = document.querySelector<HTMLElement>('[data-meeting-gate]');
  const denied = document.querySelector<HTMLElement>('[data-meeting-denied]');
  const panel = document.querySelector<HTMLElement>('[data-meeting-admin]');
  const editor = document.querySelector<HTMLElement>('[data-meeting-editor]');
  const select = document.querySelector<HTMLSelectElement>('[data-meeting-select]');
  const notesForm = document.querySelector<HTMLFormElement>('[data-meeting-notes-form]');
  const attendanceForm = document.querySelector<HTMLFormElement>('[data-attendance-form]');
  const voteForm = document.querySelector<HTMLFormElement>('[data-vote-form]');
  const attachmentForm = document.querySelector<HTMLFormElement>('[data-attachment-form]');
  if (!panel || !editor || !select || !notesForm || !attendanceForm || !voteForm || !attachmentForm) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace('/signin/?next=/admin/meetings/'); return; }
  const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  gate?.remove();
  if (!admin) { if (denied) denied.hidden = false; return; }
  panel.hidden = false;

  let record: MeetingRecord | null = null;
  let people: Person[] = [];
  const refresh = async (): Promise<void> => {
    const id = select.value;
    editor.hidden = !id;
    if (!id) { record = null; return; }
    const { data, error } = await supabase.rpc('get_meeting', { p_id: id });
    if (error || !data || data.status !== 'ok') {
      message(error?.message ?? 'Meeting could not be loaded.', true); return;
    }
    record = data as MeetingRecord;
    editor.hidden = false;
    const notes = notesForm.elements.namedItem('meeting_notes') as HTMLTextAreaElement;
    const transcript = notesForm.elements.namedItem('meeting_transcript') as HTMLTextAreaElement;
    notes.value = record.event?.meeting_notes ?? '';
    transcript.value = record.event?.meeting_transcript ?? '';
    const view = document.querySelector<HTMLAnchorElement>('[data-meeting-view]');
    if (view) view.href = `/calendar/view/?id=${id}`;
    renderAttendance(); renderVotes(); renderAttachments();
  };

  const { data: events, error: eventError } = await supabase.from('events')
    .select('id, title, starts_at').eq('is_meeting', true).order('starts_at', { ascending: false });
  if (eventError) { message(eventError.message, true); return; }
  select.replaceChildren(new Option('Select a meeting…', ''));
  for (const event of events ?? []) {
    select.append(new Option(`${new Date(event.starts_at).toLocaleDateString()} · ${event.title}`, event.id));
  }
  const requested = new URLSearchParams(location.search).get('event');
  if (requested && (events ?? []).some(event => event.id === requested)) select.value = requested;
  const { data: personRows, error: peopleError } = await supabase.from('people')
    .select('id, full_name').order('full_name');
  if (peopleError) { message(peopleError.message, true); return; }
  people = personRows ?? [];
  const personSelect = attendanceForm.elements.namedItem('person_id') as HTMLSelectElement;
  personSelect.replaceChildren(new Option('Select a person…', ''));
  for (const person of people) personSelect.append(new Option(person.full_name, person.id));
  select.addEventListener('change', () => {
    const url = new URL(location.href);
    if (select.value) url.searchParams.set('event', select.value); else url.searchParams.delete('event');
    history.replaceState(null, '', url);
    void refresh();
  });

  notesForm.addEventListener('submit', event => void (async () => {
    event.preventDefault(); if (!select.value) return;
    const values = new FormData(notesForm);
    const { error } = await supabase.from('events').update({
      meeting_notes: String(values.get('meeting_notes') ?? '').trim() || null,
      meeting_transcript: String(values.get('meeting_transcript') ?? '').trim() || null,
    }).eq('id', select.value);
    if (error) message(error.message, true); else { message('Text saved.'); await refresh(); }
  })());

  function renderAttendance(): void {
    const list = document.querySelector<HTMLElement>('[data-attendance-list]'); if (!list) return;
    list.replaceChildren();
    for (const attendee of record?.attendance ?? []) {
      const row = document.createElement('div'); row.className = 'org-row';
      const info = document.createElement('span');
      info.textContent = `${attendee.full_name} · ${attendee.status}${attendee.note ? ` · ${attendee.note}` : ''}`;
      const remove = action('Remove', () => void (async () => {
        if (!confirm(`Remove ${attendee.full_name} from this meeting? Their recorded votes will also be removed.`)) return;
        const { error } = await supabase.from('meeting_attendance').delete()
          .eq('meeting_id', select!.value).eq('person_id', attendee.person_id);
        if (error) message(error.message, true); else { message('Attendee removed.'); await refresh(); }
      })());
      row.append(info, remove); list.append(row);
    }
  }
  attendanceForm.addEventListener('submit', event => void (async () => {
    event.preventDefault(); if (!select.value) return;
    const values = new FormData(attendanceForm);
    const personId = String(values.get('person_id') ?? '');
    if (!personId) return;
    const { error } = await supabase.from('meeting_attendance').upsert({
      meeting_id: select.value, person_id: personId,
      status: String(values.get('status')), note: String(values.get('note') ?? '').trim() || null,
    });
    if (error) message(error.message, true); else { message('Attendance saved.'); attendanceForm.reset(); await refresh(); }
  })());

  function renderVotes(): void {
    const list = document.querySelector<HTMLElement>('[data-vote-list]'); if (!list) return;
    list.replaceChildren();
    for (const vote of record?.votes ?? []) {
      const row = document.createElement('article'); row.className = 'org-row meeting-vote';
      const body = document.createElement('div');
      const heading = document.createElement('h3'); heading.textContent = vote.subject; body.append(heading);
      if (vote.description) { const detail = document.createElement('p'); detail.textContent = vote.description; body.append(detail); }
      const outcome = document.createElement('p'); outcome.textContent = `Outcome: ${vote.outcome ?? 'Not recorded'}`; body.append(outcome);
      const choices = document.createElement('ul');
      for (const choice of vote.choices) {
        const item = document.createElement('li'); item.append(`${choice.full_name}: ${choice.choice} `);
        item.append(action('Remove choice', () => void (async () => {
          const { error } = await supabase.from('meeting_vote_choices').delete()
            .eq('vote_id', vote.id).eq('person_id', choice.person_id);
          if (error) message(error.message, true); else { message('Choice removed.'); await refresh(); }
        })()));
        choices.append(item);
      }
      body.append(choices);
      const outcomeForm = document.createElement('form'); outcomeForm.className = 'meeting-inline-form';
      const outcomeSelect = document.createElement('select');
      for (const [value, label] of [['', 'Not recorded'], ['passed', 'Passed'], ['failed', 'Failed'], ['tabled', 'Tabled'], ['withdrawn', 'Withdrawn']]) {
        outcomeSelect.append(new Option(label, value));
      }
      outcomeSelect.value = vote.outcome ?? '';
      const outcomeSave = document.createElement('button'); outcomeSave.type = 'submit'; outcomeSave.textContent = 'Save outcome';
      outcomeForm.append(outcomeSelect, outcomeSave);
      outcomeForm.addEventListener('submit', event => void (async () => {
        event.preventDefault();
        const { error } = await supabase.from('meeting_votes').update({ outcome: outcomeSelect.value || null }).eq('id', vote.id);
        if (error) message(error.message, true); else { message('Outcome saved.'); await refresh(); }
      })());
      body.append(outcomeForm);
      const form = document.createElement('form'); form.className = 'meeting-inline-form';
      const person = document.createElement('select'); person.required = true;
      person.append(new Option('Present attendee…', ''));
      for (const attendee of record?.attendance?.filter(item => item.status === 'present') ?? []) {
        person.append(new Option(attendee.full_name, attendee.person_id));
      }
      const choice = document.createElement('select');
      for (const value of ['yes', 'no', 'abstain', 'recused']) choice.append(new Option(value, value));
      const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Record choice';
      form.append(person, choice, save);
      form.addEventListener('submit', event => void (async () => {
        event.preventDefault(); if (!person.value) return;
        const { error } = await supabase.from('meeting_vote_choices').upsert({
          vote_id: vote.id, meeting_id: select!.value, person_id: person.value, choice: choice.value,
        });
        if (error) message(error.message, true); else { message('Choice recorded.'); await refresh(); }
      })());
      const remove = action('Delete vote', () => void (async () => {
        if (!confirm(`Delete vote “${vote.subject}”?`)) return;
        const { error } = await supabase.from('meeting_votes').delete().eq('id', vote.id);
        if (error) message(error.message, true); else { message('Vote deleted.'); await refresh(); }
      })());
      row.append(body, form, remove); list.append(row);
    }
  }
  voteForm.addEventListener('submit', event => void (async () => {
    event.preventDefault(); if (!select.value) return;
    const values = new FormData(voteForm);
    const subject = String(values.get('subject') ?? '').trim(); if (!subject) return;
    const { error } = await supabase.from('meeting_votes').insert({
      meeting_id: select.value, subject,
      description: String(values.get('description') ?? '').trim() || null,
      outcome: String(values.get('outcome') ?? '') || null,
      position: record?.votes?.length ?? 0,
    });
    if (error) message(error.message, true); else { message('Vote added.'); voteForm.reset(); await refresh(); }
  })());

  function renderAttachments(): void {
    const list = document.querySelector<HTMLElement>('[data-attachment-list]'); if (!list) return;
    list.replaceChildren();
    for (const file of record?.attachments ?? []) {
      const row = document.createElement('div'); row.className = 'org-row';
      const name = document.createElement('span'); name.textContent = `${file.file_name} (${(file.size_bytes / 1048576).toFixed(1)} MB)`;
      const download = action('Download', () => void (async () => {
        const { data, error } = await supabase.storage.from(MEETING_BUCKET)
          .createSignedUrl(file.storage_path, 60, { download: file.file_name });
        if (error || !data) message(error?.message ?? 'Download unavailable.', true);
        else location.href = data.signedUrl;
      })());
      const remove = action('Delete', () => void (async () => {
        if (!confirm(`Delete attachment “${file.file_name}”?`)) return;
        const { error: storageError } = await supabase.storage.from(MEETING_BUCKET).remove([file.storage_path]);
        if (storageError) { message(storageError.message, true); return; }
        const { error } = await supabase.from('meeting_attachments').delete().eq('id', file.id);
        if (error) message(error.message, true); else { message('Attachment deleted.'); await refresh(); }
      })());
      row.append(name, download, remove); list.append(row);
    }
  }
  attachmentForm.addEventListener('submit', event => void (async () => {
    event.preventDefault(); if (!select.value) return;
    const input = attachmentForm.elements.namedItem('files') as HTMLInputElement;
    const files = [...(input.files ?? [])]; if (!files.length) return;
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const type = MEETING_FILE_TYPES[extension];
      if (!type || file.size === 0 || file.size > 26214400) {
        message(`${file.name}: unsupported type or size (maximum 25 MB).`, true); return;
      }
      const path = `${select.value}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(MEETING_BUCKET)
        .upload(path, file, { contentType: type, upsert: false });
      if (uploadError) { message(uploadError.message, true); return; }
      const { error } = await supabase.from('meeting_attachments').insert({
        meeting_id: select.value, file_name: file.name, storage_path: path,
        mime_type: type, size_bytes: file.size,
      });
      if (error) {
        await supabase.storage.from(MEETING_BUCKET).remove([path]);
        message(error.message, true); return;
      }
    }
    input.value = ''; message(`${files.length} file${files.length === 1 ? '' : 's'} uploaded.`); await refresh();
  })());

  await refresh();
}

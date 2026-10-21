import {
  CANDIDATE_STATUS_LABELS,
  ELECTION_COLUMNS,
  ELECTION_KIND_LABELS,
  ELECTION_VISIBILITY_LABELS,
  formatElectionDate,
  type CandidateStatus,
  type Election,
  type ElectionKind,
  type ElectionVisibility,
} from '../lib/elections';
import { getSupabase } from '../lib/supabase';

type MessageKind = 'info' | 'error' | 'success';

interface ContestRow {
  id: string;
  election_id: string;
  office: string;
  district: string | null;
  seat: string | null;
  description: string | null;
  partisan: boolean;
  position: number;
}

interface CandidateRow {
  contest_id: string;
  person_id: string;
  party: string | null;
  status: CandidateStatus;
  position: number;
}

interface PersonRef {
  id: string;
  full_name: string;
}

const CONTEST_COLUMNS = 'id, election_id, office, district, seat, description, partisan, position';
const CANDIDATE_COLUMNS = 'contest_id, person_id, party, status, position';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function intValue(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setMessage(
  root: Document | HTMLElement,
  selector: string,
  text: string,
  kind: MessageKind = 'info',
): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
  element.hidden = false;
}

function kindValue(value: string): ElectionKind {
  return (Object.keys(ELECTION_KIND_LABELS) as ElectionKind[]).includes(value as ElectionKind)
    ? (value as ElectionKind)
    : 'other';
}

function visibilityValue(value: string): ElectionVisibility {
  return (['public', 'unlisted', 'private'] as ElectionVisibility[]).includes(
    value as ElectionVisibility,
  )
    ? (value as ElectionVisibility)
    : 'public';
}

function candidateStatusValue(value: string): CandidateStatus {
  return (Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[]).includes(
    value as CandidateStatus,
  )
    ? (value as CandidateStatus)
    : 'running';
}

export async function initElectionAdmin(): Promise<void> {
  const gate = document.querySelector<HTMLElement>('[data-admin-gate]');
  const denied = document.querySelector<HTMLElement>('[data-admin-denied]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const electionForm = document.querySelector<HTMLFormElement>('[data-election-form]');
  const contestForm = document.querySelector<HTMLFormElement>('[data-contest-form]');
  const candidateForm = document.querySelector<HTMLFormElement>('[data-candidate-form]');
  const electionList = document.querySelector<HTMLElement>('[data-election-list]');
  const contestList = document.querySelector<HTMLElement>('[data-contest-list]');
  const candidateList = document.querySelector<HTMLElement>('[data-candidate-list]');
  if (
    !panel ||
    !electionForm ||
    !contestForm ||
    !candidateForm ||
    !electionList ||
    !contestList ||
    !candidateList
  ) {
    return;
  }

  const electionFormEl = electionForm;
  const contestFormEl = contestForm;
  const candidateFormEl = candidateForm;
  const electionListEl = electionList;
  const contestListEl = contestList;
  const candidateListEl = candidateList;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('/signin/?next=/admin/elections/');
    return;
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  gate?.remove();

  if (!adminRow) {
    if (denied) denied.hidden = false;
    return;
  }

  panel.hidden = false;

  // --- Element references ------------------------------------------------

  const electionId = electionFormEl.querySelector<HTMLInputElement>('input[name="id"]');
  const electionName = electionFormEl.querySelector<HTMLInputElement>('input[name="name"]');
  const electionSlug = electionFormEl.querySelector<HTMLInputElement>('input[name="slug"]');
  const electionOrg = electionFormEl.querySelector<HTMLSelectElement>(
    'select[name="organization_id"]',
  );
  const electionSubmit = electionFormEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const electionCancel = electionFormEl.querySelector<HTMLButtonElement>('[data-election-cancel]');
  const electionHeading = document.querySelector<HTMLElement>('[data-election-form-title]');

  const contestId = contestFormEl.querySelector<HTMLInputElement>('input[name="id"]');
  const contestElection = contestFormEl.querySelector<HTMLSelectElement>(
    'select[name="election_id"]',
  );
  const contestSubmit = contestFormEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const contestCancel = contestFormEl.querySelector<HTMLButtonElement>('[data-contest-cancel]');
  const contestHeading = document.querySelector<HTMLElement>('[data-contest-form-title]');
  const contestFilter = document.querySelector<HTMLSelectElement>('[data-contest-filter]');

  const candidateOriginalContest = candidateFormEl.querySelector<HTMLInputElement>(
    'input[name="original_contest_id"]',
  );
  const candidateOriginalPerson = candidateFormEl.querySelector<HTMLInputElement>(
    'input[name="original_person_id"]',
  );
  const candidateContest = candidateFormEl.querySelector<HTMLSelectElement>(
    'select[name="contest_id"]',
  );
  const candidatePerson = candidateFormEl.querySelector<HTMLSelectElement>(
    'select[name="person_id"]',
  );
  const candidateSubmit = candidateFormEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const candidateCancel = candidateFormEl.querySelector<HTMLButtonElement>('[data-candidate-cancel]');
  const candidateHeading = document.querySelector<HTMLElement>('[data-candidate-form-title]');

  // --- State -------------------------------------------------------------

  let elections: Election[] = [];
  let contests: ContestRow[] = [];
  let candidates: CandidateRow[] = [];
  let people: PersonRef[] = [];
  const organizationNames = new Map<string, string>();
  let slugTouched = false;

  // --- Lookups -----------------------------------------------------------

  async function loadOrganizations(): Promise<void> {
    const { data, error } = await supabase.from('organizations').select('id, name').order('name');

    if (error) {
      setMessage(electionFormEl, '[data-election-message]', error.message, 'error');
      return;
    }

    const organizations = (data ?? []) as { id: string; name: string }[];
    organizationNames.clear();
    for (const org of organizations) organizationNames.set(org.id, org.name);

    electionOrg?.replaceChildren(new Option('None', ''));
    for (const org of organizations) electionOrg?.append(new Option(org.name, org.id));
  }

  async function loadPeople(): Promise<void> {
    const { data, error } = await supabase.from('people').select('id, full_name').order('full_name');

    if (error) {
      setMessage(candidateFormEl, '[data-candidate-message]', error.message, 'error');
      return;
    }

    people = (data ?? []) as PersonRef[];
    candidatePerson?.replaceChildren(new Option('Select a person…', ''));
    for (const person of people) candidatePerson?.append(new Option(person.full_name, person.id));
    if (people.length === 1 && candidatePerson && !candidatePerson.value) {
      candidatePerson.value = people[0].id;
    }
  }

  async function loadElections(): Promise<void> {
    const { data, error } = await supabase
      .from('elections')
      .select(ELECTION_COLUMNS)
      .order('election_date', { ascending: false });

    if (error) {
      setMessage(electionListEl, '[data-election-message]', error.message, 'error');
      return;
    }

    elections = (data ?? []) as unknown as Election[];

    const options = elections
      .map((election) => [election.id, electionLabel(election)] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));

    for (const select of [contestElection, contestFilter]) {
      if (!select) continue;
      const first = select === contestFilter ? 'All elections' : 'Select an election…';
      select.replaceChildren(new Option(first, ''));
    }
    for (const [id, label] of options) {
      contestElection?.append(new Option(label, id));
      contestFilter?.append(new Option(label, id));
    }
    if (elections.length === 1 && contestElection && !contestElection.value) {
      contestElection.value = elections[0].id;
    }

    renderElectionList();
  }

  async function loadContests(): Promise<void> {
    const { data, error } = await supabase
      .from('contests')
      .select(CONTEST_COLUMNS)
      .order('position')
      .order('office');

    if (error) {
      setMessage(contestListEl, '[data-contest-message]', error.message, 'error');
      return;
    }

    contests = (data ?? []) as unknown as ContestRow[];

    candidateContest?.replaceChildren(new Option('Select a contest…', ''));
    for (const contest of [...contests].sort((a, b) =>
      contestLabel(a).localeCompare(contestLabel(b), undefined, { sensitivity: 'base' }),
    )) {
      candidateContest?.append(new Option(contestLabel(contest), contest.id));
    }
    if (contests.length === 1 && candidateContest && !candidateContest.value) {
      candidateContest.value = contests[0].id;
    }

    renderContestList();
    renderElectionList();
  }

  async function loadCandidates(): Promise<void> {
    const { data, error } = await supabase
      .from('contest_candidates')
      .select(CANDIDATE_COLUMNS)
      .order('position');

    if (error) {
      setMessage(candidateListEl, '[data-candidate-message]', error.message, 'error');
      return;
    }

    candidates = (data ?? []) as unknown as CandidateRow[];
    renderCandidateList();
    renderContestList();
  }

  // --- Labels ------------------------------------------------------------

  function electionLabel(election: Election): string {
    return `${election.name} — ${formatElectionDate(election.election_date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  function electionNameById(id: string): string {
    return elections.find((election) => election.id === id)?.name ?? 'Unknown election';
  }

  function contestLabel(contest: ContestRow): string {
    const office = [contest.office, contest.district, contest.seat].filter(Boolean).join(', ');
    return `${office} — ${electionNameById(contest.election_id)}`;
  }

  function personNameById(id: string): string {
    return people.find((person) => person.id === id)?.full_name ?? 'Unknown person';
  }

  // --- Election list -----------------------------------------------------

  function renderElectionList(): void {
    if (elections.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No elections yet. Add the first one above.';
      electionListEl.replaceChildren(empty);
      return;
    }

    electionListEl.replaceChildren(
      ...elections.map((election) => {
        const row = document.createElement('article');
        row.className = 'org-row';

        const info = document.createElement('div');
        info.className = 'org-row-info';
        const name = document.createElement('span');
        name.className = 'org-row-name';
        name.textContent = election.name;
        const meta = document.createElement('span');
        meta.className = 'org-row-meta';
        const count = contests.filter((contest) => contest.election_id === election.id).length;
        meta.textContent = `${formatElectionDate(election.election_date, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} · ${ELECTION_KIND_LABELS[election.kind]} · ${
          ELECTION_VISIBILITY_LABELS[election.visibility]
        } · ${count} contest${count === 1 ? '' : 's'}`;
        info.append(name, meta);
        row.append(info);

        const actions = document.createElement('div');
        actions.className = 'org-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => startElectionEdit(election));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => void removeElection(election));

        actions.append(edit, remove);
        row.append(actions);

        return row;
      }),
    );
  }

  function resetElectionForm(): void {
    electionFormEl.reset();
    if (electionId) electionId.value = '';
    slugTouched = false;
    if (electionCancel) electionCancel.hidden = true;
    if (electionHeading) electionHeading.textContent = 'Add an election';
    if (electionSubmit) electionSubmit.textContent = 'Create election';
  }

  function startElectionEdit(election: Election): void {
    if (!electionId) return;
    electionId.value = election.id;
    const set = (name: string, value: string | null) => {
      const field = electionFormEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`,
      );
      if (field) field.value = value ?? '';
    };
    set('name', election.name);
    set('slug', election.slug);
    set('election_date', election.election_date);
    set('description', election.description);
    const kind = electionFormEl.querySelector<HTMLSelectElement>('select[name="kind"]');
    const visibility = electionFormEl.querySelector<HTMLSelectElement>('select[name="visibility"]');
    if (kind) kind.value = election.kind;
    if (visibility) visibility.value = election.visibility;
    if (electionOrg) electionOrg.value = election.organization_id ?? '';
    slugTouched = true;
    if (electionCancel) electionCancel.hidden = false;
    if (electionHeading) electionHeading.textContent = `Editing ${election.name}`;
    if (electionSubmit) electionSubmit.textContent = 'Save changes';
    electionFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removeElection(election: Election): Promise<void> {
    if (
      !window.confirm(
        `Delete “${election.name}”? Its contests and candidate links are deleted too. This cannot be undone.`,
      )
    ) {
      return;
    }

    const { error } = await supabase.from('elections').delete().eq('id', election.id);
    if (error) {
      setMessage(electionListEl, '[data-election-message]', error.message, 'error');
      return;
    }

    setMessage(electionListEl, '[data-election-message]', 'Election deleted.', 'success');
    await loadElections();
    await loadContests();
    await loadCandidates();
  }

  async function saveElection(): Promise<void> {
    const values = new FormData(electionFormEl);
    const id = String(values.get('id') ?? '');
    const name = String(values.get('name') ?? '').trim();
    const slug = String(values.get('slug') ?? '').trim() || slugify(name);
    const electionDate = String(values.get('election_date') ?? '').trim();

    if (!name || !slug || !electionDate) {
      setMessage(
        electionFormEl,
        '[data-election-message]',
        'A name, valid slug, and election date are required.',
        'error',
      );
      return;
    }

    if (electionSubmit) electionSubmit.disabled = true;
    setMessage(electionFormEl, '[data-election-message]', 'Saving…');

    try {
      const payload = {
        slug,
        name,
        election_date: electionDate,
        kind: kindValue(String(values.get('kind') ?? 'general')),
        visibility: visibilityValue(String(values.get('visibility') ?? 'public')),
        organization_id: textOrNull(values.get('organization_id')),
        description: textOrNull(values.get('description')),
      };

      const { error } = id
        ? await supabase.from('elections').update(payload).eq('id', id)
        : await supabase.from('elections').insert(payload);

      if (error) throw new Error(error.message);

      setMessage(
        electionFormEl,
        '[data-election-message]',
        id ? 'Election updated.' : 'Election created.',
        'success',
      );
      resetElectionForm();
      await loadElections();
    } catch (error) {
      setMessage(
        electionFormEl,
        '[data-election-message]',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      if (electionSubmit) electionSubmit.disabled = false;
    }
  }

  // --- Contest list ------------------------------------------------------

  function renderContestList(): void {
    const filter = contestFilter?.value ?? '';
    const visible = contests.filter((contest) => !filter || contest.election_id === filter);

    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent =
        contests.length === 0
          ? 'No contests yet. Add the first one above.'
          : 'No contests on that election.';
      contestListEl.replaceChildren(empty);
      return;
    }

    contestListEl.replaceChildren(
      ...visible.map((contest) => {
        const row = document.createElement('article');
        row.className = 'org-row';

        const info = document.createElement('div');
        info.className = 'org-row-info';
        const name = document.createElement('span');
        name.className = 'org-row-name';
        name.textContent = [contest.office, contest.district, contest.seat]
          .filter(Boolean)
          .join(', ');
        const meta = document.createElement('span');
        meta.className = 'org-row-meta';
        const count = candidates.filter((candidate) => candidate.contest_id === contest.id).length;
        meta.textContent = `${electionNameById(contest.election_id)} · ${
          contest.partisan ? 'Partisan' : 'Nonpartisan'
        } · ${count} candidate${count === 1 ? '' : 's'}`;
        info.append(name, meta);
        row.append(info);

        const actions = document.createElement('div');
        actions.className = 'org-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => startContestEdit(contest));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => void removeContest(contest));

        actions.append(edit, remove);
        row.append(actions);

        return row;
      }),
    );
  }

  function resetContestForm(): void {
    contestFormEl.reset();
    if (contestId) contestId.value = '';
    if (contestCancel) contestCancel.hidden = true;
    if (contestHeading) contestHeading.textContent = 'Add a contest';
    if (contestSubmit) contestSubmit.textContent = 'Create contest';
  }

  function startContestEdit(contest: ContestRow): void {
    if (!contestId) return;
    contestId.value = contest.id;
    if (contestElection) contestElection.value = contest.election_id;
    const set = (name: string, value: string | number | null) => {
      const field = contestFormEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`,
      );
      if (field) field.value = value === null ? '' : String(value);
    };
    set('office', contest.office);
    set('district', contest.district);
    set('seat', contest.seat);
    set('description', contest.description);
    set('position', contest.position);
    const partisan = contestFormEl.querySelector<HTMLInputElement>('input[name="partisan"]');
    if (partisan) partisan.checked = contest.partisan;
    if (contestCancel) contestCancel.hidden = false;
    if (contestHeading) contestHeading.textContent = `Editing ${contest.office}`;
    if (contestSubmit) contestSubmit.textContent = 'Save changes';
    contestFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removeContest(contest: ContestRow): Promise<void> {
    if (
      !window.confirm(
        `Delete the “${contest.office}” contest? Its candidate links are deleted too.`,
      )
    ) {
      return;
    }

    const { error } = await supabase.from('contests').delete().eq('id', contest.id);
    if (error) {
      setMessage(contestListEl, '[data-contest-message]', error.message, 'error');
      return;
    }

    setMessage(contestListEl, '[data-contest-message]', 'Contest deleted.', 'success');
    await loadContests();
    await loadCandidates();
  }

  async function saveContest(): Promise<void> {
    const values = new FormData(contestFormEl);
    const id = String(values.get('id') ?? '');
    const electionId = String(values.get('election_id') ?? '').trim();
    const office = String(values.get('office') ?? '').trim();

    if (!electionId || !office) {
      setMessage(
        contestFormEl,
        '[data-contest-message]',
        'An election and office are required.',
        'error',
      );
      return;
    }

    if (contestSubmit) contestSubmit.disabled = true;
    setMessage(contestFormEl, '[data-contest-message]', 'Saving…');

    try {
      const payload = {
        election_id: electionId,
        office,
        district: textOrNull(values.get('district')),
        seat: textOrNull(values.get('seat')),
        description: textOrNull(values.get('description')),
        partisan: values.get('partisan') !== null,
        position: intValue(values.get('position')),
      };

      const { error } = id
        ? await supabase.from('contests').update(payload).eq('id', id)
        : await supabase.from('contests').insert(payload);

      if (error) throw new Error(error.message);

      setMessage(
        contestFormEl,
        '[data-contest-message]',
        id ? 'Contest updated.' : 'Contest created.',
        'success',
      );
      resetContestForm();
      await loadContests();
    } catch (error) {
      setMessage(
        contestFormEl,
        '[data-contest-message]',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      if (contestSubmit) contestSubmit.disabled = false;
    }
  }

  // --- Candidate list ----------------------------------------------------

  function candidateContestLabel(contestId: string): string {
    const contest = contests.find((item) => item.id === contestId);
    return contest ? contestLabel(contest) : 'Unknown contest';
  }

  function renderCandidateList(): void {
    const sorted = [...candidates].sort((a, b) => {
      const byContest = candidateContestLabel(a.contest_id).localeCompare(
        candidateContestLabel(b.contest_id),
        undefined,
        { sensitivity: 'base' },
      );
      if (byContest !== 0) return byContest;
      return personNameById(a.person_id).localeCompare(personNameById(b.person_id), undefined, {
        sensitivity: 'base',
      });
    });

    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No candidates yet. Add the first one above.';
      candidateListEl.replaceChildren(empty);
      return;
    }

    candidateListEl.replaceChildren(
      ...sorted.map((candidate) => {
        const row = document.createElement('article');
        row.className = 'org-row';

        const info = document.createElement('div');
        info.className = 'org-row-info';
        const name = document.createElement('span');
        name.className = 'org-row-name';
        name.textContent = personNameById(candidate.person_id);
        const meta = document.createElement('span');
        meta.className = 'org-row-meta';
        meta.textContent = `${candidateContestLabel(candidate.contest_id)} · ${
          CANDIDATE_STATUS_LABELS[candidate.status]
        }${candidate.party ? ` · ${candidate.party}` : ''}`;
        info.append(name, meta);
        row.append(info);

        const actions = document.createElement('div');
        actions.className = 'org-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => startCandidateEdit(candidate));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => void removeCandidate(candidate));

        actions.append(edit, remove);
        row.append(actions);

        return row;
      }),
    );
  }

  function resetCandidateForm(): void {
    candidateFormEl.reset();
    if (candidateOriginalContest) candidateOriginalContest.value = '';
    if (candidateOriginalPerson) candidateOriginalPerson.value = '';
    if (candidateCancel) candidateCancel.hidden = true;
    if (candidateHeading) candidateHeading.textContent = 'Add a candidate';
    if (candidateSubmit) candidateSubmit.textContent = 'Add candidate';
  }

  function startCandidateEdit(candidate: CandidateRow): void {
    if (!candidateOriginalContest || !candidateOriginalPerson) return;
    candidateOriginalContest.value = candidate.contest_id;
    candidateOriginalPerson.value = candidate.person_id;
    if (candidateContest) candidateContest.value = candidate.contest_id;
    if (candidatePerson) candidatePerson.value = candidate.person_id;
    const party = candidateFormEl.querySelector<HTMLInputElement>('input[name="party"]');
    const position = candidateFormEl.querySelector<HTMLInputElement>('input[name="position"]');
    const status = candidateFormEl.querySelector<HTMLSelectElement>('select[name="status"]');
    if (party) party.value = candidate.party ?? '';
    if (position) position.value = String(candidate.position);
    if (status) status.value = candidate.status;
    if (candidateCancel) candidateCancel.hidden = false;
    if (candidateHeading) candidateHeading.textContent = `Editing ${personNameById(candidate.person_id)}`;
    if (candidateSubmit) candidateSubmit.textContent = 'Save candidate';
    candidateFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removeCandidate(candidate: CandidateRow): Promise<void> {
    if (!window.confirm(`Remove ${personNameById(candidate.person_id)} from this contest?`)) return;

    const { error } = await supabase
      .from('contest_candidates')
      .delete()
      .eq('contest_id', candidate.contest_id)
      .eq('person_id', candidate.person_id);

    if (error) {
      setMessage(candidateListEl, '[data-candidate-message]', error.message, 'error');
      return;
    }

    setMessage(candidateListEl, '[data-candidate-message]', 'Candidate removed.', 'success');
    await loadCandidates();
  }

  async function saveCandidate(): Promise<void> {
    const values = new FormData(candidateFormEl);
    const contestIdValue = String(values.get('contest_id') ?? '').trim();
    const personIdValue = String(values.get('person_id') ?? '').trim();
    const originalContest = String(values.get('original_contest_id') ?? '').trim();
    const originalPerson = String(values.get('original_person_id') ?? '').trim();

    if (!contestIdValue || !personIdValue) {
      setMessage(
        candidateFormEl,
        '[data-candidate-message]',
        'A contest and person are required.',
        'error',
      );
      return;
    }

    if (candidateSubmit) candidateSubmit.disabled = true;
    setMessage(candidateFormEl, '[data-candidate-message]', 'Saving…');

    try {
      if (
        originalContest &&
        originalPerson &&
        (originalContest !== contestIdValue || originalPerson !== personIdValue)
      ) {
        const { error: deleteError } = await supabase
          .from('contest_candidates')
          .delete()
          .eq('contest_id', originalContest)
          .eq('person_id', originalPerson);
        if (deleteError) throw new Error(deleteError.message);
      }

      const { error } = await supabase.from('contest_candidates').upsert(
        {
          contest_id: contestIdValue,
          person_id: personIdValue,
          party: textOrNull(values.get('party')),
          status: candidateStatusValue(String(values.get('status') ?? 'running')),
          position: intValue(values.get('position')),
        },
        { onConflict: 'contest_id,person_id' },
      );

      if (error) throw new Error(error.message);

      setMessage(
        candidateFormEl,
        '[data-candidate-message]',
        originalContest ? 'Candidate updated.' : 'Candidate added.',
        'success',
      );
      resetCandidateForm();
      await loadCandidates();
    } catch (error) {
      setMessage(
        candidateFormEl,
        '[data-candidate-message]',
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      if (candidateSubmit) candidateSubmit.disabled = false;
    }
  }

  // --- Wiring ------------------------------------------------------------

  electionName?.addEventListener('input', () => {
    if (!electionSlug || slugTouched || electionId?.value) return;
    electionSlug.value = slugify(electionName.value);
  });
  electionSlug?.addEventListener('input', () => {
    slugTouched = true;
  });

  electionFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveElection();
  });
  contestFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveContest();
  });
  candidateFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveCandidate();
  });

  electionCancel?.addEventListener('click', resetElectionForm);
  contestCancel?.addEventListener('click', resetContestForm);
  candidateCancel?.addEventListener('click', resetCandidateForm);
  contestFilter?.addEventListener('change', renderContestList);

  await loadOrganizations();
  await loadPeople();
  await loadElections();
  await loadContests();
  await loadCandidates();

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const editContestId = params.get('editContest');
  if (editContestId) {
    const match = contests.find((contest) => contest.id === editContestId);
    if (match) startContestEdit(match);
  } else if (editId) {
    const match = elections.find((election) => election.id === editId);
    if (match) startElectionEdit(match);
  }
}

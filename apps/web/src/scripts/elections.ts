import { initElectionPrecinctTurnout } from './precinct-turnout';
import { initElectionTurnout } from './election-turnout';
import { readDirectory } from './directory-data';
import { selectedCounty, readCountyIndex } from './county-filter';
import { GEORGIA_COUNTIES, matchesCounty } from '../lib/county-scope';
import { orderElections, searchDirectory } from '../lib/directories';
import { historyLink } from '../lib/history';
import { isBibbContest, isBibbJurisdiction } from '../lib/election-scope';
import { formatEventWhen } from '../lib/calendars';
import {
  electionHref,
  formatElectionDate,
  CANDIDATE_STATUS_LABELS,
  ELECTION_DATE_KIND_LABELS,
  ELECTION_DATE_KIND_ORDER,
  ELECTION_KIND_LABELS,
  ELECTION_VISIBILITY_LABELS,
  type BallotQuestion,
  type Election,
  type ElectionContest,
  type ElectionDate,
  type ElectionDateKind,
  type ElectionDetail,
} from '../lib/elections';
import { personHref, personImageUrl } from '../lib/people';
import { getSupabase } from '../lib/supabase';
import { isCurrentUserAdmin } from './auth';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function visibilityBadge(visibility: Election['visibility']): HTMLElement | null {
  if (visibility === 'public') return null;
  const badge = document.createElement('span');
  badge.className = 'visibility-badge';
  badge.textContent = ELECTION_VISIBILITY_LABELS[visibility] ?? 'Public';
  return badge;
}

function renderElectionCard(election: Election): HTMLElement {
  const card = document.createElement('a');
  card.className = 'org-card election-card';
  card.href = electionHref(election);

  const date = document.createElement('span');
  date.className = 'election-card-date';
  date.textContent = formatElectionDate(election.election_date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  card.append(date);

  const name = document.createElement('h2');
  name.textContent = election.name;
  card.append(name);

  const badge = visibilityBadge(election.visibility);
  if (badge) card.append(badge);

  const kind = document.createElement('span');
  kind.className = 'election-card-kind';
  kind.textContent = ELECTION_KIND_LABELS[election.kind] ?? 'Election';
  card.append(kind);

  if (election.description) {
    const description = document.createElement('p');
    description.textContent = election.description;
    card.append(description);
  }

  return card;
}

/** Public elections use static search; signed-in access stays with the existing RPC. */
export function initElectionSearch(): void {
  const input = document.querySelector<HTMLInputElement>('[data-election-search]');
  const initial = document.querySelector<HTMLElement>('[data-election-initial]');
  const results = document.querySelector<HTMLElement>('[data-election-search-results]');
  const status = document.querySelector<HTMLElement>('[data-election-search-status]');
  const empty = document.querySelector<HTMLElement>('[data-election-search-empty]');
  const note = document.querySelector<HTMLElement>('[data-election-search-note]');
  if (!input || !results) return;

  const inputEl = input;
  const resultsEl = results;
  const supabase = getSupabase();
  let signedIn = false;
  let timer: number | undefined;
  let requestId = 0;

  async function search(query: string): Promise<void> {
    const id = ++requestId;
    if (status) { status.textContent = query ? 'Searching…' : 'Loading elections…'; status.hidden = false; }
    if (empty) empty.hidden = true;
    try {
      const snapshot = await readDirectory('elections');
      const {data,error} = snapshot
        ? {data: query ? searchDirectory(snapshot,query).slice(0,50) : orderElections(snapshot.map(entry=>entry.record)), error:null}
        : await supabase.rpc('search_elections',{p_query:query,p_limit:query ? 50 : 100});
      if (id !== requestId) return;
      if (error) throw error;
      const elections = (data ?? []) as unknown as Election[];
      resultsEl.replaceChildren(...elections.map(renderElectionCard));
      resultsEl.hidden = elections.length === 0;
      if (empty) empty.hidden = elections.length > 0;
      if (initial) initial.hidden = true;
      if (status) status.textContent = query
        ? `${elections.length} result${elections.length === 1 ? '' : 's'}`
        : `${elections.length} election${elections.length === 1 ? '' : 's'} available${signedIn ? ' (includes unlisted and private)' : ''}`;
    } catch (error) {
      if (id !== requestId) return;
      resultsEl.hidden = true;
      if (status) status.textContent = `Could not load elections: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  inputEl.addEventListener('input', () => {
    ++requestId;
    const query = inputEl.value.trim();
    window.clearTimeout(timer);

    if (!query) {
      void search('');
      return;
    }

    if (initial) initial.hidden = true;
    timer = window.setTimeout(() => void search(query), 200);
  });
  window.addEventListener('countychange', () => void search(inputEl.value.trim()));

  inputEl.closest('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    const query = inputEl.value.trim();
    if (query) void search(query);
    else void search('');
  });

  void supabase.auth.getSession().then(({ data: { session } }) => {
    signedIn = Boolean(session);
    if (signedIn && note) note.hidden = false;
    if (inputEl.value.trim()) void search(inputEl.value.trim());
    else void search('');
  });
}

// --- Shared election viewer ---------------------------------------------

interface ElectionViewResponse {
  status?: string;
  election?: Election;
  organization?: ElectionDetail['organization'];
  contests?: ElectionContest[];
  ballot_questions?: BallotQuestion[];
  dates?: ElectionDate[];
}

function electionIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/elections\/[up]\/([0-9a-f-]{36})\/?$/i);
  return match ? match[1] : null;
}

function showViewerStatus(root: HTMLElement, text: string, signIn = false): void {
  root.replaceChildren();

  const message = document.createElement('p');
  message.textContent = text;
  root.append(message);

  if (signIn) {
    const link = document.createElement('a');
    link.className = 'button-link';
    link.href = `/signin/?next=${encodeURIComponent(
      window.location.pathname + window.location.search,
    )}`;
    link.textContent = 'Sign in';
    root.append(link);
  }

  root.hidden = false;
}

function buildCandidateCard(
  candidate: ElectionContest['candidates'][number],
): HTMLElement {
  const link = document.createElement('a');
  link.className = 'candidate-card';
  link.href = personHref(candidate.person);

  const image = personImageUrl(candidate.person.image_path);
  if (image) {
    const img = document.createElement('img');
    img.className = 'candidate-image';
    img.src = image;
    img.alt = '';
    img.width = 44;
    img.height = 44;
    link.append(img);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'candidate-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = initials(candidate.person.full_name);
    link.append(fallback);
  }

  const text = document.createElement('span');
  text.className = 'candidate-text';

  const name = document.createElement('span');
  name.className = 'candidate-name';
  name.textContent = candidate.person.full_name;
  text.append(name);

  if (candidate.is_write_in) {
    const badge = document.createElement('span');
    badge.className = 'candidate-write-in';
    badge.textContent = 'Certified write-in';
    text.append(badge);
  }

  const meta = document.createElement('span');
  meta.className = 'candidate-meta';
  meta.textContent = [candidate.party, CANDIDATE_STATUS_LABELS[candidate.status]]
    .filter(Boolean)
    .join(' · ');
  text.append(meta);

  link.append(text);
  return link;
}

function buildContest(contest: ElectionContest): HTMLElement {
  const card = document.createElement('article');
  card.className = 'contest-card';
  card.id = `contest-${contest.id}`;
  card.dataset.bibbRelevant = String(isBibbContest(contest));

  const header = document.createElement('header');
  header.className = 'contest-heading';

  const heading = document.createElement('h3');
  let label = [contest.office, contest.district].filter(Boolean).join(', ');
  if (contest.seat) label += ` — ${contest.seat}`;
  heading.textContent = label;
  header.append(heading);

  const meta = document.createElement('span');
  meta.className = 'contest-meta';
  meta.textContent = contest.partisan ? 'Partisan race' : 'Nonpartisan race';
  header.append(meta);
  card.append(header);

  if (contest.description) {
    const description = document.createElement('p');
    description.className = 'contest-description';
    description.textContent = contest.description;
    card.append(description);
  }

  if (contest.candidates.length > 0) {
    const list = document.createElement('div');
    list.className = 'candidate-list';
    list.append(...contest.candidates.map(buildCandidateCard));
    card.append(list);
  } else {
    const empty = document.createElement('p');
    empty.className = 'status';
    empty.textContent = 'No candidates listed yet.';
    card.append(empty);
  }

  card.append(historyLink('contests', contest.id));
  return card;
}

function buildBallotQuestion(question: BallotQuestion): HTMLElement {
  const card = document.createElement('article');
  card.className = 'contest-card ballot-question';
  card.id = `question-${question.id}`;
  card.dataset.bibbRelevant = String(isBibbJurisdiction(question.jurisdiction));
  const header = document.createElement('header'); header.className = 'contest-heading';
  const title = document.createElement('h3'); title.textContent = question.title;
  const meta = document.createElement('span'); meta.className = 'contest-meta';
  meta.textContent = ['Ballot question', question.jurisdiction].filter(Boolean).join(' · ');
  header.append(title, meta); card.append(header);
  const wording = document.createElement('p'); wording.className = 'ballot-question-text'; wording.textContent = question.question_text; card.append(wording);
  if (question.description) {
    const description = document.createElement('p'); description.className = 'contest-description'; description.textContent = question.description; card.append(description);
  }
  const label = document.createElement('p'); label.className = 'body-note'; label.textContent = 'Response choices'; card.append(label);
  const choices = document.createElement('ul'); choices.className = 'ballot-question-choices';
  for (const choice of question.choices) { const item = document.createElement('li'); item.textContent = choice; choices.append(item); }
  card.append(choices);
  if (question.source_url && /^https?:\/\//i.test(question.source_url)) {
    const paragraph = document.createElement('p'); const link = document.createElement('a'); link.href = question.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Official source ↗'; paragraph.append(link); card.append(paragraph);
  }
  card.append(historyLink('ballot_questions', question.id));
  return card;
}

function buildDateGroups(dates: ElectionDate[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'election-date-groups';

  for (const kind of ELECTION_DATE_KIND_ORDER) {
    const inGroup = dates.filter((date) => (date.election_date_kind ?? 'other') === kind);
    if (inGroup.length === 0) continue;

    const group = document.createElement('div');
    group.className = 'election-date-group';

    const heading = document.createElement('h3');
    heading.textContent = ELECTION_DATE_KIND_LABELS[kind as ElectionDateKind];
    group.append(heading);

    const list = document.createElement('ul');
    list.className = 'election-date-list';
    for (const date of inGroup) {
      const item = document.createElement('li');
      item.className = 'election-date-item';

      const when = document.createElement('a');
      when.className = 'election-date-when';
      when.href = `/calendar/view/?id=${date.id}`;
      when.textContent = formatEventWhen(date);
      item.append(when);

      const title = document.createElement('span');
      title.className = 'election-date-title';
      title.textContent = date.title;
      item.append(title);

      if (date.location) {
        const location = document.createElement('span');
        location.className = 'election-date-location';
        location.textContent = date.location;
        item.append(location);
      }

      list.append(item);
    }

    group.append(list);
    container.append(group);
  }

  return container;
}

function fillElectionView(response: ElectionViewResponse): void {
  const viewer = document.querySelector<HTMLElement>('[data-election-viewer]');
  const election = response.election;
  if (!viewer || !election) return;

  const setText = (selector: string, value: string | null | undefined): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value ?? '';
  };

  setText('[data-election-kind]', ELECTION_KIND_LABELS[election.kind] ?? 'Election');
  setText('[data-election-name]', election.name);
  setText('[data-election-date]', formatElectionDate(election.election_date));

  const org = document.querySelector<HTMLElement>('[data-election-org]');
  if (org) {
    org.replaceChildren();
    if (response.organization) {
      org.append('Administered by ');
      const link = document.createElement('a');
      link.href = `/orgs/${response.organization.slug}/`;
      link.textContent = response.organization.name;
      org.append(link);
      org.hidden = false;
    } else {
      org.hidden = true;
    }
  }

  const description = document.querySelector<HTMLElement>('[data-election-description]');
  if (description) {
    description.textContent = election.description ?? '';
    description.hidden = !election.description;
  }

  const dates = response.dates ?? [];
  const datesSection = document.querySelector<HTMLElement>('[data-election-dates-section]');
  const datesContainer = document.querySelector<HTMLElement>('[data-election-dates]');
  if (datesSection && datesContainer) {
    datesContainer.replaceChildren();
    if (dates.length > 0) {
      datesContainer.append(buildDateGroups(dates));
      datesSection.hidden = false;
    } else {
      datesSection.hidden = true;
    }
  }

  const contests = response.contests ?? [];
  const questions = response.ballot_questions ?? [];
  const contestsSection = document.querySelector<HTMLElement>('[data-election-contests-section]');
  const contestsContainer = document.querySelector<HTMLElement>('[data-election-contests]');
  if (contestsSection && contestsContainer) {
    contestsContainer.replaceChildren();
    if (contests.length > 0 || questions.length > 0) {
      contestsContainer.append(...contests.map(buildContest), ...questions.map(buildBallotQuestion));
      contestsSection.hidden = false;
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const message = document.createElement('p');
      message.textContent = 'No races or ballot questions have been published for this election yet.';
      empty.append(message);
      contestsContainer.append(empty);
      contestsSection.hidden = false;
    }
  }

  viewer.hidden = false;
  initElectionScope();
  if (/^#(?:contest|question)-[0-9a-f-]{36}$/i.test(window.location.hash)) {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }
}

/** Scope only the rendered ballot; RPCs, admin editing and search keep all data. */
export async function initElectionScope(): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>('[data-election-scope]');
  if (!select) return;
  const cards = [...document.querySelectorAll<HTMLElement>('[data-bibb-relevant]')];
  let index;
  try { index = await readCountyIndex(); } catch { return; }
  const countyIndex = index;
  function resetScope() {
    const county = selectedCounty();
    select!.options[0].textContent = `${GEORGIA_COUNTIES.find(item => item.fips === county)?.name ?? 'Selected'} County races`;
    select!.value = county === 'all' ? 'all' : 'bibb';
    select!.options[0].disabled = county === 'all';
  }
  resetScope();
  const empty = document.querySelector<HTMLElement>('[data-election-scope-empty]');
  function apply() {
    for (const card of cards) {
      const [kind, ...parts] = card.id.split('-');
      const relevant = selectedCounty() === '13021' ? card.dataset.bibbRelevant === 'true'
        : matchesCounty(countyIndex, kind === 'question' ? 'ballot_question' : kind, parts.join('-'), selectedCounty());
      card.hidden = select!.value !== 'all' && !relevant;
    }
    if (empty) empty.hidden = cards.length === 0 || cards.some(card => !card.hidden);
  }
  function revealLinkedRace() {
    if (!/^#(?:contest|question)-[0-9a-f-]{36}$/i.test(window.location.hash)) return;
    const target = cards.find(card => `#${card.id}` === window.location.hash);
    if (!target) return;
    apply();
    if (target.hidden) select!.value = 'all';
    apply();
    target.scrollIntoView();
  }
  select.onchange = apply;
  window.addEventListener('countychange', () => {
    resetScope();
    apply();
    revealLinkedRace();
  });
  apply();
  revealLinkedRace();
  window.addEventListener('hashchange', revealLinkedRace);
}

/** Viewer for any election uuid (public, unlisted, or private). */
export async function initElectionViewFromUrl(): Promise<void> {
  const viewer = document.querySelector<HTMLElement>('[data-election-viewer]');
  const status = document.querySelector<HTMLElement>('[data-election-viewer-status]');
  if (!viewer || !status) return;

  const id =
    electionIdFromPath(window.location.pathname) ??
    new URLSearchParams(window.location.search).get('id');

  if (!id) {
    showViewerStatus(status, 'Election not found.');
    return;
  }

  const { data, error } = await getSupabase().rpc('get_election', { p_id: id });
  const response = data as ElectionViewResponse | null;

  if (error || !response || response.status === 'missing') {
    showViewerStatus(status, 'Election not found.');
    return;
  }

  if (response.status === 'private') {
    showViewerStatus(status, 'This election is private. An admin account is required to view it.', true);
    return;
  }

  status.hidden = true;
  fillElectionView(response);
  const turnoutReady = response.election ? Promise.allSettled([
    initElectionTurnout(response.election.id),
    initElectionPrecinctTurnout(response.election.id),
  ]) : Promise.resolve();

  if (response.election) {
    const electionId = response.election.id;
    void isCurrentUserAdmin().then(isAdmin => {
      const edit = document.querySelector<HTMLAnchorElement>('[data-election-edit-link]');
      if (isAdmin && edit) {
        edit.href = `/admin/elections/?edit=${electionId}`;
        edit.hidden = false;
      }
    }).catch(() => { /* Optional edit controls remain hidden if the lookup fails. */ });
  }
  await turnoutReady;
}

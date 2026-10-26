import { getPublicProfileSnapshot } from "../lib/profile-section-data";
import { historyLink } from '../lib/history';
import { CANDIDATE_STATUS_LABELS, electionHref, formatElectionDate } from '../lib/elections';
import type { PersonCandidacy } from '../lib/people';
import { getSupabase } from '../lib/supabase';

function renderCandidacy(race: PersonCandidacy, personId: string): HTMLLIElement {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'org-card person-candidacy-card';
  link.href = electionHref({
    id: race.election_id, slug: race.election_slug, visibility: race.election_visibility,
  });
  const office = document.createElement('h4');
  office.textContent = [race.office, race.district, race.seat].filter(Boolean).join(' · ');
  const election = document.createElement('span');
  election.textContent = race.election_name;
  const date = document.createElement('time');
  date.dateTime = race.election_date;
  date.textContent = formatElectionDate(race.election_date, { month: 'long', day: 'numeric', year: 'numeric' });
  const meta = document.createElement('span');
  meta.className = 'candidate-meta';
  meta.textContent = [race.party, CANDIDATE_STATUS_LABELS[race.status]].filter(Boolean).join(' · ');
  link.append(office, election, date, meta);
  if (race.is_write_in) {
    const badge = document.createElement('span');
    badge.className = 'candidate-write-in';
    badge.textContent = 'Certified write-in';
    link.append(badge);
  }
  item.append(link, historyLink('contest_candidates', JSON.stringify({contest_id: race.contest_id, person_id: personId})));
  return item;
}

/** Published public races use current browser dates; restricted views retain live access checks. */
export async function loadPersonCandidacies(personId: string): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-person-candidacies]');
  if (!root) return;
  const status = root.querySelector<HTMLElement>('[data-candidacies-status]')!;
  const groups = root.querySelector<HTMLElement>('[data-candidacy-groups]')!;
  root.hidden = false;
  groups.hidden = true;
  status.hidden = false;
  status.textContent = 'Loading candidacies…';
  try {
    const supabase = getSupabase();
    await supabase.auth.getSession();
    const snapshot = await getPublicProfileSnapshot();
    const { data, error } = snapshot ? {data: snapshot.candidacies, error: null} : await supabase.rpc('get_person_candidacies', { p_person_id: personId });
    if (error) throw error;
    const races = (data ?? []) as PersonCandidacy[];
    for (const [key, current] of [['current', true], ['past', false]] as const) {
      const selected = races.filter((race) => race.is_current === current);
      root.querySelector(`[data-${key}-candidacies]`)!.replaceChildren(...selected.map(race => renderCandidacy(race, personId)));
      root.querySelector<HTMLElement>(`[data-${key}-candidacies-empty]`)!.hidden = selected.length > 0;
    }
    status.hidden = true;
    groups.hidden = false;
    root.hidden = races.length === 0;
  } catch {
    status.textContent = 'Could not load candidacies. Please reload to try again.';
  }
}

export function initPersonCandidacies(): void {
  const personId = document.querySelector<HTMLElement>('[data-person-candidacies]')?.dataset.personId;
  if (personId) void loadPersonCandidacies(personId);
}

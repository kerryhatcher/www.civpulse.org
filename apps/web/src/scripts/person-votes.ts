import { getSupabase } from '../lib/supabase';

export interface PersonVote {
  vote_id: string; meeting_id: string; meeting_title: string; starts_at: string;
  organization_name: string; subject: string; description: string | null;
  outcome: string | null; choice: string;
}

function renderVote(vote: PersonVote): HTMLElement {
  const article = document.createElement('article');
  const heading = document.createElement('h3');
  heading.textContent = vote.subject;
  const result = document.createElement('p');
  const choice = document.createElement('strong');
  choice.textContent = `Vote: ${vote.choice}`;
  result.append(choice, ` · Outcome: ${vote.outcome ?? 'Not recorded'}`);
  const meeting = document.createElement('p');
  const link = document.createElement('a');
  link.href = `/calendar/view/?id=${encodeURIComponent(vote.meeting_id)}#vote-${vote.vote_id}`;
  link.textContent = vote.meeting_title;
  const date = document.createElement('time');
  date.dateTime = vote.starts_at;
  date.textContent = new Date(vote.starts_at).toLocaleString('en-US', {
    timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
  });
  meeting.append(link, ' · ', date, ` · ${vote.organization_name}`);
  article.append(heading, result, meeting);
  if (vote.description) {
    const detail = document.createElement('p');
    detail.textContent = vote.description; article.append(detail);
  }
  return article;
}

/** Runtime only: never embed private or unlisted meetings in public profile HTML. */
export async function loadPersonVotes(personId: string): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-person-votes]');
  if (!root) return;
  const status = root.querySelector<HTMLElement>('[data-person-votes-status]')!;
  const list = root.querySelector<HTMLElement>('[data-person-votes-list]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-person-votes-more]')!;
  let offset = 0;
  let loading = false;
  list.replaceChildren(); root.hidden = false;
  const load = async () => {
    if (loading) return;
    loading = true; more.disabled = true; status.hidden = false;
    status.textContent = 'Loading voting record…';
    try {
      const supabase = getSupabase();
      await supabase.auth.getSession();
      const { data, error } = await supabase.rpc('get_person_votes', {
        p_person_id: personId, p_offset: offset, p_limit: 21,
      });
      if (error) throw error;
      const votes = (data ?? []) as PersonVote[];
      const page = votes.slice(0, 20);
      list.append(...page.map(renderVote)); offset += page.length;
      more.hidden = votes.length <= 20;
      status.textContent = offset ? '' : 'No votes recorded.';
      status.hidden = offset > 0;
    } catch {
      status.textContent = 'Could not load votes. Select Retry to try again.';
      more.hidden = false; more.textContent = 'Retry';
      return;
    } finally { loading = false; more.disabled = false; }
    more.textContent = 'Load more votes';
  };
  more.onclick = () => void load();
  await load();
}

export function initPersonVotes(): void {
  const id = document.querySelector<HTMLElement>('[data-person-votes]')?.dataset.personId;
  if (id) void loadPersonVotes(id);
}

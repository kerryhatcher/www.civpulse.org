import { civicDate, isElectionCalloutActive } from '../lib/election-callout';

export function initHomeElections(): void {
  const callouts = document.querySelectorAll<HTMLElement>('[data-election-callout]');
  const upcoming = document.querySelectorAll<HTMLElement>('[data-upcoming-election]');
  const empty = document.querySelector<HTMLElement>('[data-home-elections-empty]');

  function refresh(): void {
    const today = civicDate(new Date());
    let shown = 0;
    for (const item of upcoming) {
      const date = item.dataset.electionDay;
      item.hidden = !date || date < today || shown >= 3;
      if (!item.hidden) shown++;
    }
    if (empty) empty.hidden = shown > 0;
    for (const callout of callouts) {
      const { startsOn, electionDay, earlyVoting } = callout.dataset;
      callout.hidden = !startsOn || !electionDay || !isElectionCalloutActive(startsOn, electionDay, today);
      const status = callout.querySelector<HTMLElement>('[data-voting-status]');
      if (status) status.textContent = today === electionDay ? 'Election Day is today.' :
        earlyVoting && today < earlyVoting ? 'Early voting starts soon.' : 'Make your plan to vote.';
    }
  }

  refresh();
  // Refresh long-lived tabs across the start/end boundary, and on return.
  window.setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', refresh);
}

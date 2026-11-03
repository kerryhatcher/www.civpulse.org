import { voteMetrics } from '../lib/vote-metrics';
export function buildVoteMetrics(count?: unknown, counts: unknown[] = [], source?: string) {
  const metrics = voteMetrics(count, counts);
  const root = document.createElement('span'); root.className = 'vote-metrics';
  const values = document.createElement('span'); values.className = 'vote-metrics-values';
  for (const [label, value] of [['Vote share ', metrics.percentLabel], ['Votes ', metrics.votesLabel]]) {
    const group = document.createElement('span'), heading = document.createElement('span');
    heading.className = 'vote-metrics-label'; heading.textContent = label; group.append(heading, value); values.append(group);
  }
  const track = document.createElement('span'), fill = document.createElement('span');
  track.className = 'vote-share-track'; track.setAttribute('aria-hidden', 'true'); fill.className = 'vote-share-fill'; fill.style.width = `${metrics.percent ?? 0}%`; track.append(fill); root.append(values, track);
  if (source) { const note = document.createElement('span'); note.className = 'vote-metrics-source'; note.textContent = source; root.append(note); }
  return root;
}

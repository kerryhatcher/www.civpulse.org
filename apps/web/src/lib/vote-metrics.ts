/** Counts and shares belong to one complete contest in one reporting scope. */
export function voteMetrics(value: unknown, counts: readonly unknown[] = []) {
  const valid = (count: unknown): count is number => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
  const votes = valid(value) ? value : null;
  let total: number | null = counts.length && counts.every(valid) ? 0 : null;
  if (total !== null) for (const count of counts as number[]) {
    total += count;
    if (!Number.isSafeInteger(total)) { total = null; break; }
  }
  const percent = votes !== null && total !== null && votes <= total ? (total === 0 ? 0 : votes / total * 100) : null;
  return { votes, percent, votesLabel: votes === null ? 'Not available' : votes.toLocaleString('en-US'), percentLabel: percent === null ? 'Not available' : `${percent.toFixed(2)}%` };
}

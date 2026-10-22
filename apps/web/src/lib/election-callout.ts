/** Civic dates follow Macon–Bibb time, including for visitors elsewhere. */
export function civicDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
}

/** Calendar arithmetic in UTC avoids DST changing a seven-day window. */
export function electionCalloutStart(earlyVotingDate: string): string {
  const date = new Date(`${earlyVotingDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

export function isElectionCalloutActive(start: string, electionDay: string, today: string): boolean {
  return today >= start && today <= electionDay;
}

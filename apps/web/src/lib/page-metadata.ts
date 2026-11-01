/** Keep each public record's subject in its description, even when editors reuse
 * the same source summary. Empty/whitespace summaries use a named fallback. */
export function recordDescription(subject: string, description: string | null, fallback: string): string {
  const summary = description?.trim() || fallback;
  return summary.toLocaleLowerCase().startsWith(subject.toLocaleLowerCase())
    ? summary
    : `${subject}. ${summary}`;
}

/** A recorded title may describe past service: do not infer current office,
 * jurisdiction, or a role from a mailing address or organization affiliation. */
export function personPageTitle(name: string, title: string | null, kindLabel: string): string {
  return `${name} — ${title?.trim() || (kindLabel === 'Other' ? 'Civic profile' : kindLabel)}`;
}

/** Names already carrying an election year keep it once; otherwise add the
 * election's displayed date, rather than an inferred jurisdiction or office. */
export function electionPageTitle(name: string, date: string, formattedDate: string): string {
  return name.includes(date.slice(0, 4)) ? name : `${name} — ${formattedDate}`;
}

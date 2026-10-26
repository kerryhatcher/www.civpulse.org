import { legislativeResources, type LegislativeRow } from './legislation';
import { legislativeTitle, humanize, relationLabel, legislativeDate, coverageLabel } from './legislation-display';
import type { EventRecord } from './calendars';
import { formatEventWhen } from './calendars';
import { meetingAttendanceLabel, type MeetingRecord } from './meetings';
import type { RequestDetail } from './records-requests';
import { REQUEST_STAGES, REQUEST_OUTCOMES, UPDATE_KINDS } from './records-requests';

export const recordKinds = { bills: 'Bills', votes: 'Legislative votes', sessions: 'Legislative sessions', events: 'Events and meetings', requests: 'Records requests' };
export type RecordKind = keyof typeof recordKinds;
export type RecordSection = { title: string; text?: string; items?: { text: string; href?: string }[] };
export type PublicRecord = { id: string; kind: RecordKind; title: string; description: string; viewer: string; facts: { label: string; value: string; href?: string }[]; sections: RecordSection[] };
export const recordHref = (kind: RecordKind, id: string) => `/records/${kind}/${encodeURIComponent(id)}/`;
export const archiveHref = (kind: RecordKind, page = 1) => `/records/${kind}/page/${page}/`;
export function webHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (['http:', 'https:'].includes(url.protocol)) return url.href; } catch { /* Omit invalid source links. */ }
}
export function localHref(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/(?!\/)[a-zA-Z0-9/?%#=&_.-]*$/.test(value) ? value : undefined;
}
export function legislativeRecord(table: string, row: LegislativeRow): PublicRecord {
  const kind: RecordKind = table === 'bills' ? 'bills' : table === 'legislative_votes' ? 'votes' : 'sessions';
  const title = [legislativeTitle(table, row),
    table === 'legislative_votes' ? [row.identifier, relationLabel(row, 'body_id'), row.occurred_on].filter(Boolean).join(' · ') : relationLabel(row, 'term_id'),
  ].filter(Boolean).join(' · ');
  const description = String(row.summary || row.description || `${title}. ${relationLabel(row, 'session_id') || relationLabel(row, 'term_id') || recordKinds[kind]}.`);
  const hidden = new Set(['title', 'name', 'question', 'description', 'summary', 'visibility', 'source_id', 'source_system', 'retrieved_at', 'source_url', 'text_url']);
  const facts: PublicRecord['facts'] = [];
  for (const field of legislativeResources[table].fields) {
    const value = row[field.name];
    if (hidden.has(field.name) || value == null || value === '') continue;
    const text = field.reference ? relationLabel(row, field.name) : field.type === 'date' || field.type === 'timestamptz' ? legislativeDate(value, field.type === 'timestamptz') : humanize(value);
    if (text) facts.push({ label: humanize(field.label), value: text, href: field.reference ? localHref(row.links?.[field.name]) : undefined });
  }
  const sections: RecordSection[] = [];
  if (row.summary) sections.push({ title: 'Summary', text: String(row.summary) });
  if (row.description) sections.push({ title: 'Description', text: String(row.description) });
  if (kind === 'votes') sections.push({ title: 'Coverage', text: `${coverageLabel(row.coverage)}. Missing member choices are unknown, not absences. A procedural vote is not necessarily final passage.` });
  const sources = [{ text: 'Original source', href: webHref(row.source_url) }, { text: 'Read bill text', href: webHref(row.text_url) }].filter(item => item.href);
  if (sources.length) sections.push({ title: 'Sources', items: sources });
  return { id: row.id, kind, title, description, facts, sections, viewer: `/legislation/${kind === 'bills' ? 'view' : kind === 'votes' ? 'vote' : 'session'}/?id=${row.id}` };
}
export function eventRecord(event: EventRecord, meeting?: MeetingRecord): PublicRecord {
  const sections: RecordSection[] = [];
  if (event.description) sections.push({ title: 'Description', text: event.description });
  if (meeting?.event?.meeting_notes) sections.push({ title: 'Meeting notes', text: meeting.event.meeting_notes });
  if (meeting?.event?.meeting_transcript) sections.push({ title: 'Transcript', text: meeting.event.meeting_transcript });
  if (meeting?.attendance?.length) sections.push({ title: 'Recorded attendance', items: meeting.attendance.map(p => ({ text: `${p.full_name}: ${meetingAttendanceLabel(p.status)}${p.note ? ` — ${p.note}` : ''}`, href: `/people/${encodeURIComponent(p.slug)}/` })) });
  for (const vote of meeting?.votes ?? []) sections.push({ title: vote.subject, text: [vote.description, vote.outcome].filter(Boolean).join('\n'), items: vote.choices.map(c => ({ text: `${c.full_name}: ${c.choice}` })) });
  const sources = [{ text: 'Organizer website', href: webHref(event.url) }, { text: 'Meeting recording', href: webHref(meeting?.event?.meeting_video_url) }].filter(item => item.href);
  if (sources.length) sections.push({ title: 'Sources', items: sources });
  return { id: event.id, kind: 'events', title: event.title, description: `${event.title}. ${event.organization_name}. ${formatEventWhen(event, 'America/New_York')}.`, viewer: `/calendar/view/?id=${event.id}`, facts: [
    { label: 'When (America/New_York)', value: formatEventWhen(event, 'America/New_York') },
    { label: 'Organization', value: event.organization_name, href: `/orgs/${encodeURIComponent(event.organization_slug)}/` },
    { label: 'Calendar', value: event.calendar_name },
    ...(event.location ? [{ label: 'Location', value: event.location }] : []),
  ], sections };
}
export function requestRecord(detail: RequestDetail): PublicRecord {
  const r = detail.request;
  return { id: r.id, kind: 'requests', title: r.title, description: r.description || `${r.title}. ${REQUEST_STAGES[r.stage]}.`, viewer: `/requests/view/?id=${r.id}`, facts: [
    { label: 'Stage', value: REQUEST_STAGES[r.stage] },
    { label: 'Outcome', value: r.outcome ? REQUEST_OUTCOMES[r.outcome] : 'Not assessed' },
    ...(r.reference_number ? [{ label: 'Reference', value: r.reference_number }] : []),
    ...(r.submitted_on ? [{ label: 'Submitted', value: r.submitted_on }] : []),
    ...detail.organizations.map(o => ({ label: o.id === r.target_organization_id ? 'To' : 'From', value: o.name, href: `/orgs/${encodeURIComponent(o.slug)}/` })),
  ], sections: [
    { title: 'Description', text: r.description },
    ...detail.updates.map(u => ({ title: `${u.occurred_on} · ${UPDATE_KINDS[u.kind]}`, text: u.body })),
    { title: 'Fees', items: detail.fees.map(f => ({ text: `${f.occurred_on} · ${f.kind}: $${Number(f.amount).toFixed(2)}${f.note ? ` — ${f.note}` : ''}` })) },
    { title: 'Sources and related links', items: detail.links.map(l => ({ text: l.title, href: webHref(l.url) })).filter(l => l.href) },
  ] };
}

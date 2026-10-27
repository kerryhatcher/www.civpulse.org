import {readPublicRequests} from './request-build-data';
import { readPublicLegislationTable } from './legislation-build-data';
import type { PublicCalendarSnapshot } from './calendar-snapshot';
import type { SupabaseClient } from '@supabase/supabase-js';
import { legislativeResources } from './legislation';
import type { EventRecord } from './calendars';
import type { MeetingRecord } from './meetings';
import { legislativeTitle } from './legislation-display';
import { recordKinds, recordHref, webHref, legislativeRecord, eventRecord, requestRecord, type PublicRecord, type RecordKind } from './public-records';

/** No direct-ID legislative context: it deliberately admits some unlisted records. */
export async function loadPublicRecords(client: SupabaseClient, calendar?: Pick<PublicCalendarSnapshot,'events'|'meetings'>): Promise<PublicRecord[]> {
  const records: PublicRecord[] = [];
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(`Public record export failed (${name}${args.p_table ? `:${args.p_table}` : ''}, offset ${args.p_offset ?? 0}): ${error.message}`);
    if (data == null) throw new Error(`Missing public record export (${name})`);
    return data;
  }
  async function pages<T extends { id: string }>(name: string, size: number, args: Record<string, unknown>, counted = false): Promise<T[]> {
    const rows: T[] = [], seen = new Set<string>();
    let expected: number | undefined;
    for (let offset = 0; ; offset += size) {
      const data = await rpc(name, { ...args, p_offset: offset });
      const page = counted ? data.rows : data;
      if (!Array.isArray(page) || page.length > size) throw new Error(`Invalid public record page (${name})`);
      if (counted) {
        if (!Number.isSafeInteger(data.total) || data.total < 0 || (expected !== undefined && expected !== data.total)) throw new Error(`Public record totals changed (${name})`);
        expected = data.total;
      }
      for (const row of page) {
        if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) || seen.has(row.id)) throw new Error(`Invalid or repeated public record (${name})`);
        seen.add(row.id); rows.push(row);
      }
      if (counted ? rows.length === expected : page.length < size) break;
      if (page.length < size || (expected !== undefined && rows.length > expected) || offset >= 100000) throw new Error(`Incomplete public record export (${name})`);
    }
    return rows;
  }
  // Shared reader bounds page requests across every stream and build consumer.
  async function legislativeStreams(tables: string[]) {
    return Promise.all(tables.map(table => readPublicLegislationTable(client, table)));
  }
  const tables = ['bills', 'legislative_votes', 'legislative_sessions'];
  const published = new Map<string, PublicRecord>();
  const parentRows = await legislativeStreams(tables);
  for (const [index, table] of tables.entries()) {
    for (const row of parentRows[index]) {
      if (row.visibility !== 'public') throw new Error('Non-public legislative record in discovery export');
      const record = legislativeRecord(table, row); records.push(record); published.set(row.id, record);
    }
  }
  const relationTables = ['bill_actions', 'bill_versions', 'bill_amendments', 'bill_sponsorships', 'bill_positions', 'article_bills', 'bill_relationships', 'legislative_vote_bills', 'legislative_vote_choices'];
  const relationRows = await legislativeStreams(relationTables);
  for (const [index, table] of relationTables.entries()) {
    const groups = new Map<string, { text: string; href?: string }[]>();
    for (const row of relationRows[index]) {
      if (row.visibility !== 'public') throw new Error('Non-public legislative child in discovery export');
      const owners = [row.bill_id, row.vote_id].filter((id): id is string => typeof id === 'string' && published.has(id));
      for (const id of owners) {
        const other = published.get(String(row.bill_id === id ? row.vote_id ?? row.related_bill_id : row.bill_id));
        const text = [other?.title ?? legislativeTitle(table, row), row.description, row.source_choice ?? row.choice, row.occurred_on, row.published_on].filter(Boolean).join(' · ');
        const items = groups.get(id) ?? []; items.push({ text, href: other ? recordHref(other.kind, other.id) : webHref(row.text_url) ?? webHref(row.source_url) }); groups.set(id, items);
      }
    }
    for (const [id, items] of groups) published.get(id)!.sections.push({ title: legislativeResources[table].label, items });
  }
  // Only rewrite links when the target was actually admitted to this build.
  for (const record of records) for (const fact of record.facts) {
    const id = fact.href?.match(/[?&]id=([0-9a-f-]{36})/i)?.[1];
    const target = id && published.get(id);
    if (target) fact.href = recordHref(target.kind, target.id);
  }
  const events = calendar?.events ?? await pages<EventRecord>('browse_calendar_events', 500, { p_public_only: true });
  const requests = await readPublicRequests(client);
  const tasks: (() => Promise<void>)[] = [];
  for (const event of events) tasks.push(async () => {
    if (event.visibility !== 'public' || event.calendar_visibility !== 'public' || (event.election_id && event.election_visibility !== 'public')) throw new Error('Non-public event parent in export');
    const meeting: (MeetingRecord & { event?: MeetingRecord['event'] & { visibility: string; election_id: string | null }; calendar?: { visibility: string }; election?: { visibility: string } | null }) | undefined = event.is_meeting ? calendar ? calendar.meetings.get(event.id) : await rpc('get_meeting', { p_id: event.id }) : undefined;
    if (event.is_meeting && (!meeting || meeting.status !== 'ok' || meeting.event?.id !== event.id || (!calendar && (meeting.event.visibility !== 'public' || meeting.calendar?.visibility !== 'public' || (meeting.event.election_id && meeting.election?.visibility !== 'public'))))) throw new Error('Public meeting became unavailable during export');
    records.push(eventRecord(event, meeting));
  });
  for (const request of requests) records.push(requestRecord(request));
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => { while (next < tasks.length) await tasks[next++](); }));
  // Sessions link to their published bills/votes without contextual unlisted reads.
  for (const session of records.filter(r => r.kind === 'sessions')) {
    const items = records.filter(r => r.facts.some(f => f.href === recordHref('sessions', session.id))).map(r => ({ text: r.title, href: recordHref(r.kind, r.id) }));
    if (items.length) session.sections.push({ title: 'Public records in this session', items });
  }
  return records.sort((a,b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
export function recordArchivePages(records: PublicRecord[], size = 50) {
  return (Object.keys(recordKinds) as RecordKind[]).flatMap(kind => {
    const rows = records.filter(r => r.kind === kind), total = Math.max(1, Math.ceil(rows.length / size));
    return Array.from({ length: total }, (_, index) => ({ kind, page: index + 1, total, records: rows.slice(index * size, (index + 1) * size) }));
  });
}

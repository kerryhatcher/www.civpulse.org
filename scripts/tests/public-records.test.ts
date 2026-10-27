import { expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPublicRecords, recordArchivePages } from '../../apps/web/src/lib/public-record-build-data';
import { webHref, localHref, requestRecord } from '../../apps/web/src/lib/public-records';
import type { RequestDetail } from '../../apps/web/src/lib/records-requests';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function client(reply: (name: string, args: any) => any) {
  return { rpc: async (name: string, args: any) => ({ data: await reply(name, args), error: null }) } as unknown as SupabaseClient;
}
const empty = (name: string) => name === 'browse_legislation' ? { rows: [], total: 0 } : [];
test('export pages records without direct or contextual unlisted access', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => ({ id: id(i), visibility: 'public', title: `Bill ${i}` }));
  const calls: any[] = [];
  const records = await loadPublicRecords(client((name, args) => {
    calls.push({ name, args });
    return name === 'browse_legislation' && args.p_table === 'bills' ? { rows: rows.slice(args.p_offset, args.p_offset + args.p_limit), total: rows.length } : empty(name);
  }));
  expect(records.length).toBe(101);
  expect(calls.some(c => c.args.p_offset === 100)).toBe(true);
  expect(calls.every(c => !('p_id' in c.args) && !('p_bill_id' in c.args) && !('p_person_id' in c.args) && !('p_vote_id' in c.args))).toBe(true);
  const archives = recordArchivePages(records).filter(p => p.kind === 'bills');
  expect(archives.map(a => a.records.length)).toEqual([50, 50, 1]);
  expect(archives.flatMap(a => a.records).map(r => r.id)).toEqual(records.map(r => r.id));
});
test('fails publication on backend errors, truncated pages, duplicate IDs and changed totals', async () => {
  await expect(loadPublicRecords({ rpc: async () => ({ error: { message: 'offline' } }) } as unknown as SupabaseClient)).rejects.toThrow('offline');
  await expect(loadPublicRecords(client(() => ({ rows: [], total: 1 })))).rejects.toThrow('Incomplete');
  await expect(loadPublicRecords(client(() => ({ rows: [{ id: id(1), visibility: 'public' }, { id: id(1), visibility: 'public' }], total: 2 })))).rejects.toThrow('repeated');
  const rows = Array.from({ length: 100 }, (_, i) => ({ id: id(i), visibility: 'public' }));
  await expect(loadPublicRecords(client((_, args) => ({ rows: args.p_offset ? [] : rows, total: args.p_offset ? 102 : 101 })))).rejects.toThrow('totals changed');
});
test('rejects non-public discovery records and hidden event parents', async () => {
  await expect(loadPublicRecords(client(() => ({ rows: [{ id: id(1), visibility: 'unlisted' }], total: 1 })))).rejects.toThrow('Non-public');
  await expect(loadPublicRecords(client(name => name === 'browse_calendar_events' ? [{ id: id(1), visibility: 'public', calendar_visibility: 'private' }] : empty(name)))).rejects.toThrow('Non-public event parent');
});
test('request publication omits identity, file metadata and unsafe links', () => {
  const detail = { request: { id: id(1), title: 'Public request', description: 'Evidence', stage: 'submitted', visibility: 'public' }, organizations: [], updates: [], fees: [], links: [{ title: 'unsafe', url: 'javascript:alert(1)' }], files: [{ storage_path: 'secret-path' }], owner_id: 'secret-owner', transfers: [{ reason: 'secret-transfer' }] } as unknown as RequestDetail;
  const result = JSON.stringify(requestRecord(detail));
  for (const text of ['secret-path', 'secret-owner', 'secret-transfer', 'javascript:']) expect(result).not.toContain(text);
  expect(webHref('https://example.org/source')).toBe('https://example.org/source');
  expect(webHref('data:text/html,test')).toBeUndefined();
  expect(localHref('//example.org')).toBeUndefined();
});
test('stops publication when a meeting becomes unlisted after discovery', async () => {
  await expect(loadPublicRecords(client(name => {
    if (name === 'browse_calendar_events') return [{ id: id(1), visibility: 'public', calendar_visibility: 'public', is_meeting: true }];
    if (name === 'get_meeting') return { status: 'ok', event: { id: id(1), visibility: 'unlisted' }, calendar: { visibility: 'public' } };
    return empty(name);
  }))).rejects.toThrow('became unavailable');
});

test('archive reuses the gated calendar snapshot without per-meeting or duplicate event reads',async()=>{
 const calls:string[]=[];
 const event={id:id(300),title:'Public meeting',description:null,starts_at:'2026-10-26T18:00:00Z',ends_at:null,all_day:false,location:null,url:null,visibility:'public',calendar_id:id(301),calendar_name:'Council',calendar_slug:'council',calendar_visibility:'public',organization_id:id(302),organization_name:'Council',organization_slug:'council',election_id:null,election_date_kind:null,election_name:null,election_slug:null,election_visibility:null,is_meeting:true} as const;
 const meeting={status:'ok',event:{id:event.id,title:event.title,meeting_notes:'Public minutes',meeting_transcript:null,meeting_video_url:null,meeting_video_start_seconds:null}} as const;
 const shared={events:[event],meetings:new Map([[event.id,meeting]])};
 const records=await loadPublicRecords(client(name=>{calls.push(name);return empty(name);}),shared);
 expect(records.filter(record=>record.kind==='events')).toHaveLength(1);
 expect(JSON.stringify(records)).toContain('Public minutes');
 expect(calls).not.toContain('get_meeting');expect(calls).not.toContain('browse_calendar_events');
});

test('archive export bounds concurrent streams and keeps relation section order', async () => {
  let active = 0, peak = 0;
  const recordId = id(900);
  const records = await loadPublicRecords(client(async (name, args) => {
    if (name !== 'browse_legislation') return [];
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, args.p_table === 'bill_actions' ? 5 : 1));
    active--;
    if (args.p_table === 'bills') return { total: 1, rows: [{ id: recordId, visibility: 'public', title: 'QA bill' }] };
    if (['bill_actions', 'bill_versions'].includes(args.p_table)) return { total: 1, rows: [{ id: id(args.p_table === 'bill_actions' ? 901 : 902), bill_id: recordId, visibility: 'public', description: args.p_table }] };
    return { total: 0, rows: [] };
  }));
  expect(peak).toBe(3);
  expect(records[0].sections.map(section => section.items[0]?.text.split(' · ').at(-1))).toEqual(['bill_actions', 'bill_versions']);
});

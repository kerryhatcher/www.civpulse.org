import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPublicRecords } from '../../apps/web/src/lib/public-record-build-data';

test.skipIf(!process.env.PUBLIC_RECORDS_TEST_DATABASE_URL)('public publication follows anonymous discovery and preserves restricted viewers', async () => {
  const sql = new SQL(process.env.PUBLIC_RECORDS_TEST_DATABASE_URL!);
  const rollback = Error('rollback');
  try { await sql.begin(async tx => {
    const suffix = crypto.randomUUID();
    const [org] = await tx`insert into organizations(name,slug) values ('Synthetic record publication QA',${suffix}) returning id`;
    const [term] = await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values (${org.id},'qa','Synthetic QA term','2026-01-01') returning id`;
    const [body] = await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
    const publicIds: string[] = [], hiddenIds: string[] = [], bills: string[] = [], events: string[] = [], requests: string[] = [];
    for (const visibility of ['public','unlisted','private']) {
      const ids = visibility === 'public' ? publicIds : hiddenIds;
      const [session] = await tx`insert into legislative_sessions(term_id,identifier,name,starts_on,visibility) values (${term.id},${visibility},${`Synthetic ${visibility} session`},'2026-01-01',${visibility}) returning id`; ids.push(session.id);
      const [bill] = await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values (${term.id},${session.id},${body.id},${visibility},'HB 1',${`Synthetic ${visibility} bill`},'2026-02-01',${visibility}) returning id`; ids.push(bill.id); bills.push(bill.id);
      const [vote] = await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage,visibility) values (${session.id},${body.id},'1','2026-02-02',${`Synthetic ${visibility} vote`},'passage','voice','not_reported','no_individual_record',${visibility}) returning id`; ids.push(vote.id);
      const [calendar] = await tx`insert into calendars(organization_id,slug,name,visibility) values (${org.id},${`${suffix}-${visibility}`},'Synthetic QA calendar',${visibility}) returning id`;
      const [event] = await tx`insert into events(calendar_id,title,starts_at,is_meeting,visibility,meeting_notes) values (${calendar.id},${`Synthetic ${visibility} meeting`},'2026-02-01Z',true,${visibility},'Synthetic sourced notes') returning id`; ids.push(event.id); events.push(event.id);
      const [request] = await tx`insert into records_requests(title,target_organization_id,visibility) values (${`Synthetic ${visibility} request`},${org.id},${visibility}) returning id`; ids.push(request.id); requests.push(request.id);
      // Public children of hidden parents must also stay out of publication.
      if (visibility !== 'public') {
        const [child] = await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values (${term.id},${session.id},${body.id},${visibility},'HB 2','Synthetic hidden-parent bill','2026-02-01') returning id`; hiddenIds.push(child.id);
        const [e] = await tx`insert into events(calendar_id,title,starts_at) values (${calendar.id},'Synthetic hidden-parent event','2026-02-01Z') returning id`; hiddenIds.push(e.id);
      }
    }
    const ordinary = crypto.randomUUID();
    await tx`insert into auth.users(id,email) values (${ordinary},${`${ordinary}@example.test`})`;
    // Adapter calls the actual functions under the transaction's database role.
    const client = { rpc: async (name: string, a: any) => {
      let rows;
      if (name === 'export_public_legislation_page') rows = await tx`select public.export_public_legislation_page(p_table=>${a.p_table},p_limit=>${a.p_limit},p_offset=>${a.p_offset}) as data`;
      else if (name === 'browse_calendar_events') { const data = await tx`select * from public.browse_calendar_events(p_public_only=>true,p_offset=>${a.p_offset})`; return { data: data.map((r: any) => r.browse_calendar_events), error: null }; }
      else if (name === 'search_records_requests') return { data: await tx`select * from public.search_records_requests(p_managed=>false,p_offset=>${a.p_offset})`, error: null };
      else if (name === 'get_meeting') rows = await tx`select public.get_meeting(${a.p_id}::uuid) as data`;
      else if (name === 'get_records_request') rows = await tx`select public.get_records_request(${a.p_id}::uuid) as data`;
      else throw Error(name);
      return { data: rows[0].data, error: null };
    } } as unknown as SupabaseClient;
    for (const role of ['anon', 'authenticated']) {
      await tx.unsafe(`set local role ${role}`);
      await tx`select set_config('request.jwt.claim.sub',${role === 'anon' ? '' : ordinary},true)`;
      if (role === 'anon') {
        const records = await loadPublicRecords({rpc: client.rpc} as SupabaseClient);
        const ids = records.map(r => r.id);
        expect(publicIds.every(id => ids.includes(id))).toBe(true);
        expect(hiddenIds.some(id => ids.includes(id))).toBe(false);
        expect(JSON.stringify(records)).not.toContain(ordinary);
      } else {
        expect((await tx`select has_function_privilege('authenticated','public.export_public_legislation_page(text,integer,integer)','execute') allowed`)[0].allowed).toBe(false);
      }
      const [unlisted] = await tx`select public.get_records_request(${requests[1]}::uuid) as data`;
      const [privateRequest] = await tx`select public.get_records_request(${requests[2]}::uuid) as data`;
      expect(unlisted.data.status).toBe('ok');
      expect(privateRequest.data.status).not.toBe('ok');
      const [unlistedEvent] = await tx`select public.get_event(${events[1]}::uuid) as data`;
      expect(unlistedEvent.data.status).toBe('ok');
      await tx.unsafe('reset role');
    }
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; } finally { await sql.close(); }
}, 30000);

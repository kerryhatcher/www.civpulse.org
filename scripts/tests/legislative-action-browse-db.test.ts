import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('action browsing preserves discovery/context gates and scales to 16,000 actions', async () => {
  const sql = new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);
  const rollback = Error('rollback');
  try { await sql.begin(async tx => {
    await tx.unsafe(await Bun.file(new URL("../../supabase/migrations/20261124010100_legislative_choice_browse_performance.sql",import.meta.url)).text());
    await tx.unsafe(await Bun.file(new URL('../../supabase/migrations/20261124010200_legislative_sponsorship_browse_performance.sql',import.meta.url)).text());
    const suffix = crypto.randomUUID();
    const [org] = await tx`insert into organizations(name,slug) values ('Action QA',${suffix}) returning id`;
    const [term] = await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values (${org.id},'qa','QA term','2025-01-01') returning id`;
    const [session] = await tx`insert into legislative_sessions(term_id,identifier,name,starts_on,ends_on) values (${term.id},'qa','QA session','2025-01-01','2025-12-31') returning id`;
    const [body] = await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
    const [person] = await tx`insert into people(full_name,slug,kind) values ('QA Member',${suffix},'other') returning id`;
    const [office] = await tx`insert into offices(organization_id,name) values (${org.id},'QA office') returning id`;
    const [service] = await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values (${office.id},${person.id},'elected','2025-01-01') returning id`;
    const [bill] = await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values (${term.id},${session.id},${body.id},'qa','qa','QA bill','2025-02-01') returning id`;
    const [calendar] = await tx`insert into calendars(organization_id,slug,name) values (${org.id},${suffix},'QA calendar') returning id`;
    const [event] = await tx`insert into events(calendar_id,title,starts_at) values (${calendar.id},'QA action','2025-02-01Z') returning id`;
    const [action] = await tx`insert into bill_actions(bill_id,session_id,body_id,occurred_on,kind,description,event_id) values (${bill.id},${session.id},${body.id},'2025-02-01','reading','QA action',${event.id}) returning id`;
    const admin = crypto.randomUUID(), ordinary = crypto.randomUUID();
    for (const id of [admin, ordinary]) await tx`insert into auth.users(id,email) values (${id},${`${id}@example.test`})`;
    await tx`insert into admins(user_id) values (${admin})`;
    const browse = async (direct: string | null, personContext: string | null, billContext: string | null, query = '') => {
      const [r] = await tx`select public.browse_legislation(p_table=>'bill_actions',p_id=>${direct}::uuid,p_person_id=>${personContext}::uuid,p_bill_id=>${billContext}::uuid,p_filters=>${JSON.stringify({bill_id:bill.id})}::text::jsonb,p_query=>${query},p_limit=>100) as data`;
      return r.data;
    };
    // Compare the full old/new payload for callers and all supported context modes.
    const snapshots: any[] = [];
    for (const id of ['', ordinary, admin]) {
      await tx`select set_config('request.jwt.claim.sub',${id},true)`;
      for (const target of ['bill_actions', 'events', 'calendars', 'bills', 'legislative_sessions', 'legislative_bodies', 'legislative_terms']) {
        const targetId = ({bill_actions:action.id,events:event.id,calendars:calendar.id,bills:bill.id,legislative_sessions:session.id,legislative_bodies:body.id,legislative_terms:term.id} as Record<string,string>)[target];
        for (const visibility of ['public', 'unlisted', 'private']) {
          await tx.unsafe(`update public.${target} set visibility=$1 where id=$2`, [visibility, targetId]);
          for (const [direct, pc, vc, query] of [[null,null,null,''],[action.id,null,null,''],[null,person.id,null,''],[null,null,bill.id,''],[action.id,person.id,bill.id,''],[null,null,null,'QA Member']] as const) {
            snapshots.push({id,target,targetId,visibility,direct,pc,vc,query,data:await browse(direct,pc,vc,query)});
          }
        }
        await tx.unsafe(`update public.${target} set visibility='public' where id=$1`, [targetId]);
      }
    }
    await tx`select set_config('request.jwt.claim.sub','',true)`;
    await tx.unsafe(await Bun.file(new URL('../../supabase/migrations/20261124010300_legislative_action_browse_performance.sql',import.meta.url)).text());
    for (const sample of snapshots) {
      await tx`select set_config('request.jwt.claim.sub',${sample.id},true)`;
      await tx.unsafe(`update public.${sample.target} set visibility=$1 where id=$2`, [sample.visibility,sample.targetId]);
      expect(await browse(sample.direct,sample.pc,sample.vc,sample.query)).toEqual(sample.data);
      await tx.unsafe(`update public.${sample.target} set visibility='public' where id=$1`, [sample.targetId]);
    }
    await tx`select set_config('request.jwt.claim.sub','',true)`;
    for (const role of ['anon','authenticated']) {
      const [r] = await tx`select has_function_privilege(${role},'legislative_private.visible_action_ids(uuid,uuid,uuid,uuid)','EXECUTE') allowed`;
      expect(r.allowed).toBe(false);
    }
    await tx`insert into bill_actions(bill_id,session_id,body_id,occurred_on,sequence,kind,description)
      select ${bill.id}::uuid,${session.id}::uuid,${body.id}::uuid,'2025-02-01'::date,n,'reading','QA bulk' from generate_series(1,16000) n`;
    await tx.unsafe("set local statement_timeout='3s'");
    for (const id of ['',ordinary,admin]) {
      await tx`select set_config('request.jwt.claim.sub',${id},true)`;
      await tx.unsafe(`set local role ${id?'authenticated':'anon'}`);
      const started = performance.now();
      const data = await browse(null,null,null);
      expect(data.total).toBe(16001);
      expect(data.rows).toHaveLength(100);
      console.log(`16,001 actions (${id===admin?'admin':id?'user':'anon'}): ${Math.round(performance.now()-started)}ms`);
      await tx.unsafe('reset role');
    }
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; } finally { await sql.close(); }
}, 120000);

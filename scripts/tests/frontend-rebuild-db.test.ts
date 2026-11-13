import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const url = process.env.REBUILD_TEST_DATABASE_URL;
test.skipIf(!url)('rebuild triggers are transactional and acknowledgements preserve newer edits and deny public callers', async () => {
  const sql = new SQL(url!); const rollback = Error('rollback');
  try { await sql.begin(async tx => {
    await tx.unsafe(await Bun.file('supabase/migrations/20261125000100_frontend_rebuild_tracking.sql').text());
    const state = async () => (await tx`select * from public.frontend_rebuild_state`)[0];
    const ack = async (revision: string) => (await tx`select public.acknowledge_frontend_rebuild(${revision}) cleared`)[0].cleared;
    expect((await state()).needs_rebuild).toBe(true);
    expect(await ack((await state()).revision)).toBe(true);
    // Every installed trigger can fire; savepoints avoid mutating existing data.
    const triggers = await tx`select event_object_table from information_schema.triggers where trigger_name='frontend_rebuild_required' and event_manipulation='UPDATE'`;
    expect(triggers.length).toBe(44);
    for (const { event_object_table: table } of triggers) {
      await tx.unsafe('savepoint content_change');
      const [{ column_name: column }] = await tx`select column_name from information_schema.columns where table_schema='public' and table_name=${table} and is_identity='NO' and is_generated='NEVER' order by ordinal_position limit 1`;
      await tx.unsafe(`update public.${table} set "${column}"="${column}" where false`);
      expect((await state()).needs_rebuild).toBe(true);
      await tx.unsafe('rollback to savepoint content_change');
      expect((await state()).needs_rebuild).toBe(false);
    }
    const [org] = await tx`insert into public.organizations(name,slug) values ('Rebuild QA',${crypto.randomUUID()}) returning id`;
    const captured = (await state()).revision;
    const admin = crypto.randomUUID();
    await tx`insert into auth.users(id,email) values (${admin},${`rebuild-${admin}@example.test`})`;
    await tx`insert into public.admins(user_id) values (${admin})`;
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    await tx`update public.organizations set name='New edit' where id=${org.id}`;
    await tx.unsafe('reset role');
    expect(await ack(captured)).toBe(false);
    expect((await state()).needs_rebuild).toBe(true);
    await tx`delete from public.organizations where id=${org.id}`;
    expect(await ack((await state()).revision)).toBe(true);
    await tx`insert into public.short_links(code,title,target_url) values (${crypto.randomUUID().replaceAll('-','').slice(0,8)},'Runtime only','https://example.com/')`;
    expect((await state()).needs_rebuild).toBe(false);
    for (const role of ['anon', 'authenticated']) {
      expect((await tx`select has_table_privilege(${role},'public.frontend_rebuild_state','select') allowed`)[0].allowed).toBe(false);
      expect((await tx`select has_function_privilege(${role},'public.acknowledge_frontend_rebuild(text)','execute') allowed`)[0].allowed).toBe(false);
    }
    expect((await tx`select has_table_privilege('service_role','public.frontend_rebuild_state','update') allowed`)[0].allowed).toBe(false);
    await tx.unsafe('set local role service_role');
    expect((await state()).needs_rebuild).toBe(false);
    expect(await ack((await state()).revision)).toBe(false);
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; } finally { await sql.close(); }
});

import { expect, test } from 'bun:test';
import { SQL } from 'bun';

// Opt-in local integration check; all fixtures and permission changes roll back.
test.skipIf(!process.env.OFFICES_TEST_DATABASE_URL)('office service dates, visibility and admin permissions', async () => {
  const sql = new SQL(process.env.OFFICES_TEST_DATABASE_URL!);
  const rollback = new Error('rollback fixtures');
  try {
    await sql.begin(async tx => {
      const suffix = crypto.randomUUID();
      const [org] = await tx`insert into public.organizations(name, slug) values ('Office QA', ${`office-qa-${suffix}`}) returning id`;
      const [office] = await tx`insert into public.offices(organization_id, name) values (${org.id}, 'Commissioner') returning id`;
      const people: Record<string, string> = {};
      for (const visibility of ['public', 'unlisted', 'private']) {
        const [person] = await tx`insert into public.people(full_name, slug, kind, visibility) values ('Office QA', ${`office-qa-${visibility}-${suffix}`}, 'other', ${visibility}) returning id`;
        people[visibility] = person.id;
        await tx`insert into public.office_terms(office_id, person_id, selection_method, starts_on) values (${office.id}, ${person.id}, 'elected', '2021-01-20')`;
      }
      await tx`insert into public.office_terms(office_id, person_id, selection_method, starts_on, ends_on) values (${office.id}, ${people.public}, 'appointed', '2000-01-01', '2001-01-01')`;
      await tx`insert into public.office_terms(office_id, person_id, selection_method, starts_on) values (${office.id}, ${people.public}, 'elected', (now() at time zone 'America/New_York')::date + 1)`;
      // The last day is inclusive and service beginning today is current.
      await tx`insert into public.office_terms(office_id, person_id, selection_method, starts_on, ends_on) values (${office.id}, ${people.public}, 'appointed', (now() at time zone 'America/New_York')::date, (now() at time zone 'America/New_York')::date)`;
      const adminId = crypto.randomUUID();
      await tx`insert into auth.users(id, email) values (${adminId}, ${`office-qa-${suffix}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${adminId})`;
      await tx.unsafe('set local role anon');
      const anon = await tx`select * from public.get_office_terms(null, ${org.id})`;
      expect(anon).toHaveLength(4);
      expect(anon.filter(t => t.service_status === 'current')).toHaveLength(2);
      expect(anon.filter(t => t.service_status === 'former')).toHaveLength(1);
      expect(anon.filter(t => t.service_status === 'upcoming')).toHaveLength(1);
      expect((await tx`select * from public.get_office_terms(${people.unlisted}, null)`)).toHaveLength(1);
      expect((await tx`select * from public.get_office_terms(${people.private}, null)`)).toHaveLength(0);
      expect((await tx`select * from public.get_office_terms()`)).toHaveLength(0);
      expect((await tx`select has_table_privilege('anon', 'public.office_terms', 'select') allowed`)[0].allowed).toBe(false);
      expect((await tx`select has_table_privilege('anon', 'public.offices', 'insert') allowed`)[0].allowed).toBe(false);
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub', ${crypto.randomUUID()}, true)`;
      expect((await tx`select * from public.get_office_terms(null, ${org.id})`)).toHaveLength(4);
      expect((await tx`select * from public.office_terms where office_id = ${office.id}`)).toHaveLength(0);
      expect((await tx`update public.offices set name = 'Unauthorized' where id = ${office.id} returning id`)).toHaveLength(0);
      expect((await tx`delete from public.offices where id = ${office.id} returning id`)).toHaveLength(0);
      // Savepoints allow assertions on rejected writes without aborting fixtures.
      const denied = async (query: () => Promise<unknown>, code: string) => {
        await tx.unsafe('savepoint denied_write');
        try { await query(); throw new Error('Expected write to be rejected'); }
        catch (error) { expect((error as { errno: string }).errno).toBe(code); }
        finally { await tx.unsafe('rollback to savepoint denied_write'); }
      };
      await denied(() => tx`insert into public.offices(organization_id, name) values (${org.id}, 'Unauthorized')`, '42501');
      await denied(() => tx`insert into public.office_terms(office_id, person_id, selection_method, starts_on) values (${office.id}, ${people.public}, 'elected', '1990-01-01')`, '42501');
      await tx`select set_config('request.jwt.claim.sub', ${adminId}, true)`;
      expect((await tx`select * from public.get_office_terms(null, ${org.id})`)).toHaveLength(6);
      const [created] = await tx`insert into public.office_terms(office_id, person_id, selection_method, starts_on, ends_on) values (${office.id}, ${people.public}, 'appointed', '1990-01-01', '1992-01-01') returning id`;
      expect((await tx`update public.office_terms set ends_on = '1993-01-01' where id = ${created.id} returning id`)).toHaveLength(1);
      await denied(() => tx`update public.office_terms set ends_on = '1989-01-01' where id = ${created.id}`, '23514');
      await denied(() => tx`update public.office_terms set source_url = 'javascript:alert(1)' where id = ${created.id}`, '23514');
      await denied(() => tx`delete from public.offices where id = ${office.id}`, '23503');
      expect((await tx`delete from public.office_terms where id = ${created.id} returning id`)).toHaveLength(1);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
}, 20000);

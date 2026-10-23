import { expect, test } from 'bun:test';
import { SQL } from 'bun';

// Opt-in local integration test. All fixtures and permission changes roll back.
test.skipIf(!process.env.CALENDAR_TEST_DATABASE_URL)('calendar range pagination and event/calendar/election visibility', async () => {
  const sql = new SQL(process.env.CALENDAR_TEST_DATABASE_URL!);
  const rollback = new Error('rollback fixtures');
  try {
    await sql.begin(async tx => {
      const suffix = crypto.randomUUID();
      const adminId = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${adminId}, ${`calendar-qa-${suffix}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${adminId})`;
      const [org] = await tx`insert into public.organizations (name, slug) values ('Calendar QA', ${`calendar-qa-${suffix}`}) returning id`;
      const ids: Record<string, string> = {};
      for (const visibility of ['public', 'unlisted', 'private']) {
        const [calendar] = await tx`insert into public.calendars (organization_id, name, slug, visibility) values (${org.id}, ${visibility}, ${`calendar-qa-${visibility}-${suffix}`}, ${visibility}) returning id`;
        ids[visibility] = calendar.id;
      }
      const [election] = await tx`insert into public.elections (name, slug, election_date, visibility) values ('Hidden QA election', ${`election-qa-${suffix}`}, '2026-10-22', 'private') returning id`;
      await tx`insert into public.events (calendar_id, title, starts_at, ends_at)
        select ${ids.public}::uuid, 'QA event ' || n, '2026-10-22 14:00Z'::timestamptz, '2026-10-22 15:00Z'::timestamptz from generate_series(1, 505) n`;
      for (const visibility of ['unlisted', 'private']) {
        await tx`insert into public.events (calendar_id, title, starts_at, visibility) values (${ids.public}, 'Hidden event', '2026-10-22 14:00Z', ${visibility})`;
        await tx`insert into public.events (calendar_id, title, starts_at) values (${ids[visibility]}, 'Hidden calendar event', '2026-10-22 14:00Z')`;
      }
      await tx`insert into public.events (calendar_id, title, starts_at, election_id) values (${ids.public}, 'Hidden election event', '2026-10-22 14:00Z', ${election.id})`;
      await tx`insert into public.events (calendar_id, title, starts_at, ends_at) values (${ids.public}, 'Spans month', '2026-09-30 22:00Z', '2026-10-02 04:00Z')`;
      await tx.unsafe('set local role anon');
      const pages = async (publicOnly = false) => {
        const first = await tx`select data from public.browse_calendar_events('2026-10-01 04:00Z', '2026-11-01 04:00Z', 0, ${publicOnly}) data`;
        const second = await tx`select data from public.browse_calendar_events('2026-10-01 04:00Z', '2026-11-01 04:00Z', 500, ${publicOnly}) data`;
        return [...first, ...second].map(row => row.data).filter(row => row.organization_id === org.id);
      };
      const anonymous = await pages();
      expect(anonymous).toHaveLength(506);
      expect(new Set(anonymous.map(item => item.id)).size).toBe(506);
      expect(anonymous.some(item => item.title.startsWith('Hidden'))).toBe(false);
      expect(anonymous.some(item => item.title === 'Spans month')).toBe(true);
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub', ${crypto.randomUUID()}, true)`;
      const signedIn = await pages();
      expect(signedIn).toHaveLength(506);
      expect(signedIn.filter(item => item.title.startsWith('Hidden'))).toHaveLength(0);
      await tx`select set_config('request.jwt.claim.sub', ${adminId}, true)`;
      expect(await pages()).toHaveLength(511);
      expect(await pages(true)).toHaveLength(506);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
}, 20000);

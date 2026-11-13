import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const databaseUrl = process.env.PEOPLE_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)('people directory paginates all matches, sorts, filters and gates hidden rows', async () => {
  const sql = new SQL(databaseUrl!);
  const rollback = new Error('rollback fixtures');
  try {
    await sql.begin(async tx => {
      const marker = `directory${crypto.randomUUID().replaceAll('-', '')}`;
      const admin = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${admin}, ${`${marker}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      for (let i = 0; i < 55; i++) {
        await tx`insert into public.people(slug, full_name, description, kind, visibility)
          values (${`${marker}-${i}`}, ${`Name${String(i).padStart(2, '0')} Surname${String(54-i).padStart(2, '0')}`}, ${marker}, ${i % 2 ? 'candidate' : 'other'}, 'public')`;
      }
      for (const visibility of ['unlisted', 'private']) {
        await tx`insert into public.people(slug, full_name, description, kind, visibility)
          values (${`${marker}-${visibility}`}, ${`Hidden ${visibility}`}, ${marker}, 'other', ${visibility})`;
      }
      await tx.unsafe('set local role anon');
      const browse = async (offset = 0, sort = 'first_asc', kind: string | null = null) =>
        (await tx`select public.browse_people(${marker}, ${kind}, ${sort}, 24, ${offset}) result`)[0].result;
      const a = await browse(); const b = await browse(24); const c = await browse(48);
      expect(a.total).toBe(55);
      expect(a.people).toHaveLength(24); expect(b.people).toHaveLength(24); expect(c.people).toHaveLength(7);
      expect(new Set([...a.people,...b.people,...c.people].map(p => p.id)).size).toBe(55);
      expect((await browse(1000)).people).toHaveLength(0);
      expect((await browse(0, 'last_asc')).people[0].full_name).toBe('Name54 Surname00');
      expect((await browse(0, 'last_desc')).people[0].full_name).toBe('Name00 Surname54');
      expect((await browse(0, 'first_desc')).people[0].full_name).toBe('Name54 Surname00');
      const filtered = await browse(0, 'first_asc', 'candidate');
      expect(filtered.total).toBe(27);
      expect(filtered.people.every(p => p.kind === 'candidate')).toBe(true);
      expect((await browse(0, 'first_asc', 'appointed_official')).total).toBe(0);
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub', ${crypto.randomUUID()}, true)`;
      expect((await browse()).total).toBe(55);
      await tx`select set_config('request.jwt.claim.sub', ${admin}, true)`;
      expect((await browse()).total).toBe(57);
      expect((await browse()).people.filter(p => p.visibility !== 'public')).toHaveLength(2);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
});

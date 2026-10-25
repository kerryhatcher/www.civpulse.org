import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const credentialTarget = new URL('https://example.test/');
credentialTarget.username = 'qa-user';
credentialTarget.password = 'fixture';

const databaseUrl = process.env.SHORT_LINKS_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)('short links protect metadata, editing and counts while allowing public resolution', async () => {
  const sql = new SQL(databaseUrl!);
  const rollback = new Error('rollback fixtures');
  try {
    await sql.begin(async tx => {
      const admin = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${admin}, ${`links-${admin}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub', ${admin}, true)`;
      const [link] = await tx`select * from public.save_short_link(null, 'Short link QA', 'https://www.kerryhatcher.com/', true)`;
      expect(link.code).toMatch(/^[a-f0-9]{8}$/);
      const denied = async (run: () => Promise<unknown>, code: string) => {
        await tx.unsafe('savepoint denied');
        try { await run(); throw new Error('Expected rejection'); }
        catch (error) { expect((error as { errno: string }).errno).toBe(code); }
        finally { await tx.unsafe('rollback to savepoint denied'); }
      };
      await denied(() => tx`update public.short_links set code='deadbeef' where id=${link.id}`, '42501');
      await denied(() => tx`insert into public.short_link_stats(link_id,redirect_count) values (${link.id},100)`, '42501');
      for (const target of ['javascript:alert(1)', credentialTarget.href, 'https://www.civpulse.org/l/deadbeef', 'https://new.civpulse.org/%6c/deadbeef', 'https://example.com/ space']) {
        await denied(() => tx`select public.save_short_link(${link.id}, 'QA', ${target}, true)`, '23514');
      }
      await tx.unsafe('set local role anon');
      await denied(() => tx`select * from public.short_links`, '42501');
      await denied(() => tx`select * from public.short_link_stats`, '42501');
      await denied(() => tx`select public.save_short_link(null, 'Unauthorized', 'https://example.com/', true)`, '42501');
      expect((await tx`select public.resolve_short_link(${link.code}, false) target`)[0].target).toBe(link.target_url);
      expect((await tx`select public.resolve_short_link(${link.code}) target`)[0].target).toBe(link.target_url);
      expect((await tx`select public.resolve_short_link('bad') target`)[0].target).toBeNull();
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub', ${crypto.randomUUID()}, true)`;
      expect(await tx`select * from public.short_links where id=${link.id}`).toHaveLength(0);
      expect(await tx`select * from public.short_link_stats where link_id=${link.id}`).toHaveLength(0);
      await denied(() => tx`select public.save_short_link(${link.id}, 'Unauthorized', 'https://example.com/', true)`, '42501');
      expect((await tx`select public.resolve_short_link(${link.code}) target`)[0].target).toBe(link.target_url);
      await tx`select set_config('request.jwt.claim.sub', ${admin}, true)`;
      expect((await tx`select redirect_count from public.short_link_stats where link_id=${link.id}`)[0].redirect_count).toBe("2");
      const [edited] = await tx`select * from public.save_short_link(${link.id}, 'Edited', 'https://example.com/new', true)`;
      expect(edited.code).toBe(link.code);
      expect((await tx`select public.resolve_short_link(${link.code}) target`)[0].target).toBe('https://example.com/new');
      await tx`select public.save_short_link(${link.id}, 'Edited', 'https://example.com/new', false)`;
      expect((await tx`select public.resolve_short_link(${link.code}) target`)[0].target).toBeNull();
      expect((await tx`select redirect_count from public.short_link_stats where link_id=${link.id}`)[0].redirect_count).toBe("3");
      await tx`select public.save_short_link(${link.id}, 'Edited', 'https://example.com/new', true)`;
      expect((await tx`select public.resolve_short_link(${link.code}, false) target`)[0].target).toBe('https://example.com/new');
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
});

test.skipIf(!databaseUrl)('concurrent redirects increment without lost visits', async () => {
  const sql = new SQL(databaseUrl!);
  const code = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
  let id: string | undefined;
  try {
    const [link] = await sql`insert into public.short_links(code,title,target_url) values (${code}, 'Concurrent QA', 'https://example.com/') returning id`;
    id = link.id;
    await Promise.all(Array.from({ length: 30 }, () => sql`select public.resolve_short_link(${code})`));
    const [stats] = await sql`select redirect_count,last_visited_at from public.short_link_stats where link_id=${id}`;
    expect(stats.redirect_count).toBe("30");
    expect(stats.last_visited_at).toBeTruthy();
  } finally { if (id) await sql`delete from public.short_links where id=${id}`; await sql.close(); }
});

import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.ACCOUNTS_TEST_DATABASE_URL)('regular accounts match anonymous content access; only admins can list accounts and promote', async () => {
  const sql = new SQL(process.env.ACCOUNTS_TEST_DATABASE_URL!);
  const rollback = new Error('rollback fixtures');
  try {
    await sql.begin(async tx => {
      const suffix = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const adminId = crypto.randomUUID();
      const otherId = crypto.randomUUID();
      for (const id of [userId, adminId, otherId]) {
        await tx`insert into auth.users(id,email,raw_user_meta_data) values (${id}, ${`${id}@example.test`}, '{"role":"admin","display_name":"Account QA"}'::jsonb)`;
      }
      await tx`insert into public.admins(user_id) values (${adminId})`;
      const [org] = await tx`insert into public.organizations(name,slug) values (${suffix}, ${`accounts-${suffix}`}) returning id`;
      const ids: Record<string, Record<string, string>> = {};
      for (const visibility of ['public', 'unlisted', 'private']) {
        const [map] = await tx`insert into public.maps(name,slug,visibility) values (${suffix}, ${`map-${visibility}-${suffix}`}, ${visibility}) returning id`;
        const [layer] = await tx`insert into public.layers(name,source_url,visibility) values (${suffix}, 'https://example.test/data.json', ${visibility}) returning id`;
        await tx`insert into public.map_layers(map_id,layer_id) values (${map.id},${layer.id})`;
        const [person] = await tx`insert into public.people(full_name,slug,visibility) values (${suffix}, ${`person-${visibility}-${suffix}`}, ${visibility}) returning id`;
        const [election] = await tx`insert into public.elections(name,slug,election_date,visibility) values (${suffix}, ${`election-${visibility}-${suffix}`}, '2099-01-01', ${visibility}) returning id`;
        const [calendar] = await tx`insert into public.calendars(name,slug,organization_id,visibility) values (${suffix}, ${`calendar-${visibility}-${suffix}`}, ${org.id}, ${visibility}) returning id`;
        const [event] = await tx`insert into public.events(title,calendar_id,starts_at,visibility) values (${suffix}, ${calendar.id}, '2099-01-01', ${visibility}) returning id`;
        await tx`insert into public.articles(title,url,visibility) values (${suffix}, ${`https://example.test/${visibility}/${suffix}`}, ${visibility})`;
        ids[visibility] = { map: map.id, layer: layer.id, person: person.id, election: election.id, calendar: calendar.id, event: event.id };
      }
      const snapshot = async () => {
        const results: unknown[] = [];
        for (const table of ['maps','layers','people','elections','calendars','articles']) {
          results.push(await tx.unsafe(`select id from public.${table} order by id`));
        }
        results.push(await tx`select * from public.search_site(${suffix}, null, 100, 0)`);
        results.push(await tx`select * from public.list_calendars(${org.id})`);
        results.push(await tx`select * from public.search_events(${suffix}, ${org.id}, null, true, 100)`);
        results.push(await tx`select * from public.browse_calendar_events('2099-01-01', '2099-01-02')`);
        for (const visibility of ['public','unlisted','private']) {
          const id = ids[visibility];
          results.push(await tx`select public.get_map(${id.map}), public.get_person(${id.person}), public.get_election(${id.election}), public.get_event(${id.event})`);
          results.push(await tx`select * from public.get_map_layers(${id.map})`);
          results.push(await tx`select * from public.get_person_articles(${id.person})`);
          results.push(await tx`select * from public.get_person_candidacies(${id.person})`);
          results.push(await tx`select * from public.get_office_terms(${id.person},null)`);
        }
        return JSON.parse(JSON.stringify(results));
      };
      const denied = async (query: () => Promise<unknown>, code = '42501') => {
        await tx.unsafe('savepoint denied_operation');
        try { await query(); throw new Error('Expected rejection'); }
        catch (error) { expect((error as {errno: string}).errno).toBe(code); }
        finally { await tx.unsafe('rollback to savepoint denied_operation'); }
      };
      await tx.unsafe('set local role anon');
      const anonymous = await snapshot();
      await denied(() => tx`select * from public.admin_list_users()`);
      await denied(() => tx`select public.promote_user_to_admin(${userId})`);
      expect(await tx`select * from public.profiles`).toHaveLength(0);
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${userId},true)`;
      expect(await snapshot()).toEqual(anonymous);
      expect((await tx`select public.is_admin() admin`)[0].admin).toBe(false);
      expect(await tx`select * from public.profiles`).toHaveLength(1);
      await denied(() => tx`select * from public.admin_list_users()`);
      await denied(() => tx`select public.promote_user_to_admin(${userId})`);
      await denied(() => tx`select public.promote_user_to_admin(${otherId})`);
      await denied(() => tx`insert into public.admins(user_id) values (${userId})`);
      await denied(() => tx`insert into public.organizations(name,slug) values ('Unauthorized',${`denied-${suffix}`})`);
      expect((await tx`select public.get_map(${ids.private.map}) result`)[0].result.status).toBe('private');
      expect((await tx`select public.get_map(${ids.unlisted.map}) result`)[0].result.status).toBe('ok');
      expect((await tx`select public.mcp_get_record('calendar',${ids.private.calendar}) result`)[0].result.status).toBe('missing');
      await tx`select set_config('request.jwt.claim.sub',${adminId},true)`;
      expect(await tx`select * from public.admin_list_users(${userId})`).toHaveLength(1);
      expect((await tx`select public.get_map(${ids.private.map}) result`)[0].result.status).toBe('ok');
      await denied(() => tx`select public.promote_user_to_admin(${adminId})`, '22023');
      await denied(() => tx`select public.promote_user_to_admin(${crypto.randomUUID()})`, '22023');
      await tx`select public.promote_user_to_admin(${userId})`;
      await tx`select public.promote_user_to_admin(${userId})`;
      await tx`select set_config('request.jwt.claim.sub',${userId},true)`;
      expect((await tx`select public.is_admin() admin`)[0].admin).toBe(true);
      expect((await tx`select public.get_map(${ids.private.map}) result`)[0].result.status).toBe('ok');
      await tx`select public.promote_user_to_admin(${otherId})`;
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
}, 20000);

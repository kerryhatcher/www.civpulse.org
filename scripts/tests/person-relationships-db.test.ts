import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.PERSON_RELATIONSHIPS_TEST_DATABASE_URL)('person links gate both endpoints, normalize direction and require admin writes', async () => {
  const sql = new SQL(process.env.PERSON_RELATIONSHIPS_TEST_DATABASE_URL!);
  const rollback = new Error('rollback person relationship fixtures');
  try { await sql.begin(async tx => {
    // Exercise the append-only follow-up without persistently changing local
    // schema or migration history; CI may already have applied it.
    await tx.unsafe(await Bun.file('supabase/migrations/20261125001600_person_relationship_validation_visibility.sql').text());
    const [initialRebuild] = await tx`select revision from public.frontend_rebuild_state where id`;
    const admin = crypto.randomUUID(), user = crypto.randomUUID(), suffix = crypto.randomUUID();
    for (const id of [admin,user]) await tx`insert into auth.users(id,email) values (${id},${`${id}@example.test`})`;
    await tx`insert into public.admins(user_id) values (${admin})`;
    const people = [];
    for (const visibility of ['public','public','unlisted','private']) {
      const [p] = await tx`insert into public.people(full_name,slug,visibility) values (${`Fixture ${people.length}`},${`rel-${people.length}-${suffix}`},${visibility}) returning id`;
      people.push(p.id);
    }
    const [a,b,u,p] = people;
    async function denied(query: () => Promise<unknown>, code: string) {
      await tx.unsafe('savepoint rejected_relationship');
      try { await query(); throw new Error('Expected rejection'); }
      catch (error) { expect((error as { errno:string }).errno).toBe(code); }
      finally { await tx.unsafe('rollback to savepoint rejected_relationship'); }
    }
    const config = await tx`select prosecdef,proconfig from pg_proc where oid='public.get_person_relationships(uuid)'::regprocedure`;
    expect(config[0].prosecdef).toBe(true); expect(config[0].proconfig).toContain('search_path=""');
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    const links=[];
    for (const other of [b,u,p]) {
      const [r]=await tx`insert into public.person_relationships(person_id,related_person_id,relationship,reverse_relationship,source_url) values (${a},${other},'Child of','Parent of','https://example.test/record') returning id`;
      links.push(r.id);
    }
    await tx`insert into public.person_relationships(person_id,related_person_id,relationship,reverse_relationship) values (${u},${p},'Hidden link','Hidden reverse')`;
    await denied(()=>tx`update public.person_relationships set related_person_id=${b} where id=${links[1]}`,'23505');
    await denied(()=>tx`insert into public.person_relationships(person_id,related_person_id,relationship,reverse_relationship) values (${b},${a},'Reverse','Reverse')`,'23505');
    await denied(()=>tx`insert into public.person_relationships(person_id,related_person_id,relationship,reverse_relationship) values (${a},${a},'Self','Self')`,'23514');
    await denied(()=>tx`insert into public.person_relationships(person_id,related_person_id,relationship,reverse_relationship) values (${a},${crypto.randomUUID()},'Missing','Missing')`,'23503');
    await denied(()=>tx`update public.person_relationships set source_url='javascript:alert(1)' where id=${links[0]}`,'23514');
    await denied(()=>tx`update public.person_relationships set relationship=' ' where id=${links[0]}`,'23514');
    for (const blank of ['\t','\n',' \t\r\n ']) {
      await denied(()=>tx`update public.person_relationships set relationship=${blank} where id=${links[0]}`,'23514');
      await denied(()=>tx`update public.person_relationships set reverse_relationship=${blank} where id=${links[0]}`,'23514');
    }
    for (const invalid of ['https://#fragment','https://?query','https:///path','https://:443','https://example.test:bad','https://example.test/with space','https://example.test\\path']) {
      await denied(()=>tx`update public.person_relationships set source_url=${invalid} where id=${links[0]}`,'23514');
    }
    for (const valid of ['HTTP://example.test/path','HTTPS://example.test:443/path?query=value#fragment','https://[::1]/record',null]) {
      await tx`update public.person_relationships set source_url=${valid} where id=${links[0]}`;
    }
    await tx`update public.person_relationships set reverse_relationship='Updated parent' where id=${links[0]}`;
    await tx.unsafe('set local role anon'); await tx`select set_config('request.jwt.claim.sub','',true)`;
    expect((await tx`select * from public.get_person_relationships(${a})`).map(r=>r.related_person_id)).toEqual([b]);
    expect((await tx`select * from public.get_person_relationships(${a})`)[0].relationship).toBe('Child of');
    expect((await tx`select * from public.get_person_relationships(${b})`)[0].relationship).toBe('Updated parent');
    expect(await tx`select * from public.get_person_relationships(${u})`).toHaveLength(0);
    expect(await tx`select * from public.get_person_relationships(${p})`).toHaveLength(0);
    expect(await tx`select id from public.person_relationships where person_id=${a}`).toHaveLength(1);
    const [history] = await tx`select public.get_object_history('people',${a}::text) as body`;
    expect(JSON.stringify(history.body)).not.toContain(u); expect(JSON.stringify(history.body)).not.toContain(p);
    expect(JSON.stringify(history.body)).toContain(links[0]);
    await denied(()=>tx`insert into public.person_relationships(person_id,related_person_id,relationship,reverse_relationship) values (${b},${u},'Unauthorized','Unauthorized')`,'42501');
    await denied(()=>tx.unsafe('truncate public.person_relationships'),'42501');
    await tx.unsafe('set local role authenticated'); await tx`select set_config('request.jwt.claim.sub',${user},true)`;
    expect((await tx`select * from public.get_person_relationships(${a})`).map(r=>r.related_person_id)).toEqual([b,u]);
    expect((await tx`select * from public.get_person_relationships(${u})`).map(r=>r.related_person_id)).toEqual([a]);
    expect(await tx`select * from public.get_person_relationships(${p})`).toHaveLength(0);
    expect((await tx`select public.get_person(${p}) as body`)[0].body.status).toBe('private');
    expect(await tx`select id from public.person_relationships where person_id=${a}`).toHaveLength(1);
    await denied(()=>tx`insert into public.person_relationships(person_id,related_person_id,relationship,reverse_relationship) values (${b},${u},'Unauthorized','Unauthorized')`,'42501');
    expect(await tx`update public.person_relationships set relationship='Unauthorized' where person_id=${a} returning id`).toHaveLength(0);
    expect(await tx`delete from public.person_relationships where person_id=${a} returning id`).toHaveLength(0);
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    expect(await tx`select * from public.get_person_relationships(${a})`).toHaveLength(3);
    expect((await tx`select * from public.get_person_relationships(${p})`).map(r=>r.related_person_id)).toEqual([a,u]);
    expect(await tx`select id from public.person_relationships where person_id=${a}`).toHaveLength(3);
    await tx`delete from public.person_relationships where id=${links[0]}`;
    expect(await tx`select id from public.people where id=${b}`).toHaveLength(1);
    await tx`delete from public.people where id=${p}`;
    expect(await tx`select * from public.get_person_relationships(${a})`).toHaveLength(1);
    await tx.unsafe('reset role');
    const [rebuild] = await tx`select revision,needs_rebuild from public.frontend_rebuild_state where id`;
    expect(BigInt(rebuild.revision)).toBeGreaterThan(BigInt(initialRebuild.revision)); expect(rebuild.needs_rebuild).toBe(true);
    throw rollback;
  }); } catch (error) { if(error!==rollback)throw error; } finally { await sql.close(); }
});

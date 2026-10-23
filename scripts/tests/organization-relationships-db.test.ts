import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.ORGANIZATION_RELATIONSHIPS_TEST_DATABASE_URL)('organization links are reciprocal, unique, referentially valid and admin-managed', async () => {
  const sql = new SQL(process.env.ORGANIZATION_RELATIONSHIPS_TEST_DATABASE_URL!);
  const rollback = new Error('rollback relationship fixtures');
  try {
    await sql.begin(async tx => {
      const admin = crypto.randomUUID(), user = crypto.randomUUID(), suffix = crypto.randomUUID();
      for (const id of [admin, user]) await tx`insert into auth.users(id,email) values (${id},${`${id}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      const [a] = await tx`insert into public.organizations(name,slug) values ('District',${`district-${suffix}`}) returning id`;
      const [b] = await tx`insert into public.organizations(name,slug) values ('Board',${`board-${suffix}`}) returning id`;
      async function denied(query: () => Promise<unknown>, code: string) {
        await tx.unsafe('savepoint relationship_denied');
        try { await query(); throw new Error('Expected rejection'); }
        catch (error) { expect((error as { errno: string }).errno).toBe(code); }
        finally { await tx.unsafe('rollback to savepoint relationship_denied'); }
      }
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      const [link] = await tx`insert into public.organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship,source_url)
        values (${a.id},${b.id},'Governing board','School district','https://example.test/source') returning id`;
      await denied(() => tx`insert into public.organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship)
        values (${b.id},${a.id},'Reverse duplicate','Duplicate')`, '23505');
      await denied(() => tx`insert into public.organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship)
        values (${a.id},${a.id},'Self','Self')`, '23514');
      await denied(() => tx`insert into public.organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship)
        values (${a.id},${crypto.randomUUID()},'Missing','Missing')`, '23503');
      await denied(() => tx`update public.organization_relationships set source_url='javascript:alert(1)' where id=${link.id}`, '23514');
      await denied(() => tx`update public.organization_relationships set relationship=' ' where id=${link.id}`, '23514');
      await tx.unsafe('set local role anon');
      const forward = await tx`select * from public.get_organization_relationships(${a.id})`;
      const reverse = await tx`select * from public.get_organization_relationships(${b.id})`;
      expect(forward).toHaveLength(1); expect(reverse).toHaveLength(1);
      expect(forward[0].relationship).toBe('Governing board');
      expect(reverse[0].relationship).toBe('School district');
      expect(reverse[0].related_organization_id).toBe(a.id);
      await denied(() => tx`insert into public.organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship)
        values (${a.id},${b.id},'Unauthorized','Unauthorized')`, '42501');
      expect(await tx`update public.organization_relationships set relationship='Unauthorized' where id=${link.id} returning id`).toHaveLength(0);
      expect(await tx`delete from public.organization_relationships where id=${link.id} returning id`).toHaveLength(0);
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${user},true)`;
      expect(await tx`select * from public.get_organization_relationships(${a.id})`).toEqual(forward);
      await denied(() => tx`insert into public.organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship)
        values (${a.id},${b.id},'Unauthorized','Unauthorized')`, '42501');
      expect(await tx`update public.organization_relationships set relationship='Unauthorized' where id=${link.id} returning id`).toHaveLength(0);
      expect(await tx`delete from public.organization_relationships where id=${link.id} returning id`).toHaveLength(0);
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      await tx`update public.organization_relationships set reverse_relationship='Updated district' where id=${link.id}`;
      expect((await tx`select * from public.get_organization_relationships(${b.id})`)[0].relationship).toBe('Updated district');
      await tx`delete from public.organizations where id=${b.id}`;
      expect(await tx`select * from public.get_organization_relationships(${a.id})`).toHaveLength(0);
      expect(await tx`select id from public.organizations where id=${a.id}`).toHaveLength(1);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
});

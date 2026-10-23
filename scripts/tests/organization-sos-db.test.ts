import { expect, test } from 'bun:test';
import { SQL } from 'bun';

// Opt-in integration check. Fixtures and all writes roll back.
test.skipIf(!process.env.SOS_TEST_DATABASE_URL)('optional SOS data, access rules, URL validation and safe backfill', async () => {
  const sql = new SQL(process.env.SOS_TEST_DATABASE_URL!);
  const rollback = new Error('rollback fixtures');
  try {
    await sql.begin(async tx => {
      const suffix = crypto.randomUUID();
      const [org] = await tx`insert into public.organizations(name, slug) values ('SOS QA', ${`sos-qa-${suffix}`}) returning *`;
      expect(org.sos_control_number).toBeNull();
      expect(org.sos_record_url).toBeNull();
      const admin = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${admin},${`sos-${suffix}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      await tx.unsafe('set local role anon');
      expect((await tx`select sos_control_number from public.organizations where id=${org.id}`)[0].sos_control_number).toBeNull();
      expect(await tx`update public.organizations set sos_control_number='unauthorized' where id=${org.id} returning id`).toHaveLength(0);
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
      expect(await tx`update public.organizations set sos_control_number='unauthorized' where id=${org.id} returning id`).toHaveLength(0);
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      const url='https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId=29550';
      const [updated] = await tx`update public.organizations set sos_control_number='0029550',sos_record_url=${url},sos_formation_date='2000-06-26',sos_last_annual_registration='2026' where id=${org.id} returning *`;
      expect(updated.sos_control_number).toBe('0029550');
      expect(updated.sos_record_url).toBe(url);
      await tx.unsafe('savepoint invalid_url');
      try {
        await tx`update public.organizations set sos_record_url='javascript:alert(1)' where id=${org.id}`;
        throw new Error('Invalid URL accepted');
      } catch(error) { expect((error as {errno:string}).errno).toBe('23514'); }
      await tx.unsafe('rollback to savepoint invalid_url');
      await tx.unsafe('reset role');
      // Run the real data migration twice against a matching fixture; preserve its existing identifier.
      await tx`update public.organizations set slug='historic-macon-foundation' where id=${org.id}`;
      const backfill=await Bun.file(new URL('../../supabase/migrations/20261023054401_backfill_organization_sos.sql',import.meta.url)).text();
      await tx.unsafe(backfill);
      await tx.unsafe(backfill);
      const [filled]=await tx`select * from public.organizations where id=${org.id}`;
      expect(filled.sos_control_number).toBe('0029550');
      expect(filled.sos_record_url).toBe(url);
      expect(filled.sos_business_type).toBe('Domestic Nonprofit Corporation');
      await tx.unsafe('set local role anon');
      expect((await tx`select sos_control_number from public.organizations where id=${org.id}`)[0].sos_control_number).toBe('0029550');
      throw rollback;
    });
  } catch(error) { if(error!==rollback)throw error; }
  finally { await sql.close(); }
});

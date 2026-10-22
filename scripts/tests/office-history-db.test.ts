import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import manifest from '../../docs/research/2026-candidate-office-history.json';

test.skipIf(!process.env.OFFICES_TEST_DATABASE_URL)('reviewed import resolves seat organizations and is idempotent without overwriting edits', async () => {
  const sql = new SQL(process.env.OFFICES_TEST_DATABASE_URL!);
  const rollback = new Error('rollback');
  try {
    await sql.begin(async tx => {
      const before = await tx`select id,office_id,person_id,starts_on,ends_on,source_url from public.office_terms order by id`;
      const [sample] = await tx`select id from public.office_terms limit 1`;
      await tx`update public.office_terms set source_url = 'https://example.test/editor-correction' where id = ${sample.id}`;
      await tx.unsafe(await Bun.file('supabase/migrations/20261114010000_candidate_office_history.sql').text());
      expect((await tx`select count(*)::int as count from public.office_terms`)[0].count).toBe(before.length);
      expect((await tx`select source_url from public.office_terms where id = ${sample.id}`)[0].source_url).toBe('https://example.test/editor-correction');
      for (const record of manifest.records) {
        const rows = await tx`select o.name, o.district, org.slug, t.starts_on_precision, t.ends_on_precision from public.office_terms t join public.people p on p.id=t.person_id join public.offices o on o.id=t.office_id join public.organizations org on org.id=o.organization_id where p.slug=${record.person_slug} and org.slug=${record.organization_slug} and o.name=${record.office_name} and o.district=${record.district} and t.starts_on=${record.starts_on.length===4 ? `${record.starts_on}-01-01` : record.starts_on}::date`;
        expect(rows).toHaveLength(1);
        expect(rows[0].starts_on_precision).toBe(record.starts_on.length===4 ? 'year' : 'day');
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
});

test.skipIf(!process.env.OFFICES_TEST_DATABASE_URL)('year precision enforces sorting bounds and concluded same-year service is former', async () => {
  const sql = new SQL(process.env.OFFICES_TEST_DATABASE_URL!);
  const rollback = new Error('rollback');
  try {
    await sql.begin(async tx => {
      const [fixture] = await tx`select office_id,person_id from public.office_terms limit 1`;
      const [term] = await tx`insert into public.office_terms(office_id,person_id,selection_method,starts_on,ends_on,starts_on_precision,ends_on_precision) values (${fixture.office_id},${fixture.person_id},'appointed','1600-01-01',make_date(extract(year from now() at time zone 'America/New_York')::int,12,31),'year','year') returning id`;
      const [result] = await tx`select service_status,starts_on_precision,ends_on_precision from public.get_office_terms(${fixture.person_id},null) where id=${term.id}`;
      expect(result).toEqual({service_status:'former',starts_on_precision:'year',ends_on_precision:'year'});
      for (const column of ['starts_on','ends_on']) {
        await tx.unsafe('savepoint invalid_precision');
        try { await tx.unsafe(`update public.office_terms set ${column}='2000-06-15' where id=$1`,[term.id]);throw Error('expected rejection'); }
        catch (error) { expect((error as {errno:string}).errno).toBe('23514'); }
        await tx.unsafe('rollback to savepoint invalid_precision');
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
});

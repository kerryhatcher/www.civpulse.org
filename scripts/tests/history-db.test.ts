import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.HISTORY_TEST_DATABASE_URL)('audit history records edits and enforces historical and current visibility', async () => {
  const sql = new SQL(process.env.HISTORY_TEST_DATABASE_URL!);
  const rollback = new Error('rollback history fixtures');
  try {
    await sql.begin(async tx => {
      const admin = crypto.randomUUID(); const user = crypto.randomUUID();
      for (const id of [admin, user]) await tx`insert into auth.users(id,email,raw_user_meta_data) values (${id},${`${id}@example.test`},'{"display_name":"History QA"}'::jsonb)`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      const role = async (name: string, uid = '') => {
        await tx.unsafe('reset role');
        await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
        await tx.unsafe(`set local role ${name}`);
      };
      const history = async (table: string | null, id: string | null, before: string | null = null, limit = 100) => {
        const [row] = await tx`select public.get_object_history(${table},${id},${before}::bigint,${limit}) result`;
        return row.result;
      };
      await role('authenticated', admin);
      const suffix = crypto.randomUUID();
      const [person] = await tx`insert into public.people(full_name,slug,visibility) values ('Public original',${suffix},'public') returning id`;
      const [election] = await tx`insert into public.elections(name,slug,election_date,visibility) values ('Hidden election',${`e-${suffix}`},'2099-01-01','private') returning id`;
      const [contest] = await tx`insert into public.contests(election_id,office) values (${election.id},'Mayor') returning id`;
      await tx`insert into public.contest_candidates(contest_id,person_id,party) values (${contest.id},${person.id},'Private party')`;
      await tx`update public.people set full_name='Public revised' where id=${person.id}`;
      const adminHistory = await history('people', person.id);
      expect(adminHistory.admin).toBe(true);
      expect(adminHistory.revisions).toHaveLength(3);
      expect(adminHistory.revisions[0].actor_id).toBe(admin);
      expect(adminHistory.revisions[0].actor_name).toBe('History QA');
      expect(adminHistory.revisions[0].before.full_name).toBe('Public original');
      expect(adminHistory.revisions[0].after.full_name).toBe('Public revised');
      await tx`update public.people set full_name=full_name where id=${person.id}`;
      expect((await history('people', person.id)).revisions).toHaveLength(3);
      await role('anon');
      const publicHistory = await history('people', person.id);
      expect(publicHistory.revisions).toHaveLength(2);
      expect(JSON.stringify(publicHistory)).not.toContain('Private party');
      expect(publicHistory.revisions.every((r: any) => r.actor_id === null)).toBe(true);
      expect((await history(null, null)).revisions).toHaveLength(0);
      expect((await history('elections', election.id)).revisions).toHaveLength(0);
      expect((await history('profiles', admin)).revisions).toHaveLength(0);
      await role('authenticated', user);
      expect(await history('people', person.id)).toEqual(publicHistory);
      for (const statement of ['select * from audit.revisions', "insert into audit.revisions(table_name) values ('people')", 'delete from audit.revisions', "select audit.describe_row('people','{}'::jsonb)"]) {
        await tx.unsafe('savepoint permission_check');
        let rejected = false;
        try { await tx.unsafe(statement); } catch { rejected = true; }
        await tx.unsafe('rollback to savepoint permission_check');
        expect(rejected).toBe(true);
      }
      throw rollback;
    });
  } catch (e) { if (e !== rollback) throw e; }
  finally { await sql.close(); }
});

test.skipIf(!process.env.HISTORY_TEST_DATABASE_URL)('visibility transitions, deletions, relationships, pagination, and rollback', async () => {
  const sql = new SQL(process.env.HISTORY_TEST_DATABASE_URL!);
  const rollback = new Error('rollback history fixtures');
  try {
    await sql.begin(async tx => {
      const admin = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      const role = async (name: string, uid = '') => {
        await tx.unsafe('reset role'); await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
        await tx.unsafe(`set local role ${name}`);
      };
      const history = async (table: string, id: string, before: string | null = null, limit = 100) => {
        const [row] = await tx`select public.get_object_history(${table},${id},${before}::bigint,${limit}) result`;
        return row.result.revisions;
      };
      await role('authenticated', admin);
      const suffix = crypto.randomUUID();
      const [p] = await tx`insert into public.people(full_name,slug,visibility) values ('Secret initial',${suffix},'private') returning id`;
      await tx`update public.people set visibility='public',full_name='Published name' where id=${p.id}`;
      await role('anon'); expect(await history('people', p.id)).toHaveLength(0);
      await role('authenticated', admin);
      await tx`update public.people set title='Published title' where id=${p.id}`;
      await role('anon');
      expect(await history('people', p.id)).toHaveLength(1);
      expect(JSON.stringify(await history('people', p.id))).not.toContain('Secret initial');
      await role('authenticated', admin);
      const [org] = await tx`insert into public.organizations(name,slug) values ('History organization',${`o-${suffix}`}) returning id`;
      await tx`insert into public.person_organizations(person_id,organization_id,role) values (${p.id},${org.id},'Member')`;
      await tx`delete from public.person_organizations where person_id=${p.id} and organization_id=${org.id}`;
      await role('anon');
      const related = await history('people', p.id);
      expect(related.filter((r: any) => r.table_name === 'person_organizations')).toHaveLength(2);
      expect(related[0].operation).toBe('DELETE');
      const first = await history('people', p.id, null, 1);
      const second = await history('people', p.id, first[0].id, 1);
      expect(second[0].id).not.toBe(first[0].id);
      await role('authenticated', admin);
      await tx`update public.people set visibility='unlisted' where id=${p.id}`;
      await role('anon'); expect(await history('people', p.id)).toHaveLength(0);
      await role('authenticated', admin);
      await tx`delete from public.people where id=${p.id}`;
      await role('anon'); expect(await history('people', p.id)).toHaveLength(0);
      await role('authenticated', admin);
      expect((await history('people', p.id))[0].operation).toBe('DELETE');
      const [pub] = await tx`insert into public.people(full_name,slug) values ('Public deleted',${`deleted-${suffix}`}) returning id`;
      await tx`delete from public.people where id=${pub.id}`;
      await role('anon'); expect((await history('people', pub.id))[0].operation).toBe('DELETE');
      await role('authenticated', admin);
      await tx.unsafe('savepoint failed_edit');
      await tx`update public.organizations set name='Rolled back title' where id=${org.id}`;
      await tx.unsafe('rollback to savepoint failed_edit');
      expect(JSON.stringify(await history('organizations', org.id))).not.toContain('Rolled back title');
      throw rollback;
    });
  } catch (e) { if (e !== rollback) throw e; }
  finally { await sql.close(); }
});

test.skipIf(!process.env.HISTORY_TEST_DATABASE_URL)('registry coverage, composite keys, geographic IDs, file redaction, and durable attribution', async () => {
  const sql = new SQL(process.env.HISTORY_TEST_DATABASE_URL!);
  const rollback = new Error('rollback history fixtures');
  try {
    await sql.begin(async tx => {
      const [coverage] = await tx`select count(*)::int count from audit.objects o where exists (
        select 1 from pg_catalog.pg_trigger t where t.tgrelid = ('public.' || o.table_name)::regclass and t.tgname='record_history')`;
      expect(coverage.count).toBe(23);
      // Registry identities must match real primary keys, including joins and bigint features.
      const mismatches = await tx`select o.table_name from audit.objects o where not exists (
        select 1 from pg_catalog.pg_index i where i.indrelid=('public.'||o.table_name)::regclass and i.indisprimary
        and (select array_agg(a.attname::text order by a.attname) from pg_catalog.pg_attribute a where a.attrelid=i.indrelid and a.attnum=any(i.indkey))
          = (select array_agg(k order by k) from unnest(o.key_columns) k))`;
      expect(mismatches).toHaveLength(0);
      const suffix = crypto.randomUUID(); const admin = crypto.randomUUID();
      await tx`insert into auth.users(id,email,raw_user_meta_data) values (${admin},${`${admin}@example.test`},'{"display_name":"Durable editor"}'::jsonb)`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      const [org] = await tx`insert into public.organizations(name,slug) values ('Audit files',${suffix}) returning id`;
      const [cal] = await tx`insert into public.calendars(name,slug,organization_id) values ('Audit calendar',${suffix},${org.id}) returning id`;
      const [event] = await tx`insert into public.events(title,calendar_id,starts_at,is_meeting) values ('Audit meeting',${cal.id},'2099-01-01',true) returning id`;
      await tx`insert into public.meeting_attachments(meeting_id,file_name,storage_path,mime_type,size_bytes) values (${event.id},'minutes.pdf',${`${event.id}/private-path.pdf`},'application/pdf',100)`;
      const [person] = await tx`insert into public.people(full_name,slug) values ('Reference person',${suffix}) returning id`;
      await tx`insert into public.person_organizations(person_id,organization_id,role) values (${person.id},${org.id},'Member')`;
      const composite = JSON.stringify({ person_id: person.id, organization_id: org.id });
      const [layer] = await tx`insert into public.layers(name,source_type,visibility) values ('Audit geometry','postgis','public') returning id`;
      const [feature] = await tx`insert into public.layer_features(layer_id,position,properties,geometry) values (${layer.id},0,'{"name":"Audited feature"}'::jsonb,extensions.st_geomfromtext('POINT(-83 32)',4326)) returning id`;
      await tx.unsafe('set local role authenticated');
      for (const statement of ['select * from audit.revisions', 'delete from audit.revisions', 'update audit.revisions set actor_name=\'Forgery\'']) {
        await tx.unsafe('savepoint admin_tamper'); let denied = false;
        try { await tx.unsafe(statement); } catch { denied = true; }
        await tx.unsafe('rollback to savepoint admin_tamper'); expect(denied).toBe(true);
      }
      await tx.unsafe('reset role');
      await tx`delete from auth.users where id=${admin}`;
      await tx`select set_config('request.jwt.claim.sub','',true)`;
      await tx.unsafe('set local role anon');
      const [meeting] = await tx`select public.get_object_history('events',${event.id}) result`;
      expect(JSON.stringify(meeting.result)).not.toContain('private-path.pdf');
      expect(JSON.stringify(meeting.result)).toContain('minutes.pdf');
      expect(JSON.stringify(meeting.result)).toContain('Durable editor');
      expect(JSON.stringify(meeting.result)).not.toContain(admin);
      const [join] = await tx`select public.get_object_history('person_organizations',${composite}) result`;
      expect(join.result.revisions).toHaveLength(1);
      const [geographic] = await tx`select public.get_object_history('layer_features',${String(feature.id)}) result`;
      expect(geographic.result.revisions).toHaveLength(1);
      await tx.unsafe('reset role');
      // A now-private referenced person must also hide old affiliation history on the organization.
      await tx`update public.people set visibility='private' where id=${person.id}`;
      await tx.unsafe('set local role anon');
      const [hiddenJoin] = await tx`select public.get_object_history('person_organizations',${composite}) result`;
      expect(hiddenJoin.result.revisions).toHaveLength(0);
      const [orgHistory] = await tx`select public.get_object_history('organizations',${org.id}) result`;
      expect(orgHistory.result.revisions.some((r: any) => r.table_name === 'person_organizations')).toBe(false);
      throw rollback;
    });
  } catch (e) { if (e !== rollback) throw e; }
  finally { await sql.close(); }
});

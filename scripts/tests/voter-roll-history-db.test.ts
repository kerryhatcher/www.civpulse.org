import { expect, test } from 'bun:test';
import { SQL } from 'bun';

const url = process.env.VOTER_ROLL_TEST_DATABASE_URL;
const columns = ['County','Voter Registration Number','Status','Status Reason','Last Name','First Name','Middle Name','Suffix','Birth Year',
  'Residence Street Number','Residence Pre Direction','Residence Street Name','Residence Street Type','Residence Post Direction',
  'Residence Apt Unit Number','Residence City','Residence Zipcode','County Precinct','County Precinct Description',
  'Municipal Precinct','Municipal Precinct Description','Congressional District','State Senate District','State House District',
  'Judicial District','County Commission District','School Board District','City Council District','Municipal School Board District',
  'Water Board District','Super Council District','Super Commissioner District','Super School Board District','Fire District',
  'Municipality','Combo','Land Lot','Land District','Registration Date','Race','Gender','Last Modified Date','Date of Last Contact',
  'Last Party Voted','Last Vote Date','Voter Created Date','Mailing Street Number','Mailing Street Name','Mailing Apt Unit Number',
  'Mailing City','Mailing Zipcode','Mailing State','Mailing Country'];

test.skipIf(!url)('voter roll snapshots preserve history, enforce complete county scope and deny non-admin access', async () => {
  let target: URL;
  try { target = new URL(url!); } catch { throw new Error('Use a loopback test database'); }
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || !['127.0.0.1', 'localhost'].includes(target.hostname) || !target.port)
    throw new Error('Use a loopback test database');
  const db = new SQL(url!), rollback = new Error('rollback voter roll fixtures');
  try {
    await db.begin(async tx => {
      if (!(await tx`select to_regclass('public.voter_roll_imports') t`)[0].t)
        await tx.unsafe(await Bun.file('supabase/migrations/20261125000700_voter_roll_history.sql').text());
      const admin = crypto.randomUUID(), user = crypto.randomUUID();
      for (const id of [admin, user]) await tx`insert into auth.users(id,email) values (${id},${`${id}@example.test`})`;
      await tx`insert into public.admins(user_id) values (${admin})`;
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      let checksum = 0;
      const begin = async (date: string, count: number, county = '13021', supersedes: string | null = null, sha?: string) =>
        (await tx`select public.begin_voter_roll_import(${county},${date}::date,'synthetic.csv',${sha ?? (++checksum).toString(16).padStart(128,'0')},${count},${supersedes}::uuid) id`)[0].id;
      const append = async (id: string, rows: unknown[]) => (await tx`select public.append_voter_roll_records(${id},${JSON.stringify(rows)}::text::jsonb) n`)[0].n;
      const complete = async (id: string) => (await tx`select public.complete_voter_roll_import(${id}) id`)[0].id;
      const history = async (limit = 100, offset = 0) => (await tx`select public.get_voter_roll_history('000000001',${limit},${offset}) r`)[0].r;
      const row = (id = '000000001', sourceRow = 2, changes: Record<string,string> = {}) => ({source_row:sourceRow,
        data:{...Object.fromEntries(columns.map(k => [k,''])),County:'BIBB','Voter Registration Number':id,
          Status:'ACTIVE','First Name':'Synthetic','Last Name':'Fixture','Residence Zipcode':'00123',...changes}});
      const fail = async (fn: () => Promise<unknown>, contains: string) => {
        await tx.unsafe('savepoint bad_voter_roll');
        let caught = false;
        try { await fn(); } catch (error) { caught = true; expect(String(error)).toContain(contains); }
        finally { await tx.unsafe('rollback to savepoint bad_voter_roll'); }
        expect(caught).toBe(true);
      };

      await fail(() => begin('2090-02-01',0),'check constraint');
      await fail(() => begin('2090-02-01',1,'99999'),'foreign key');
      const first = await begin('2090-02-01',2,'13021',null,'a'.repeat(128));
      expect(await begin('2090-02-01',2,'13021',null,'a'.repeat(128))).toBe(first);
      await fail(() => begin('2090-02-01',3,'13021',null,'a'.repeat(128)),'different metadata');
      await fail(() => append(first,[row('000000001',2,{County:'HOUSTON'})]),'county');
      const missing = row(); delete (missing.data as Record<string,string>)['Birth Year'];
      await fail(() => append(first,[missing]),'53 SOS columns');
      await fail(() => append(first,[row('000000001',2,{token:'unexpected'})]),'53 SOS columns');
      await fail(() => append(first,[row('000000001',4)]),'outside expected file');
      await fail(() => append(first,[row(),row('000000001',3)]),'Duplicate registration');
      await fail(() => append(first,[row('invalid')]),'check constraint');
      expect(await append(first,[row()])).toBe(1);
      await fail(() => append(first,[row('000000002',2)]),'voter_roll_records_import_id_source_row_key');
      expect(await append(first,[row()])).toBe(0); // exact batch retry
      await fail(() => append(first,[row('000000001',2,{Status:'INACTIVE'})]),'Conflicting retry');
      await fail(() => append(first,[row('000000002',3),row('000000001',2,{Status:'INACTIVE'})]),'Conflicting retry');
      expect(await tx`select registration_number from public.voter_roll_records where import_id=${first}`).toHaveLength(1);
      const numeric = row(); (numeric.data as Record<string,unknown>)['Birth Year'] = 1980;
      await fail(() => append(first,[numeric]),'53 SOS columns');
      await fail(() => complete(first),'Incomplete snapshot');
      expect((await history()).total).toBe(0);
      await append(first,[row('000000002',3)]);
      expect(await complete(first)).toBe(first);
      expect(await complete(first)).toBe(first);
      await fail(() => append(first,[row()]),'immutable');
      await fail(() => tx`update public.voter_roll_records set data='{}'::jsonb`,'permission denied');
      await fail(() => tx`delete from public.voter_roll_imports`,'permission denied');
      await fail(() => tx`truncate public.voter_roll_records`,'permission denied');
      await fail(() => tx`insert into public.voter_roll_records(import_id,source_row,data) values (${first},4,'{}')`,'permission denied');

      const changed = await begin('2090-03-01',1);
      await append(changed,[row('000000001',2,{Status:'INACTIVE','Residence Street Name':'NEW STREET'})]); await complete(changed);
      const absent = await begin('2090-04-01',1);
      await append(absent,[row('000000002')]); await complete(absent);
      const pending = await begin('2090-05-01',2); await append(pending,[row('000000002')]);
      expect((await history()).total).toBe(3); // pending absence has no effect
      // A repeated complete absence is distinct from an uncompleted import.
      const absentAgain = await begin('2090-04-15',1); await append(absentAgain,[row('000000002')]); await complete(absentAgain);
      expect((await history()).history.at(-1).event).toBe('still_missing');
      const houston = await begin('2090-04-02',1,'13153');
      await append(houston,[row('000000001',2,{County:'HOUSTON'})]); await complete(houston);
      const returned = await begin('2090-06-01',1); await append(returned,[row()]); await complete(returned);
      const unchanged = await begin('2090-07-01',1); await append(unchanged,[row()]); await complete(unchanged);
      const events = (await history()).history;
      expect(events.map((e: any) => e.event)).toEqual(['first_seen','changed','missing_from_snapshot','first_seen','still_missing','reappeared','unchanged']);
      expect(events[0].data['Voter Registration Number']).toBe('000000001');
      expect(events[0].data['Residence Zipcode']).toBe('00123');
      expect(events[1].changes.Status).toEqual({before:'ACTIVE',after:'INACTIVE'});
      expect(events[1].changes['Residence Street Name']).toEqual({before:'',after:'NEW STREET'});
      expect(events[2].data).toBeNull(); expect(events[2].previous_data.Status).toBe('INACTIVE');
      expect((await history(1,2)).history[0].event).toBe('missing_from_snapshot');
      expect((await history(1,2)).total).toBe(7);
      expect((await history(100,100)).history).toEqual([]);
      await fail(() => history(101),'Invalid history');

      // A backfill changes chronology, not the import-completion order.
      const backfill = await begin('2090-01-01',1); await append(backfill,[row()]); await complete(backfill);
      expect((await history()).history[0].import_id).toBe(backfill);
      // Same-date corrections require an explicit predecessor and preserve originals.
      await fail(() => begin('2090-04-01',1,'13021',first),'same county and date');
      const unscoped = await begin('2090-04-01',1); await append(unscoped,[row()]);
      await fail(() => complete(unscoped),'explicitly supersede');
      const correction = await begin('2090-04-01',1,'13021',absent); await append(correction,[row()]); await complete(correction);
      expect((await history()).history.find((e: any) => e.import_id===correction).event).toBe('changed');
      expect((await history()).history.find((e: any) => e.import_id===absentAgain).event).toBe('missing_from_snapshot');
      expect((await tx`select data from public.voter_roll_records where import_id=${absent}`)[0].data['Voter Registration Number']).toBe('000000002');
      const stale = await begin('2090-04-01',1,'13021',absent); await append(stale,[row()]);
      await fail(() => complete(stale),'Snapshot changed');

      // Exercise the maximum batch size without using any real voter data.
      const bulk = await begin('2091-01-01',1000,'13153');
      const bulkRows = Array.from({length:1000},(_,i) => row(String(800000000+i),i+2,{County:'HOUSTON'}));
      await fail(() => append(bulk,[...bulkRows,row('900000000',1002,{County:'HOUSTON'})]),'Batch limit');
      expect(await append(bulk,bulkRows)).toBe(1000);
      expect(await append(bulk,bulkRows)).toBe(0);
      await complete(bulk);

      for (const role of ['authenticated','anon']) {
        await tx.unsafe(`set local role ${role}`);
        await tx`select set_config('request.jwt.claim.sub',${role==='anon'?'':user},true)`;
        if (role==='authenticated') {
          expect(await tx`select * from public.voter_roll_records`).toHaveLength(0);
          expect(await tx`select * from public.voter_roll_imports`).toHaveLength(0);
          await fail(() => history(),'Administrator required');
          await fail(() => begin('2090-08-01',1),'Administrator required');
          await fail(() => append(first,[row()]),'Administrator required');
          await fail(() => complete(first),'Administrator required');
        } else {
          await fail(() => tx`select * from public.voter_roll_records`,'permission denied');
          await fail(() => tx`select * from public.voter_roll_imports`,'permission denied');
          await fail(() => history(),'permission denied');
          await fail(() => begin('2090-08-01',1),'permission denied');
          await fail(() => append(first,[row()]),'permission denied');
          await fail(() => complete(first),'permission denied');
        }
        await fail(() => tx`update public.voter_roll_records set data='{}'::jsonb`,'permission denied');
        await fail(() => tx`delete from public.voter_roll_records`,'permission denied');
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await db.close(); }
}, 30000);

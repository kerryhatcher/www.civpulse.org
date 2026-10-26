import { expect, test } from 'bun:test';
import { SQL } from 'bun';

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)('person bill groups page after grouping and preserve visibility and filters', async () => {
  const sql = new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);
  const rollback = Error('rollback');
  try {
    await sql.begin(async tx => {
      await tx.unsafe(await Bun.file('supabase/migrations/20261123080000_person_legislative_bill_groups.sql').text());
      const suffix = crypto.randomUUID();
      const [org] = await tx`insert into organizations(name,slug) values ('Grouped votes QA',${suffix}) returning id`;
      const [term] = await tx`insert into legislative_terms(organization_id,identifier,name,starts_on) values (${org.id},'qa','QA term','2026-01-01') returning id`;
      const [session] = await tx`insert into legislative_sessions(term_id,identifier,name,starts_on) values (${term.id},'qa','QA session','2026-01-01') returning id`;
      const [body] = await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
      const [person] = await tx`insert into people(full_name,slug,kind) values ('Grouped votes QA',${suffix},'other') returning id`;
      const [office] = await tx`insert into offices(organization_id,name) values (${org.id},'Representative') returning id`;
      const [service] = await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values (${office.id},${person.id},'elected','2026-01-01') returning id`;
      await tx`insert into legislative_body_memberships(body_id,office_term_id,starts_on) values (${body.id},${service.id},'2026-01-01')`;
      const bills: string[] = [];
      // Same identifier in separate numbering contexts must never collapse.
      for (const context of ['regular','special','private']) {
        const [bill] = await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility)
          values (${term.id},${session.id},${body.id},${context},'HB 1',${context},'2026-01-01',${context === 'private' ? 'private' : 'public'}) returning id`;
        bills.push(bill.id);
      }
      const voteIds: string[] = [];
      for (let i = 0; i < 32; i++) {
        const [vote] = await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,occurred_at,question,category,method,outcome,visibility)
          values (${session.id},${body.id},${String(i)},'2026-02-01',${`2026-02-01T${String(i % 24).padStart(2,'0')}:00:00Z`},${`Question ${i}`},${i === 0 ? 'amendment' : 'passage'},'roll_call','passed',${i === 23 ? 'private' : 'public'}) returning id`;
        voteIds.push(vote.id);
        await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${vote.id},${service.id},'yes','Yea')`;
        if (i < 30) await tx`insert into legislative_vote_bills(vote_id,bill_id) values (${vote.id},${bills[0]})`;
        if (i === 0) await tx`insert into legislative_vote_bills(vote_id,bill_id) values (${vote.id},${bills[1]}),(${vote.id},${bills[2]})`;
      }
      // Attendance must affect neither standalone entries nor the latest vote/count
      // of an associated bill, even when it is newer than all legislative votes.
      const attendanceIds: string[] = [];
      for (const linked of [false, true]) {
        const [vote] = await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome)
          values (${session.id},${body.id},${`attendance-${linked}`},'2026-02-02','Attendance roll call','attendance','roll_call','not_reported') returning id`;
        attendanceIds.push(vote.id);
        await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${vote.id},${service.id},'yes','Yea')`;
        if (linked) await tx`insert into legislative_vote_bills(vote_id,bill_id) values (${vote.id},${bills[0]})`;
      }
      await tx.unsafe(await Bun.file('supabase/migrations/20261123110000_profile_votes_exclude_attendance.sql').text());
      const read = async (offset = 0, limit = 100, category: string | null = null, query: string | null = null) =>
        (await tx`select get_person_legislative_bill_groups(${person.id},null,null,${category},${limit},${offset},${term.id},${query}) result`)[0].result;
      const checkAttendance = async () => {
        expect((await read(0,100,'attendance')).total).toBe(0);
        const raw = (await tx`select get_person_legislative_record(${person.id},null,null,'attendance',100,0) result`)[0].result;
        expect(raw.total).toBe(2);
        expect(raw.rows.map((r: any) => r.vote_id).sort()).toEqual([...attendanceIds].sort());
        const direct = (await tx`select browse_legislation('legislative_votes',${attendanceIds[0]}) result`)[0].result;
        expect(direct.rows[0].category).toBe('attendance');
      };
      await tx.unsafe('set local role anon');
      await checkAttendance();
      let result = await read();
      expect(result.total).toBe(4); // two bills and two unlinked votes
      const regular = result.rows.find((r: any) => r.bill_id === bills[0]);
      expect(regular.vote_count).toBe(29);
      expect(regular.vote_id).toBe(voteIds[22]); // known exact time outranks UUID or insertion order
      expect(result.rows.some((r: any) => r.bill_id === bills[2])).toBe(false);
      const pages = [];
      for (let offset = 0; offset < 4; offset++) pages.push((await read(offset,1)).rows[0].group_id);
      expect(new Set(pages).size).toBe(4);
      expect((await read(4,1)).rows).toEqual([]);
      expect((await read(0,100,'amendment')).rows.every((r: any) => r.vote_count === 1)).toBe(true);
      expect((await read(0,100,null,'special')).total).toBe(1);
      expect((await read(0,100,null,'private')).total).toBe(0);
      expect((await read(0,100,null,'missing')).total).toBe(0);
      expect((await tx`select get_person_legislative_bill_groups(${person.id},${crypto.randomUUID()}) result`)[0].result.total).toBe(0);
      expect((await tx`select get_person_legislative_bill_groups(${person.id},null,${crypto.randomUUID()}) result`)[0].result.total).toBe(0);
      await tx.unsafe('reset role');
      await tx`update legislative_vote_choices set visibility='private' where vote_id=${voteIds[22]}`;
      await tx`update legislative_vote_bills set visibility='private' where bill_id=${bills[1]}`;
      await tx.unsafe('set local role anon');
      const restricted = await read();
      expect(restricted.total).toBe(3);
      expect(restricted.rows.find((r: any) => r.bill_id === bills[0]).vote_count).toBe(28);
      expect(restricted.rows.find((r: any) => r.bill_id === bills[0]).vote_id).toBe(voteIds[21]);
      await tx.unsafe('reset role');
      await tx`update legislative_vote_choices set visibility='public' where vote_id=${voteIds[22]}`;
      await tx`update legislative_vote_bills set visibility='public' where bill_id=${bills[1]}`;
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
      expect(await read()).toEqual(result);
      await checkAttendance();
      await tx.unsafe('reset role');
      const admin = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${admin},${`${suffix}@example.test`})`;
      await tx`insert into admins(user_id) values (${admin})`;
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      result = await read();
      await checkAttendance();
      expect(result.total).toBe(5);
      expect(result.rows.find((r: any) => r.bill_id === bills[0]).vote_count).toBe(30);
      expect(result.rows.find((r: any) => r.bill_id === bills[0]).vote_id).toBe(voteIds[23]);
      await tx.unsafe('reset role');
      await tx`update people set visibility='private' where id=${person.id}`;
      await tx.unsafe('set local role anon');
      await tx`select set_config('request.jwt.claim.sub','',true)`;
      expect((await read()).total).toBe(0);
      throw rollback;
    });
  } catch (e) { if (e !== rollback) throw e; }
  finally { await sql.close(); }
});

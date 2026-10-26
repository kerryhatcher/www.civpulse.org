import { expect, test } from "bun:test";
import { SQL } from "bun";

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)("bill directory filters, ordering, pagination and visibility", async () => {
  const sql = new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);
  const rollback = Error("rollback fixtures");
  try {
    await sql.begin(async (tx) => {
      // Permit verification of a pending migration without altering the shared local DB.
      if (process.env.LEGISLATION_TEST_PENDING_MIGRATION === "1") {
        await tx.unsafe(await Bun.file("supabase/migrations/20261123100000_legislation_directory.sql").text());
      }
      const suffix = crypto.randomUUID();
      const terms: string[] = [];
      for (const [jurisdiction, state] of [["federal", null], ["state", "Georgia"], ["state", "Alabama"], ["unspecified", null]]) {
        const [org] = await tx`insert into organizations(name,slug) values (${`Directory QA ${jurisdiction} ${state ?? ''}`},${crypto.randomUUID()}) returning id`;
        const [term] = await tx`insert into legislative_terms(organization_id,identifier,name,starts_on,jurisdiction,state_name) values (${org.id},${suffix},${`QA ${state ?? jurisdiction}`},'2025-01-01',${jurisdiction},${state}) returning id`;
        terms.push(term.id);
        const [session] = await tx`insert into legislative_sessions(term_id,identifier,name,starts_on) values (${term.id},'regular','Regular','2025-01-01') returning id`;
        const [body] = await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
        for (let i=0;i<27;i++) {
          await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values (${term.id},${session.id},${body.id},'regular',${`HB ${i}`},${`${suffix} Bill ${String(i).padStart(2,'0')}`},${`2025-02-${String(i+1).padStart(2,'0')}`},${i===26 ? 'private' : 'public'})`;
        }
      }
      const user = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${user},${`${user}@example.test`})`;
      const run = async (jurisdiction = "", state = "", sort = "newest", offset = 0, term: string | null = null) => {
        const [r] = await tx`select public.browse_bills(${suffix},${term}::uuid,${jurisdiction},${state},${sort},25,${offset}) as data`;
        return r.data;
      };
      for (const role of ["anon", "authenticated"]) {
        await tx.unsafe(`set local role ${role}`);
        await tx`select set_config('request.jwt.claim.sub',${role === 'authenticated' ? user : ''},true)`;
        expect((await run()).total).toBe(104);
        expect((await run("federal")).total).toBe(26);
        const georgia = await run("state", "Georgia");
        expect(georgia.total).toBe(26);
        expect(georgia.rows.every((r: any) => r.state_name === "Georgia")).toBe(true);
        expect(georgia.rows[0].identifier).toBe("HB 25");
        expect((await run("state", "Georgia", "oldest")).rows[0].identifier).toBe("HB 0");
        expect((await run("state", "Georgia", "title_asc")).rows[0].identifier).toBe("HB 0");
        expect((await run("state", "Georgia", "title_desc")).rows[0].identifier).toBe("HB 25");
        const next = await run("state", "Georgia", "newest", 25);
        expect(next.rows).toHaveLength(1);
        expect(new Set([...georgia.rows, ...next.rows].map((r: any) => r.id)).size).toBe(26);
        expect((await run("state", "Missing")).total).toBe(0);
        expect((await run("federal", "Georgia")).total).toBe(0);
        expect((await run("unspecified")).total).toBe(26);
        expect((await run("state", "Georgia", "newest", 0, terms[0])).total).toBe(0);
        await tx.unsafe("reset role");
      }
      const admin = crypto.randomUUID();
      await tx`insert into auth.users(id,email) values (${admin},${`${admin}@example.test`})`;
      await tx`insert into admins(user_id) values (${admin})`;
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      await tx.unsafe('set local role authenticated');
      expect((await run()).total).toBe(108);
      expect((await run('state','Georgia')).total).toBe(27);
      await tx.unsafe('reset role');
      await tx`select set_config('request.jwt.claim.sub','',true)`;
      const [contextSearch] = await tx`select public.browse_bills(p_query=>'QA Georgia') as data`;
      expect(contextSearch.data.total).toBe(26);
      // Hiding a legislature hides all its bills, including from totals.
      await tx`update legislative_terms set visibility='private' where id=${terms[1]}`;
      await tx.unsafe("set local role anon");
      expect((await run("state", "Georgia")).total).toBe(0);
      await tx.unsafe("reset role");
      await tx`update legislative_terms set visibility='public' where id=${terms[1]}`;
      await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on)
        select b.term_id,b.session_id,b.body_id,'scale','SCALE '||n,'Scale fixture '||n,'2025-02-01'::date
        from (select * from bills where term_id=${terms[1]} limit 1) b cross join generate_series(1,4000) n`;
      await tx.unsafe("set local statement_timeout='5s'");
      for (const id of ['',user,admin]) {
        await tx`select set_config('request.jwt.claim.sub',${id},true)`;
        await tx.unsafe(`set local role ${id?'authenticated':'anon'}`);
        for (const sort of ['newest','oldest','title_asc','title_desc']) {
          const [r]=await tx`select public.browse_bills(p_term_id=>${terms[1]}::uuid,p_jurisdiction=>'state',p_state=>'Georgia',p_query=>'Scale fixture',p_sort=>${sort}) as data`;
          expect(r.data.total).toBe(4000);
          expect(r.data.rows).toHaveLength(25);
        }
        await tx.unsafe('reset role');
      }
      await tx`select set_config('request.jwt.claim.sub','',true)`;
      await tx.unsafe("set local statement_timeout='60s'");
      // BROWSER_HOOK
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.close(); }
}, 60000);

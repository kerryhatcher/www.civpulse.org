import { expect, test } from "bun:test";
import { SQL } from "bun";

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)(
  "legislative history, identities, provenance, visibility and permissions",
  async () => {
    const sql = new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);
    const rollback = Error("rollback");
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(await Bun.file(new URL('../../supabase/migrations/20261123080000_legislative_history_read_performance.sql', import.meta.url)).text());
        const suffix = crypto.randomUUID();
        const [org] =
          await tx`insert into organizations(name,slug) values ('Legislative QA',${`legislative-${suffix}`}) returning id`;
        const [term] =
          await tx`insert into legislative_terms(organization_id,identifier,name,starts_on,ends_on) values (${org.id},${suffix},'QA legislature','2025-01-01','2026-12-31') returning id`;
        const [session] =
          await tx`insert into legislative_sessions(term_id,identifier,name,starts_on) values (${term.id},'regular','Regular','2025-01-01') returning id`;
        const [second] =
          await tx`insert into legislative_sessions(term_id,identifier,name,starts_on) values (${term.id},'second','Second','2026-01-01') returning id`;
        const [special] =
          await tx`insert into legislative_sessions(term_id,identifier,name,kind,starts_on) values (${term.id},'special','Special','special','2026-08-01') returning id`;
        const [body] =
          await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${org.id},${org.id},'chamber') returning id`;
        const [person] =
          await tx`insert into people(full_name,slug,kind) values ('Legislative Member',${`member-${suffix}`},'other') returning id`;
        const [office] =
          await tx`insert into offices(organization_id,name,district) values (${org.id},'Representative','1') returning id`;
        const [service] =
          await tx`insert into office_terms(office_id,person_id,selection_method,starts_on) values (${office.id},${person.id},'elected','2025-01-01') returning id`;
        await tx`insert into legislative_body_memberships(body_id,office_term_id,starts_on) values (${body.id},${service.id},'2025-01-01')`;
        const [bill] =
          await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,source_system,source_id) values (${term.id},${session.id},${body.id},'regular','HB 1','Public bill','2025-02-01','qa',${suffix}) returning id`;
        // A new annual session does not change a carryover bill's identity; a special session can reuse a number.
        await tx`insert into bill_actions(bill_id,session_id,body_id,occurred_on,kind,description) values (${bill.id},${second.id},${body.id},'2026-02-01','reading','Second-year reading')`;
        await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values (${term.id},${special.id},${body.id},'special','HB 1','Special bill','2026-08-01')`;
        const [hidden] =
          await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on,visibility) values (${term.id},${session.id},${body.id},'regular','HB 2','Hidden bill','2025-02-01','unlisted') returning id`;
        const [version] =
          await tx`insert into bill_versions(bill_id,identifier,title,published_on,text_url) values (${bill.id},'introduced','Introduced','2025-02-01','https://example.test/bill') returning id`;
        const [vote] =
          await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage,reported_yes) values (${second.id},${body.id},'1','2026-02-02','Shall HB 1 pass?','passage','roll_call','passed','complete',1) returning id`;
        await tx`insert into legislative_vote_bills(vote_id,bill_id,version_id) values (${vote.id},${bill.id},${version.id})`;
        await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${vote.id},${service.id},'yes','Yea')`;
        const [voice] =
          await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome,coverage) values (${second.id},${body.id},'2','2026-02-03','Agree to amendment?','amendment','voice','agreed','no_individual_record') returning id`;
        const [sponsor] =
          await tx`insert into bill_sponsorships(bill_id,office_term_id,role,source_role,starts_on) values (${bill.id},${service.id},'cosponsor','Coauthor','2025-02-01') returning id`;
        const [article] =
          await tx`insert into articles(title,url) values ('Bill coverage',${`https://example.test/${suffix}`}) returning id`;
        await tx`insert into article_bills(article_id,bill_id) values (${article.id},${bill.id}),(${article.id},${hidden.id})`;
        const admin = crypto.randomUUID();
        await tx`insert into auth.users(id,email) values (${admin},${`legislative-${suffix}@example.test`})`;
        await tx`insert into admins(user_id) values (${admin})`;
        const reject = async (query: () => Promise<unknown>, code: string) => {
          await tx.unsafe("savepoint rejection");
          try {
            await query();
            throw Error("Expected rejection");
          } catch (e) {
            expect((e as { errno: string }).errno).toBe(code);
          } finally {
            await tx.unsafe("rollback to savepoint rejection");
          }
        };
        await reject(
          () =>
            tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${voice.id},${service.id},'yes','Yea')`,
          "23514",
        );
        await reject(
          () =>
            tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${vote.id},${service.id},'no','Nay')`,
          "23505",
        );
        await reject(
          () =>
            tx`insert into legislative_vote_bills(vote_id,bill_id,version_id) values (${voice.id},${hidden.id},${version.id})`,
          "23514",
        );
        await reject(
          () => tx`delete from people where id=${person.id}`,
          "23503",
        );
        await reject(
          () =>
            tx`update office_terms set person_id=${admin} where id=${service.id}`,
          "23514",
        );
        await tx.unsafe("set local role anon");
        expect(
          (
            await tx`select browse_legislation('bills',null,${{ term_id: term.id }}::jsonb) result`
          )[0].result.total,
        ).toBe(2);
        expect(
          (await tx`select browse_legislation('bills',${hidden.id}) result`)[0]
            .result.rows[0].title,
        ).toBe("Hidden bill");
        expect(
          (
            await tx`select browse_legislation('article_bills',null,${{ bill_id: hidden.id }}::jsonb) result`
          )[0].result.total,
        ).toBe(0);
        expect(
          (
            await tx`select browse_legislation('article_bills',null,${{ bill_id: hidden.id }}::jsonb,'',25,0,${hidden.id}) result`
          )[0].result.total,
        ).toBe(1);
        const record = (
          await tx`select get_person_legislative_record(${person.id}) result`
        )[0].result;
        expect(record.total).toBe(1);
        expect(record.rows[0].choice).toBe("yes");
        expect(record.rows[0].bills[0].id).toBe(bill.id);
        expect(
          (
            await tx`select browse_legislation('legislative_vote_choices',null,${{ vote_id: vote.id }}::jsonb) result`
          )[0].result.rows[0].labels.office_term_id,
        ).toContain("Legislative Member");
        const choiceDetails = (
          await tx`select browse_legislation('legislative_vote_choices',null,${{ vote_id: vote.id }}::jsonb) result`
        )[0].result.rows[0];
        expect(choiceDetails.links.office_term_id).toBe(
          `/people/view/?id=${person.id}`,
        );
        expect(choiceDetails.labels.office_term_id).not.toContain(" ·  · ");
        const billDetails = (
          await tx`select browse_legislation('bills',${bill.id}) result`
        )[0].result.rows[0];
        expect(billDetails.links.body_id).toBe(`/orgs/legislative-${suffix}/`);
        const action = (
          await tx`select browse_legislation('bill_actions',null,${{ bill_id: bill.id }}::jsonb) result`
        )[0].result.rows[0];
        expect(action.labels.bill_id).toBe('HB 1 — Public bill');
        await reject(
          () =>
            tx`select legislative_private.details('bills',${{ id: bill.id }}::jsonb)`,
          "42501",
        );
        await reject(() => tx`select * from bills`, "42501");
        await reject(() => tx`select browse_legislation('admins')`, "22023");
        await tx.unsafe("set local role authenticated");
        await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
        expect(await tx`select * from bills`).toHaveLength(0);
        await reject(
          () =>
            tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on) values (${term.id},${session.id},${body.id},'regular','BAD','Denied','2025-01-01')`,
          "42501",
        );
        await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
        expect(
          (
            await tx`select browse_legislation('bills',null,${{ term_id: term.id }}::jsonb) result`
          )[0].result.total,
        ).toBe(3);
        // A stable provider key supports partial patches and safe repeated imports.
        const bundle = [
          {
            table: "bills",
            data: {
              source_system: "qa",
              source_id: suffix,
              summary: "Imported summary",
            },
          },
        ];
        expect(
          (await tx`select import_legislation(${bundle}::jsonb) result`)[0]
            .result[0].id,
        ).toBe(bill.id);
        expect(
          (await tx`select import_legislation(${bundle}::jsonb) result`)[0]
            .result[0].id,
        ).toBe(bill.id);
        expect(
          (await tx`select summary from bills where id=${bill.id}`)[0].summary,
        ).toBe("Imported summary");
        await reject(
          () =>
            tx`select import_legislation(${[{ table: "bills", data: { id: crypto.randomUUID(), source_system: "qa", source_id: suffix } }]}::jsonb)`,
          "23505",
        );
        const badBundle = [
          {
            table: "bills",
            data: {
              source_system: "qa",
              source_id: suffix,
              title: "Should roll back",
            },
          },
          {
            table: "admins",
            data: { source_system: "qa", source_id: "invalid" },
          },
        ];
        await reject(
          () => tx`select import_legislation(${badBundle}::jsonb)`,
          "22023",
        );
        expect(
          (await tx`select title from bills where id=${bill.id}`)[0].title,
        ).toBe("Public bill");
        await tx`update bill_sponsorships set ends_on='2025-03-01' where id=${sponsor.id}`;
        await tx`update office_terms set ends_on='2026-12-31' where id=${service.id}`;
        await reject(
          () =>
            tx`update office_terms set ends_on='2025-01-31' where id=${service.id}`,
          "23514",
        );
        await tx`update legislative_votes set reported_no=0,reported_other=0 where id=${vote.id}`;
        expect(
          (await tx`select get_legislative_vote_totals(${vote.id}) result`)[0]
            .result.matches_reported,
        ).toBe(true);
        await tx`update legislative_votes set reported_yes=2 where id=${vote.id}`;
        expect(
          (await tx`select get_legislative_vote_totals(${vote.id}) result`)[0]
            .result.matches_reported,
        ).toBe(false);
        await tx`update legislative_votes set visibility='unlisted' where id=${vote.id}`;
        await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
        expect(
          (
            await tx`select browse_legislation('legislative_vote_choices',null,${{ vote_id: vote.id }}::jsonb,'',25,0,null,null,${vote.id}) result`
          )[0].result.total,
        ).toBe(1);
        expect(
          (
            await tx`select get_person_legislative_record(${person.id}) result`
          )[0].result.total,
        ).toBe(0);
        await reject(
          () => tx`select import_legislation(${bundle}::jsonb)`,
          "42501",
        );
        await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
        await tx`update legislative_votes set visibility='public' where id=${vote.id}`;
        await tx`update bills set visibility='private' where id=${bill.id}`;
        await tx`select set_config('request.jwt.claim.sub',${crypto.randomUUID()},true)`;
        expect(
          (
            await tx`select browse_legislation('article_bills',null,${{ bill_id: bill.id }}::jsonb,'',25,0,${bill.id}) result`
          )[0].result.total,
        ).toBe(0);
        expect(
          (
            await tx`select get_person_legislative_record(${person.id}) result`
          )[0].result.rows[0].bills,
        ).toHaveLength(0);
        await tx.unsafe("reset role");
        expect(
          (
            await tx`select count(*)::int count from audit.revisions where table_name='bills' and object_id=${bill.id}`
          )[0].count,
        ).toBe(3);
        await reject(
          () =>
            tx`update offices set district='Renumbered' where id=${office.id}`,
          "23514",
        );
        await tx`update bills set visibility='public' where id=${bill.id}`;
        expect(
          (
            await tx`select get_person_legislative_record(${person.id},null,null,null,25,0,${term.id},'HB 1') result`
          )[0].result.total,
        ).toBe(1);
        expect(
          (
            await tx`select get_person_legislative_record(${person.id},null,null,null,25,0,null,'No such bill') result`
          )[0].result.total,
        ).toBe(0);
        const [unverified] =
          await tx`insert into office_terms(office_id,person_id,selection_method,starts_on,starts_on_precision) values (${office.id},${person.id},'appointed','2024-01-01','year') returning id`;
        await reject(
          () =>
            tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${vote.id},${unverified.id},'yes','Yea')`,
          "23505",
        );
        const [anotherVote] =
          await tx`insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome) values (${second.id},${body.id},'review','2026-02-02','Review membership','procedure','roll_call','passed') returning id`;
        await reject(
          () =>
            tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice) values (${anotherVote.id},${unverified.id},'yes','Yea')`,
          "23514",
        );
        await tx`insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice,membership_review_note) values (${anotherVote.id},${unverified.id},'yes','Yea','Official roll call identifies this member; exact service start remains uncertain.')`;
        expect((await tx`select browse_legislation('legislative_vote_choices',null,${{vote_id: vote.id}}::jsonb,'Legislative Member') result`)[0].result.total).toBe(1);
        await tx`update people set visibility='private' where id=${person.id}`;
        await tx.unsafe("set local role anon");
        expect((await tx`select browse_legislation('legislative_vote_choices',null,${{vote_id: vote.id}}::jsonb) result`)[0].result.rows).toEqual([]);
        expect(
          (
            await tx`select get_person_legislative_record(${person.id}) result`
          )[0].result.total,
        ).toBe(0);
        expect(
          (
            await tx`select browse_legislation('bill_sponsorships',null,${{ bill_id: bill.id }}::jsonb) result`
          )[0].result.total,
        ).toBe(0);
        expect((await tx`select browse_legislation('legislative_vote_choices',null,${{vote_id: vote.id}}::jsonb,'Legislative Member') result`)[0].result.total).toBe(0);
        // Large histories must remain usable under the public API's statement timeout.
        await tx.unsafe('reset role');
        await tx`update people set visibility='public' where id=${person.id}`;
        await tx`with added as (
          insert into legislative_votes(session_id,body_id,identifier,occurred_on,question,category,method,outcome)
          select ${second.id},${body.id},'large-'||n,'2026-02-02','Large history test','procedure','roll_call','not_reported'
          from generate_series(1,3500) n returning id
        ) insert into legislative_vote_choices(vote_id,office_term_id,choice,source_choice)
          select id,${service.id},'yes','Yea' from added`;
        await tx.unsafe('set local role anon');
        await tx`select set_config('request.jwt.claim.sub','',true)`;
        await tx.unsafe("set local statement_timeout='3s'");
        const large = (await tx`select get_person_legislative_record(${person.id},null,null,null,25) result`)[0].result;
        expect(large.total).toBe(3502);
        expect(large.rows).toHaveLength(25);
        expect((await tx`select browse_legislation('legislative_votes',null,${{body_id:body.id}}::jsonb) result`)[0].result.total).toBe(3503);
        await reject(() => tx`select legislative_private.visible_vote_ids()`, '42501');
        throw rollback;
      });
    } catch (e) {
      if (e !== rollback) throw e;
    } finally {
      await sql.close();
    }
  },
  30000,
);

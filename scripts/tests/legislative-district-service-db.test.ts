import { expect, test } from "bun:test";
import { SQL } from "bun";

test.skipIf(!process.env.LEGISLATION_TEST_DATABASE_URL)(
  "district service needs a sourced relationship to a chamber in the same legislature",
  async () => {
    const sql = new SQL(process.env.LEGISLATION_TEST_DATABASE_URL!);
    const rollback = Error("rollback");
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(await Bun.file(new URL("../../supabase/migrations/20261123130000_legislative_district_service.sql", import.meta.url)).text());
        const suffix = crypto.randomUUID();
        const [legislature, chamberOrg, district, other] = await tx`
          insert into organizations(name,slug) values
          ('District QA legislature',${`district-leg-${suffix}`}),
          ('District QA chamber',${`district-chamber-${suffix}`}),
          ('District QA district',${`district-seat-${suffix}`}),
          ('District QA other legislature',${`district-other-${suffix}`}) returning id`;
        const [term] = await tx`insert into legislative_terms(organization_id,identifier,name,starts_on)
          values (${legislature.id},${suffix},'District QA term','2025-01-01') returning id`;
        const [session] = await tx`insert into legislative_sessions(term_id,identifier,name,starts_on)
          values (${term.id},'regular','Regular','2025-01-01') returning id`;
        const [body] = await tx`insert into legislative_bodies(organization_id,legislature_id,kind)
          values (${chamberOrg.id},${legislature.id},'chamber') returning id`;
        const [person] = await tx`insert into people(full_name,slug,kind)
          values ('District QA member',${`district-member-${suffix}`},'other') returning id`;
        const [office] = await tx`insert into offices(organization_id,name,district)
          values (${district.id},'State Representative','District 1') returning id`;
        const [service] = await tx`insert into office_terms(office_id,person_id,selection_method,starts_on)
          values (${office.id},${person.id},'elected','2025-01-01') returning id`;
        const [bill] = await tx`insert into bills(term_id,session_id,body_id,numbering_context,identifier,title,introduced_on)
          values (${term.id},${session.id},${body.id},'regular','HB 1','District QA bill','2025-02-01') returning id`;
        const sponsor = () => tx`insert into bill_sponsorships(bill_id,office_term_id,role,source_role,starts_on)
          values (${bill.id},${service.id},'cosponsor','Official sponsor','2025-02-01')`;
        const rejects = async (query: () => Promise<unknown>) => {
          await tx.unsafe('savepoint rejection');
          try { await query(); throw Error('Expected rejection'); }
          catch (error) { expect((error as { errno: string }).errno).toBe('23514'); }
          finally { await tx.unsafe('rollback to savepoint rejection'); }
        };
        await rejects(sponsor);
        const [relation] = await tx`insert into organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship)
          values (${district.id},${chamberOrg.id},'Legislative district of','Contains legislative district') returning id`;
        await rejects(sponsor); // A relationship without provenance does not qualify.
        await tx`update organization_relationships set source_url='https://example.test/official-roster' where id=${relation.id}`;
        await tx`update organization_relationships set relationship='Related to' where id=${relation.id}`;
        await rejects(sponsor);
        await tx`update organization_relationships set relationship='Legislative district of' where id=${relation.id}`;
        await tx`insert into legislative_bodies(organization_id,legislature_id,kind) values (${other.id},${other.id},'chamber')`;
        await tx`update organization_relationships set related_organization_id=${other.id} where id=${relation.id}`;
        await rejects(sponsor);
        await tx`update organization_relationships set related_organization_id=${chamberOrg.id} where id=${relation.id}`;
        await sponsor();
        await tx`insert into legislative_body_memberships(body_id,office_term_id,starts_on)
          values (${body.id},${service.id},'2025-01-01')`;
        expect((await tx`select count(*)::int count from bill_sponsorships where bill_id=${bill.id}`)[0].count).toBe(1);
        // Service-date validation is still enforced after district reconciliation.
        await rejects(() => tx`insert into bill_sponsorships(bill_id,office_term_id,role,source_role,starts_on)
          values (${bill.id},${service.id},'primary_sponsor','Official sponsor','2024-12-31')`);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    finally { await sql.close(); }
  },
);

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AffiliationRow, Person } from './people';
import { PERSON_COLUMNS } from './people';

interface ProfileOrganization { id: string; slug: string; name: string }

/** Sequential pages stay below the Data API row cap, with stable ordering. */
async function readRows<T>(client: SupabaseClient, table: string, columns: string, order: string[], publicOnly = false): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from(table).select(columns);
    if (publicOnly) query = query.eq('visibility', 'public');
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load build-time ${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** Three bounded request streams replace per-profile affiliation/org queries. */
export async function loadProfileBuildData(client: SupabaseClient) {
  const [people, organizations, affiliations] = await Promise.all([
    readRows<Person>(client, 'people', PERSON_COLUMNS, ['full_name', 'id'], true),
    readRows<ProfileOrganization>(client, 'organizations', 'id, slug, name', ['id']),
    readRows<AffiliationRow>(client, 'person_organizations', 'person_id, organization_id, role', ['person_id', 'organization_id']),
  ]);
  const personById = new Map(people.map(person => [person.id, person]));
  const organizationById = new Map(organizations.map(org => [org.id, org]));
  // Defense in depth: only public people and readable organizations enter HTML.
  const publicAffiliations = affiliations.filter(link => personById.has(link.person_id) && organizationById.has(link.organization_id));
  const byPerson = new Map<string, (ProfileOrganization & { role: string })[]>();
  const byOrganization = new Map<string, { person: Person; role: string }[]>();
  for (const link of publicAffiliations) {
    const person = personById.get(link.person_id)!;
    const organization = organizationById.get(link.organization_id)!;
    const personLinks = byPerson.get(person.id) ?? [];
    personLinks.push({ ...organization, role: link.role });
    byPerson.set(person.id, personLinks);
    const organizationLinks = byOrganization.get(organization.id) ?? [];
    organizationLinks.push({ person, role: link.role });
    byOrganization.set(organization.id, organizationLinks);
  }
  for (const links of byPerson.values()) links.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  for (const links of byOrganization.values()) links.sort((a, b) => a.person.full_name.localeCompare(b.person.full_name, undefined, { sensitivity: 'base' }));
  return { people, byPerson, byOrganization };
}

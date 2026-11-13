import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person } from './people';
import { PERSON_COLUMNS } from './people';
import { readRows } from './build-rows';
import { readBuildOrganizations, readBuildAffiliations } from './organization-build-data';
export { readRows } from './build-rows';

interface ProfileOrganization { id: string; slug: string; name: string }

/** Three bounded request streams replace per-profile affiliation/org queries. */
export async function loadProfileBuildData(client: SupabaseClient) {
  const [people, organizations, affiliations] = await Promise.all([
    readRows<Person>(client, 'people', PERSON_COLUMNS, ['full_name', 'id'], true),
    readBuildOrganizations(client),
    readBuildAffiliations(client),
  ]);
  const personById = new Map(people.map(person => [person.id, person]));
  // Profiles keep their narrow projection even though the shared directory read
  // also carries contact/registration fields for organization pages.
  const organizationById = new Map(organizations.map(({id,slug,name}) => [id, {id,slug,name}]));
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

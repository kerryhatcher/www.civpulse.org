import { getProfileSectionBuildData } from './profile-section-build-data';
import { fetchPublicPeople } from './people';
import { fetchOrganizations } from './organizations';
import { emptyProfileSections } from './profile-sections';
import { profileEvidence } from './profile-evidence';

/** Owner discovery stays public even if a future export contains extra owners. */
export async function getProfileEvidenceOwners() {
  const [sections, people, organizations] = await Promise.all([getProfileSectionBuildData(), fetchPublicPeople(), fetchOrganizations()]);
  return [
    ...people.filter(person => person.visibility === 'public').map(person => ({ kind: 'people' as const, id: person.id, slug: person.slug, name: person.full_name,
      sections: profileEvidence(sections.people.get(person.id) ?? emptyProfileSections(), 'people') })),
    ...organizations.map(org => ({ kind: 'orgs' as const, id: org.id, slug: org.slug, name: org.name,
      sections: profileEvidence(sections.organizations.get(org.id) ?? emptyProfileSections(), 'orgs') })),
  ];
}

import { loadProfileBuildData } from "./profile-build-data";
import type { CandidateStatus, ElectionVisibility } from './elections';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBuildSupabase, personImageUrl } from './supabase-build';

export type PersonVisibility = 'public' | 'unlisted' | 'private';
export type PersonKind = 'elected_official' | 'appointed_official' | 'candidate' | 'other';

export const PERSON_KIND_LABELS: Record<PersonKind, string> = {
  elected_official: 'Elected official',
  appointed_official: 'Appointed official',
  candidate: 'Candidate',
  other: 'Other',
};

export const PERSON_VISIBILITY_LABELS: Record<PersonVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

/** Common affiliation roles offered as suggestions in the admin UI. */
export const COMMON_ROLES = [
  'Member',
  'Owner',
  'Officer',
  'Board member',
  'Director',
  'CEO',
  'President',
  'Employee',
  'Supervisor',
  'Registrar',
  'Clerk',
  'Treasurer',
  'Candidate',
];

export interface Person {
  id: string;
  slug: string;
  full_name: string;
  kind: PersonKind;
  title: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  website_url: string | null;
  social_url: string | null;
  address_line: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  image_path: string | null;
  visibility: PersonVisibility;
}

/** An organization a person is linked to, with the relationship role. */
export interface OrganizationAffiliation {
  id: string;
  slug: string;
  name: string;
  role: string;
}

export interface AffiliationRow {
  person_id: string;
  organization_id: string;
  role: string;
}

/** A race returned by the visibility-aware profile history RPC. */
export interface PersonCandidacy {
  contest_id: string;
  office: string;
  district: string | null;
  seat: string | null;
  party: string | null;
  status: CandidateStatus;
  is_write_in: boolean;
  election_id: string;
  election_name: string;
  election_slug: string;
  election_date: string;
  election_visibility: ElectionVisibility;
  is_current: boolean;
}

export const PERSON_COLUMNS =
  'id, slug, full_name, kind, title, description, email, phone, fax, website_url, social_url, address_line, address_line2, city, state, postal_code, image_path, visibility';

/** The shared person viewer shell. Unlisted and private people are uuid-only. */
export function personHref(person: {
  id: string;
  slug: string;
  visibility: PersonVisibility;
}): string {
  return person.visibility === 'public' ? `/people/${person.slug}/` : `/people/view/?id=${person.id}`;
}

// Share the in-flight snapshot across all static profile routes in this build.
// Development requests reload data so local edits remain visible.
let profileData: ReturnType<typeof loadProfileBuildData> | undefined;
function getProfileBuildData() {
  const supabase = getBuildSupabase();
  if (!supabase) return Promise.resolve({ people: [] as Person[], byPerson: new Map<string, OrganizationAffiliation[]>(), byOrganization: new Map<string, { person: Person; role: string }[]>() });
  if (import.meta.env.DEV) return loadProfileBuildData(supabase);
  return profileData ??= loadProfileBuildData(supabase);
}

/** Public-only, paginated build snapshot; configured backend errors fail the build. */
export async function fetchPublicPeople(): Promise<Person[]> {
  return (await getProfileBuildData()).people;
}

/** Batch public profile affiliations without opening one request per person. */
export async function fetchPublicAffiliationsByPerson(
  personIds: string[],
  supabase?: SupabaseClient | null,
): Promise<Map<string, OrganizationAffiliation[]>> {
  if (supabase === undefined) {
    const { byPerson } = await getProfileBuildData();
    return new Map(personIds.map(id => [id, byPerson.get(id) ?? []]));
  }
  // Explicit clients retain the bounded ID-batch API used by import tooling/tests.
  const grouped = new Map<string, OrganizationAffiliation[]>(personIds.map(id => [id, []]));
  if (!supabase) return grouped;
  const ids = [...grouped.keys()];
  for (let start = 0; start < ids.length; start += 100) {
    for (let offset = 0; ; offset += 1000) {
      // The anon client's existing affiliation RLS excludes hidden people.
      const { data, error } = await supabase.from('person_organizations')
        .select('person_id, role, organization:organizations(id, slug, name)')
        .in('person_id', ids.slice(start, start + 100))
        .order('person_id').order('organization_id').range(offset, offset + 999);
      if (error) throw new Error(`Could not build profile affiliations: ${error.message}`);
      const rows = (data ?? []) as unknown as {
        person_id: string; role: string;
        organization: { id: string; slug: string; name: string } | null;
      }[];
      for (const row of rows) {
        if (row.organization) grouped.get(row.person_id)?.push({ ...row.organization, role: row.role });
      }
      if (rows.length < 1000) break;
    }
  }
  for (const affiliations of grouped.values()) {
    affiliations.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
  return grouped;
}

export async function fetchPublicPeopleForOrganization(organizationId: string): Promise<{ person: Person; role: string }[]> {
  return (await getProfileBuildData()).byOrganization.get(organizationId) ?? [];
}

export { personImageUrl };

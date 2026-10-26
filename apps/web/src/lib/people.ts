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

/** Loads public people at build time; returns an empty list without a database. */
export async function fetchPublicPeople(): Promise<Person[]> {
  const supabase = getBuildSupabase();
  if (!supabase) {
    console.warn('[people] PUBLIC_SUPABASE_* not set; skipping person pages.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('people')
      .select(PERSON_COLUMNS)
      .eq('visibility', 'public')
      .order('full_name');

    if (error) throw error;
    return (data ?? []) as Person[];
  } catch (error) {
    console.warn(`[people] Could not load people: ${String(error)}`);
    return [];
  }
}

/** Batch public profile affiliations without opening one request per person. */
export async function fetchPublicAffiliationsByPerson(
  personIds: string[],
  supabase: SupabaseClient | null = getBuildSupabase(),
): Promise<Map<string, OrganizationAffiliation[]>> {
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

/** Public people linked to an organization, with their role, for org pages. */
export async function fetchPublicPeopleForOrganization(
  organizationId: string,
): Promise<{ person: Person; role: string }[]> {
  const supabase = getBuildSupabase();
  if (!supabase) return [];

  try {
    // The affiliation select policy limits this to links whose person is public.
    const { data: links, error } = await supabase
      .from('person_organizations')
      .select('person_id, role')
      .eq('organization_id', organizationId);

    if (error) throw error;

    const affiliations = (links ?? []) as { person_id: string; role: string }[];
    const ids = affiliations.map((link) => link.person_id);
    if (ids.length === 0) return [];

    const { data: people, error: personError } = await supabase
      .from('people')
      .select(PERSON_COLUMNS)
      .in('id', ids)
      .eq('visibility', 'public')
      .order('full_name');

    if (personError) throw personError;

    const byId = new Map(((people ?? []) as Person[]).map((person) => [person.id, person]));

    return affiliations
      .map((link) => {
        const person = byId.get(link.person_id);
        return person ? { person, role: link.role } : null;
      })
      .filter((value): value is { person: Person; role: string } => value !== null)
      .sort((a, b) =>
        a.person.full_name.localeCompare(b.person.full_name, undefined, { sensitivity: 'base' }),
      );
  } catch (error) {
    console.warn(`[people] Could not load organization people: ${String(error)}`);
    return [];
  }
}

export { personImageUrl };

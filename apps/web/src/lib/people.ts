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

/** Affiliations for a person, joined with the public organization details. */
export async function fetchPublicAffiliations(
  personId: string,
): Promise<OrganizationAffiliation[]> {
  const supabase = getBuildSupabase();
  if (!supabase) return [];

  try {
    const { data: links, error } = await supabase
      .from('person_organizations')
      .select('organization_id, role')
      .eq('person_id', personId);

    if (error) throw error;

    const organizations = (links ?? []) as { organization_id: string; role: string }[];
    const ids = organizations.map((link) => link.organization_id);
    if (ids.length === 0) return [];

    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, slug, name')
      .in('id', ids);

    if (orgError) throw orgError;

    const byId = new Map(
      ((orgs ?? []) as { id: string; slug: string; name: string }[]).map((org) => [org.id, org]),
    );

    return organizations
      .map((link) => {
        const org = byId.get(link.organization_id);
        return org ? { ...org, role: link.role } : null;
      })
      .filter((value): value is OrganizationAffiliation => value !== null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  } catch (error) {
    console.warn(`[people] Could not load affiliations: ${String(error)}`);
    return [];
  }
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

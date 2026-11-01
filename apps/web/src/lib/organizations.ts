import { readBuildOrganizations } from './organization-build-data';
export { ORGANIZATION_COLUMNS } from './organization-build-data';
import { getBuildSupabase, organizationLogoUrl } from './supabase-build';

export interface Organization {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  website_url: string | null;
  social_url: string | null;
  logo_path: string | null;
  sos_control_number?: string | null;
  sos_business_type?: string | null;
  sos_status?: string | null;
  sos_formation_date?: string | null;
  sos_last_annual_registration?: string | null;
  sos_principal_office?: string | null;
  sos_registered_agent?: string | null;
  sos_county?: string | null;
  sos_naics_code?: string | null;
  sos_officers?: string | null;
  sos_record_url?: string | null;
}

/** Public, paginated build snapshot; configured backend failures stop publication. */
export async function fetchOrganizations(): Promise<Organization[]> {
  const client = getBuildSupabase();
  if (!client) return [];
  return readBuildOrganizations(client);
}

export { organizationLogoUrl };

export interface OrganizationRelationship {
  id: string;
  organization_id: string;
  related_organization_id: string;
  relationship: string;
  reverse_relationship: string;
  source_url: string | null;
}

/** Fail the build rather than publish profiles with silently missing links. */
export async function fetchOrganizationRelationships(): Promise<OrganizationRelationship[]> {
  const supabase = getBuildSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('organization_relationships').select('*');
  if (error) throw new Error(`Could not load organization relationships: ${error.message}`);
  return (data ?? []) as OrganizationRelationship[];
}

import { readRows } from './profile-build-data';
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

export const ORGANIZATION_COLUMNS =
  'id, slug, name, description, email, phone, address_line, website_url, social_url, logo_path, sos_control_number, sos_business_type, sos_status, sos_formation_date, sos_last_annual_registration, sos_principal_office, sos_registered_agent, sos_county, sos_naics_code, sos_officers, sos_record_url';

/** Public, paginated build snapshot; configured backend failures stop publication. */
let directoryRows: Promise<Organization[]> | undefined;
export async function fetchOrganizations(): Promise<Organization[]> {
  const client = getBuildSupabase();
  if (!client) return [];
  if (import.meta.env.DEV) return readRows<Organization>(client, 'organizations', ORGANIZATION_COLUMNS, ['name', 'id'], false);
  return directoryRows ??= readRows<Organization>(client, 'organizations', ORGANIZATION_COLUMNS, ['name', 'id'], false);
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

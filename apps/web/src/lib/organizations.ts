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

/**
 * Loads organizations at build time. A build without Supabase env vars, or with
 * an unreachable database, produces an empty directory rather than failing.
 */
export async function fetchOrganizations(): Promise<Organization[]> {
  const supabase = getBuildSupabase();
  if (!supabase) {
    console.warn('[organizations] PUBLIC_SUPABASE_* not set; skipping organization pages.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select(ORGANIZATION_COLUMNS)
      .order('name');

    if (error) throw error;
    return (data ?? []) as Organization[];
  } catch (error) {
    console.warn(`[organizations] Could not load organizations: ${String(error)}`);
    return [];
  }
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

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Organization } from './organizations';
import type { AffiliationRow } from './people';
import { readRows } from './build-rows';

export const ORGANIZATION_COLUMNS =
  'id, slug, name, description, email, phone, address_line, website_url, social_url, logo_path, sos_control_number, sos_business_type, sos_status, sos_formation_date, sos_last_annual_registration, sos_principal_office, sos_registered_agent, sos_county, sos_naics_code, sos_officers, sos_record_url';

interface OrganizationBuildReads {
  organizations?: Promise<Organization[]>;
  affiliations?: Promise<AffiliationRow[]>;
}
const snapshots = new WeakMap<SupabaseClient, OrganizationBuildReads>();
function readsFor(client: SupabaseClient): OrganizationBuildReads {
  let reads = snapshots.get(client);
  if (!reads) { reads = {}; snapshots.set(client, reads); }
  return reads;
}

/** Share in-flight/completed anonymous reads within a production build. Dev
 * intentionally reloads on every call so edits retain their existing freshness. */
export function readBuildOrganizations(client: SupabaseClient): Promise<Organization[]> {
  const load = () => readRows<Organization>(client, 'organizations', ORGANIZATION_COLUMNS, ['name', 'id']);
  if (import.meta.env.DEV) return load();
  return readsFor(client).organizations ??= load();
}
export function readBuildAffiliations(client: SupabaseClient): Promise<AffiliationRow[]> {
  const load = () => readRows<AffiliationRow>(client, 'person_organizations', 'person_id, organization_id, role', ['person_id', 'organization_id']);
  if (import.meta.env.DEV) return load();
  return readsFor(client).affiliations ??= load();
}

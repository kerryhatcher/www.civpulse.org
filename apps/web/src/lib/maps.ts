import { getBuildSupabase } from './supabase-build';

export type MapVisibility = 'public' | 'unlisted' | 'private';

export interface OrganizationRef {
  id: string;
  name: string;
  slug: string;
}

export interface MapConfig {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_map: string;
  visibility: MapVisibility;
  organization_id: string | null;
  organizations?: OrganizationRef | null;
}

export const MAP_COLUMNS =
  'id, slug, name, description, base_map, visibility, organization_id, organizations(id, name, slug)';

/**
 * Loads publicly listed maps at build time. A build without Supabase env vars,
 * or with an unreachable database, produces an empty directory rather than failing.
 */
export async function fetchPublicMaps(): Promise<MapConfig[]> {
  const supabase = getBuildSupabase();
  if (!supabase) {
    console.warn('[maps] PUBLIC_SUPABASE_* not set; skipping public map pages.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('maps')
      .select(MAP_COLUMNS)
      .eq('visibility', 'public')
      .order('name');

    if (error) throw error;
    return (data ?? []) as unknown as MapConfig[];
  } catch (error) {
    console.warn(`[maps] Could not load maps: ${String(error)}`);
    return [];
  }
}

import type { LayerConfig } from './layers';
import type { MapConfig } from './maps';
import type { PublicMapManifest } from './map-build-data';
import { getSupabase } from './supabase';

/** Public snapshots never substitute for the RPC access gate on UUID viewers. */
export async function fetchMapLayers(config: MapConfig, publicPreview = false, client = getSupabase()): Promise<LayerConfig[]> {
  let manifest: PublicMapManifest | undefined;
  if (config.visibility === 'public' && config.public_layers_url) {
    const response = await fetch(config.public_layers_url);
    if (!response.ok) throw new Error(`Could not load published map layers: HTTP ${response.status}`);
    manifest = await response.json() as PublicMapManifest;
    if (publicPreview) return manifest.layers;
    const { data: { session } } = await client.auth.getSession();
    if (!session && !manifest.requiresAccessCheck) return manifest.layers;
  }
  const { data, error } = await client.rpc('get_map_layers', { p_map_id: config.id });
  if (error) throw new Error(error.message);
  return ((data ?? []) as LayerConfig[]).map(layer => {
    const published = layer.visibility === 'public' && manifest?.layers.find(item => item.id === layer.id);
    return published ? { ...layer, source_type: published.source_type, source_url: published.source_url } : layer;
  });
}

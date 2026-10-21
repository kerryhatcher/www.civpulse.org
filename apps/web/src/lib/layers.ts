export type LayerVisibility = 'public' | 'unlisted' | 'private';

export interface LayerConfig {
  id: string;
  name: string;
  description: string | null;
  source_url: string;
  visibility: LayerVisibility;
}

export const LAYER_COLUMNS = 'id, name, description, source_url, visibility';

export const BASE_MAPS = {
  osm: {
    label: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  'osm-humanitarian': {
    label: 'OpenStreetMap Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, tiles by HOT',
    maxZoom: 19,
  },
  'osm-topo': {
    label: 'OpenTopoMap (OpenStreetMap data)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
} as const;

export type BaseMapKey = keyof typeof BASE_MAPS;

export function isBaseMapKey(value: string): value is BaseMapKey {
  return value in BASE_MAPS;
}

export function baseMapLabel(key: string): string {
  return isBaseMapKey(key) ? BASE_MAPS[key].label : key;
}

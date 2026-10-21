import L from 'leaflet';
import { BASE_MAPS, baseMapLabel, isBaseMapKey, type BaseMapKey } from '../lib/basemaps';
import type { LayerConfig } from '../lib/layers';
import type { MapConfig, MapVisibility } from '../lib/maps';
import { getSupabase } from '../lib/supabase';

type MessageKind = 'info' | 'error' | 'success';

type MapRecord = MapConfig;

const VISIBILITY_LABELS: Record<MapVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

function isVisibility(value: string): value is MapVisibility {
  return value === 'public' || value === 'unlisted' || value === 'private';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function setMessage(root: ParentNode, text: string, kind: MessageKind = 'info'): void {
  const element = root.querySelector<HTMLElement>('[data-map-message]');
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
  element.hidden = false;
}

export async function initMapAdmin(): Promise<void> {
  const gate = document.querySelector<HTMLElement>('[data-admin-gate]');
  const denied = document.querySelector<HTMLElement>('[data-admin-denied]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const form = document.querySelector<HTMLFormElement>('[data-map-form]');
  const list = document.querySelector<HTMLElement>('[data-map-list]');
  if (!panel || !form || !list) return;

  const formEl = form;
  const listEl = list;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('/signin/?next=/admin/maps/');
    return;
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  gate?.remove();

  if (!adminRow) {
    if (denied) denied.hidden = false;
    return;
  }

  panel.hidden = false;

  const idField = formEl.querySelector<HTMLInputElement>('input[name="id"]');
  const nameField = formEl.querySelector<HTMLInputElement>('input[name="name"]');
  const slugField = formEl.querySelector<HTMLInputElement>('input[name="slug"]');
  const baseField = formEl.querySelector<HTMLSelectElement>('select[name="base_map"]');
  const visibilityField = formEl.querySelector<HTMLSelectElement>('select[name="visibility"]');
  const organizationField = formEl.querySelector<HTMLSelectElement>('select[name="organization_id"]');
  const layerOptions = formEl.querySelector<HTMLElement>('[data-layer-options]');
  const previewButton = formEl.querySelector<HTMLButtonElement>('[data-map-preview-button]');
  const submitButton = formEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const cancelButton = formEl.querySelector<HTMLButtonElement>('[data-map-cancel]');
  const heading = document.querySelector<HTMLElement>('[data-map-form-title]');

  let slugTouched = false;
  let allMaps: MapRecord[] = [];
  let allLayers: LayerConfig[] = [];
  let organizationNames = new Map<string, string>();
  let layerCounts = new Map<string, number>();
  let selectedLayerIds = new Set<string>();

  // --- Layer picker ------------------------------------------------------

  function renderLayerOptions(): void {
    if (!layerOptions) return;

    if (allLayers.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No layers yet. Create them in the Layers admin.';
      layerOptions.replaceChildren(empty);
      return;
    }

    layerOptions.replaceChildren(
      ...allLayers.map((layer) => {
        const label = document.createElement('label');
        label.className = 'layer-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = layer.id;
        checkbox.checked = selectedLayerIds.has(layer.id);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selectedLayerIds.add(layer.id);
          else selectedLayerIds.delete(layer.id);
        });

        const name = document.createElement('span');
        name.textContent = layer.name;

        const badge = document.createElement('span');
        badge.className = 'visibility-badge';
        badge.textContent = VISIBILITY_LABELS[layer.visibility];

        label.append(checkbox, name, badge);
        return label;
      }),
    );
  }

  function readSelectedLayers(): string[] {
    if (!layerOptions) return [];
    return [...layerOptions.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map(
      (input) => input.value,
    );
  }

  // --- Leaflet preview ---------------------------------------------------

  let map: L.Map | null = null;
  let baseLayer: L.TileLayer | null = null;
  let overlayGroup: L.LayerGroup | null = null;

  function ensureMap(): L.Map | null {
    if (map) return map;
    const container = document.querySelector<HTMLElement>('[data-map-preview]');
    if (!container) return null;

    map = L.map(container, { center: [32.8407, -83.6324], zoom: 8 });
    overlayGroup = L.layerGroup().addTo(map);
    baseLayer = L.tileLayer(BASE_MAPS.osm.url, {
      attribution: BASE_MAPS.osm.attribution,
      maxZoom: BASE_MAPS.osm.maxZoom,
    }).addTo(map);
    setTimeout(() => map?.invalidateSize(), 0);
    return map;
  }

  function setBaseLayer(key: BaseMapKey): void {
    const instance = ensureMap();
    if (!instance) return;
    const config = BASE_MAPS[key];
    if (baseLayer) instance.removeLayer(baseLayer);
    baseLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(instance);
    baseLayer.bringToBack();
  }

  async function renderPreview(): Promise<void> {
    if (!map && !ensureMap()) return;
    const instance = map!;

    const key = baseField && isBaseMapKey(baseField.value) ? baseField.value : 'osm';
    setBaseLayer(key);
    overlayGroup?.clearLayers();

    const selected = new Set(readSelectedLayers());
    const errors: string[] = [];

    for (const layer of allLayers.filter((item) => selected.has(item.id))) {
      try {
        const response = await fetch(layer.source_url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geojson = (await response.json()) as GeoJSON.GeoJsonObject;
        const rendered = L.geoJSON(geojson, {
          style: {
            color: '#ae583b',
            weight: 2,
            fillColor: '#c7d0b5',
            fillOpacity: 0.35,
          },
          pointToLayer: (_feature, latlng) =>
            L.circleMarker(latlng, {
              radius: 6,
              color: '#173e34',
              weight: 2,
              fillColor: '#ae583b',
              fillOpacity: 1,
            }),
        });
        overlayGroup?.addLayer(rendered);
        const bounds = rendered.getBounds();
        if (bounds.isValid()) instance.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      } catch (error) {
        errors.push(`${layer.name} (${error instanceof Error ? error.message : String(error)})`);
      }
    }

    if (errors.length > 0) {
      setMessage(
        formEl,
        `Some layers could not be loaded (check the URL and CORS):\n${errors.join('\n')}`,
        'error',
      );
    }

    instance.invalidateSize();
  }

  previewButton?.addEventListener('click', () => void renderPreview());
  baseField?.addEventListener('change', () => void renderPreview());

  // --- Form --------------------------------------------------------------

  nameField?.addEventListener('input', () => {
    if (!slugField || slugTouched || idField?.value) return;
    slugField.value = slugify(nameField.value);
  });

  slugField?.addEventListener('input', () => {
    slugTouched = true;
  });

  function resetForm(): void {
    formEl.reset();
    if (idField) idField.value = '';
    slugTouched = false;
    selectedLayerIds = new Set();
    renderLayerOptions();
    if (cancelButton) cancelButton.hidden = true;
    if (heading) heading.textContent = 'Add a map';
    if (submitButton) submitButton.textContent = 'Create map';
  }

  async function startEdit(record: MapRecord): Promise<void> {
    if (!idField) return;
    idField.value = record.id;
    if (nameField) nameField.value = record.name;
    if (slugField) slugField.value = record.slug;
    if (baseField) baseField.value = isBaseMapKey(record.base_map) ? record.base_map : 'osm';
    if (visibilityField) visibilityField.value = record.visibility;
    if (organizationField) organizationField.value = record.organization_id ?? '';
    const description = formEl.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
    if (description) description.value = record.description ?? '';

    const { data: links } = await supabase
      .from('map_layers')
      .select('layer_id')
      .eq('map_id', record.id)
      .order('position');
    selectedLayerIds = new Set(
      ((links ?? []) as { layer_id: string }[]).map((link) => link.layer_id),
    );
    renderLayerOptions();

    slugTouched = true;
    if (cancelButton) cancelButton.hidden = false;
    if (heading) heading.textContent = `Editing ${record.name}`;
    if (submitButton) submitButton.textContent = 'Save changes';
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- List and CRUD -----------------------------------------------------

  function renderRow(record: MapRecord): HTMLElement {
    const row = document.createElement('article');
    row.className = 'org-row';

    const info = document.createElement('div');
    info.className = 'org-row-info';
    const name = document.createElement('span');
    name.className = 'org-row-name';
    name.textContent = record.name;
    const meta = document.createElement('span');
    meta.className = 'org-row-meta';

    const organization =
      record.organizations?.name ??
      (record.organization_id ? organizationNames.get(record.organization_id) : undefined);
    const count = layerCounts.get(record.id) ?? 0;
    meta.textContent = `${VISIBILITY_LABELS[record.visibility]} · ${
      organization ? `${organization} · ` : ''
    }${baseMapLabel(record.base_map)} · ${count} layer${count === 1 ? '' : 's'}`;
    info.append(name, meta);
    row.append(info);

    const actions = document.createElement('div');
    actions.className = 'org-row-actions';

    const preview = document.createElement('button');
    preview.type = 'button';
    preview.textContent = 'Preview';
    preview.addEventListener('click', () => {
      void startEdit(record).then(() => renderPreview());
    });

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => void startEdit(record));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button-danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => void removeMap(record));

    actions.append(preview, edit, remove);
    row.append(actions);

    return row;
  }

  async function loadMaps(): Promise<void> {
    const { data, error } = await supabase
      .from('maps')
      .select(
        'id, slug, name, description, base_map, visibility, organization_id, organizations(id, name, slug)',
      )
      .order('name');

    if (error) {
      setMessage(listEl, error.message, 'error');
      return;
    }

    const maps = (data ?? []) as unknown as MapRecord[];
    allMaps = maps;

    const { data: links } = await supabase.from('map_layers').select('map_id');
    layerCounts = new Map();
    for (const link of (links ?? []) as { map_id: string }[]) {
      layerCounts.set(link.map_id, (layerCounts.get(link.map_id) ?? 0) + 1);
    }

    if (maps.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No maps yet. Add the first one above.';
      listEl.replaceChildren(empty);
      return;
    }

    listEl.replaceChildren(...maps.map(renderRow));
  }

  async function loadLayersLibrary(): Promise<void> {
    const { data, error } = await supabase
      .from('layers')
      .select('id, name, description, source_url, visibility')
      .order('name');

    if (error) {
      setMessage(formEl, error.message, 'error');
      return;
    }

    allLayers = (data ?? []) as unknown as LayerConfig[];
    renderLayerOptions();
  }

  async function loadOrganizations(): Promise<void> {
    const { data, error } = await supabase.from('organizations').select('id, name').order('name');

    if (error) {
      setMessage(formEl, error.message, 'error');
      return;
    }

    const organizations = (data ?? []) as { id: string; name: string }[];
    organizationNames = new Map(organizations.map((org) => [org.id, org.name]));

    if (!organizationField) return;

    organizationField.replaceChildren(new Option('No organization', ''));
    for (const org of organizations) {
      organizationField.append(new Option(org.name, org.id));
    }
  }

  async function removeMap(record: MapRecord): Promise<void> {
    if (!window.confirm(`Delete map “${record.name}”? This cannot be undone.`)) return;

    const { error } = await supabase.from('maps').delete().eq('id', record.id);
    if (error) {
      setMessage(listEl, error.message, 'error');
      return;
    }

    setMessage(listEl, 'Map deleted.', 'success');
    await loadMaps();
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void save();
  });

  async function save(): Promise<void> {
    const values = new FormData(formEl);
    const name = String(values.get('name') ?? '').trim();
    const slug = String(values.get('slug') ?? '').trim() || slugify(name);
    const baseMap = String(values.get('base_map') ?? 'osm');
    const visibilityValue = String(values.get('visibility') ?? 'public');
    const organizationId = String(values.get('organization_id') ?? '').trim() || null;
    const layerIds = readSelectedLayers();
    const id = String(values.get('id') ?? '');

    if (!name || !slug) {
      setMessage(formEl, 'A name (and valid slug) is required.', 'error');
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setMessage(formEl, 'Saving…');

    try {
      const payload = {
        slug,
        name,
        description: textOrNull(values.get('description')),
        base_map: isBaseMapKey(baseMap) ? baseMap : 'osm',
        visibility: isVisibility(visibilityValue) ? visibilityValue : 'public',
        organization_id: organizationId,
      };

      const { data: saved, error } = id
        ? await supabase.from('maps').update(payload).eq('id', id).select('id').single()
        : await supabase.from('maps').insert(payload).select('id').single();

      if (error) throw new Error(error.message);

      const mapId = (saved as { id: string } | null)?.id ?? id;
      if (mapId) {
        const { error: clearError } = await supabase.from('map_layers').delete().eq('map_id', mapId);
        if (clearError) throw new Error(clearError.message);

        if (layerIds.length > 0) {
          const { error: linkError } = await supabase
            .from('map_layers')
            .insert(layerIds.map((layer_id, position) => ({ map_id: mapId, layer_id, position })));
          if (linkError) throw new Error(linkError.message);
        }
      }

      setMessage(formEl, id ? 'Map updated.' : 'Map created.', 'success');
      resetForm();
      await loadMaps();
    } catch (error) {
      setMessage(formEl, error instanceof Error ? error.message : String(error), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  cancelButton?.addEventListener('click', () => void resetForm());

  resetForm();
  await loadLayersLibrary();
  await loadOrganizations();
  await loadMaps();

  const editId = new URLSearchParams(window.location.search).get('edit');
  const match = editId ? allMaps.find((record) => record.id === editId) : undefined;
  if (match) {
    await startEdit(match);
    void renderPreview();
  }
}

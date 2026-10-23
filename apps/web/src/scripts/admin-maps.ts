import { historyLink } from '../lib/history';
import { createMapSettingsEditor } from '../lib/map-settings-editor';
import { createGeoJSONLayer } from '../lib/map-rendering';
import L from 'leaflet';
import { BASE_MAPS, baseMapLabel, isBaseMapKey, type BaseMapKey } from '../lib/basemaps';
import { applySwatch, createStyleEditor, type StyleEditor } from '../lib/layer-style-editor';
import {
  fetchLayerGeoJSON,
  geojsonPropertyKeys,
  resolveLayerStyle,
  type LayerConfig,
  type LayerStyle,
} from '../lib/layers';
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
  const viewEditor = createMapSettingsEditor('Map view & downloads', 'Configure center [latitude, longitude], zoom, basemapVisible, note, and downloads. See docs/maps.md.');
  viewEditor.set({});
  formEl.insertBefore(viewEditor.element, formEl.querySelector('.org-form-actions'));
  const initialVisibility = new Map<string, boolean>();
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
  let layerOrder: string[] = [];
  let layerOverrides = new Map<string, LayerStyle>();
  let draggingLayerId: string | null = null;
  const propertyKeyCache = new Map<string, string[]>();

  async function loadPropertyOptions(layer: LayerConfig, editor: StyleEditor): Promise<void> {
    const cached = propertyKeyCache.get(layer.id);
    if (cached) {
      editor.setPropertyOptions(cached);
      return;
    }
    try {
      const keys = geojsonPropertyKeys(await fetchLayerGeoJSON(layer));
      propertyKeyCache.set(layer.id, keys);
      editor.setPropertyOptions(keys);
    } catch {
      editor.setPropertyOptions(null);
    }
  }

  // --- Layer picker ------------------------------------------------------

  function updatePositionLabels(): void {
    if (!layerOptions) return;
    layerOrder.forEach((id, index) => {
      const badge = layerOptions.querySelector<HTMLElement>(
        `.layer-option-wrap[data-layer-id="${id}"] .layer-position`,
      );
      if (badge) badge.textContent = String(index + 1);
    });
  }

  function clearDropMarkers(): void {
    layerOptions
      ?.querySelectorAll<HTMLElement>('[data-drop]')
      .forEach((node) => delete node.dataset.drop);
  }

  function moveLayerNode(fromId: string, targetId: string, after: boolean): void {
    const fromIndex = layerOrder.indexOf(fromId);
    if (fromIndex === -1 || !layerOrder.includes(targetId)) return;

    layerOrder.splice(fromIndex, 1);
    const targetIndex = layerOrder.indexOf(targetId);
    layerOrder.splice(after ? targetIndex + 1 : targetIndex, 0, fromId);

    if (!layerOptions) return;

    const nodes = new Map<string, HTMLElement>();
    layerOptions.querySelectorAll<HTMLElement>('.layer-option-wrap').forEach((node) => {
      if (node.dataset.layerId) nodes.set(node.dataset.layerId, node);
    });

    const anchor = layerOptions.querySelector<HTMLElement>(
      '.layer-option-wrap[data-selected="false"]',
    );
    for (const id of layerOrder) {
      const node = nodes.get(id);
      if (!node) continue;
      if (anchor) layerOptions.insertBefore(node, anchor);
      else layerOptions.append(node);
    }
    updatePositionLabels();
  }

  function renderLayerOption(layer: LayerConfig): HTMLElement {
    const selected = layerOrder.includes(layer.id);

    const wrapper = document.createElement('div');
    wrapper.className = 'layer-option-wrap';
    wrapper.dataset.layerId = layer.id;
    wrapper.dataset.selected = selected ? 'true' : 'false';

    const label = document.createElement('label');
    label.className = 'layer-option';

    const handle = document.createElement('span');
    handle.className = 'layer-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    handle.setAttribute('aria-hidden', 'true');
    handle.draggable = selected;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = layer.id;
    checkbox.checked = selected;

    const position = document.createElement('span');
    position.className = 'layer-position';
    position.setAttribute('aria-hidden', 'true');
    position.hidden = !selected;
    position.textContent = selected ? String(layerOrder.indexOf(layer.id) + 1) : '';

    const swatch = document.createElement('span');
    swatch.className = 'layer-swatch';

    const name = document.createElement('span');
    name.className = 'layer-option-name';
    name.textContent = layer.name;

    const badge = document.createElement('span');
    badge.className = 'visibility-badge';
    badge.textContent = VISIBILITY_LABELS[layer.visibility];

    label.append(handle, checkbox, position, swatch, name, badge);
    wrapper.append(label);

    const details = document.createElement('details');
    details.className = 'layer-style-override';
    details.hidden = !selected;

    const summary = document.createElement('summary');
    summary.textContent = 'Style on this map';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'layer-override-toggle';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    const existing = layerOverrides.get(layer.id);
    toggle.checked = Boolean(existing);
    toggleLabel.append(toggle, document.createTextNode('Override the layer default'));

    const editor = createStyleEditor();
    editor.set(existing ?? layer.style);
    editor.setDisabled(!toggle.checked);
    if (selected) void loadPropertyOptions(layer, editor);

    const syncSwatch = (): void => {
      applySwatch(swatch, resolveLayerStyle(layer.style, layerOverrides.get(layer.id)));
    };
    syncSwatch();

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!layerOrder.includes(layer.id)) layerOrder.push(layer.id);
      } else {
        layerOrder = layerOrder.filter((id) => id !== layer.id);
        layerOverrides.delete(layer.id);
      }
      renderLayerOptions();
    });

    toggle.addEventListener('change', () => {
      editor.setDisabled(!toggle.checked);
      if (toggle.checked) {
        layerOverrides.set(layer.id, editor.get());
        details.open = true;
      } else {
        layerOverrides.delete(layer.id);
        editor.set(layer.style);
      }
      syncSwatch();
    });

    editor.onChange((style) => {
      if (!toggle.checked) return;
      layerOverrides.set(layer.id, style);
      syncSwatch();
    });

    details.append(summary, toggleLabel, editor.element);
    const initialLabel = document.createElement('label');
    initialLabel.className = 'layer-override-toggle';
    const initial = document.createElement('input'); initial.type = 'checkbox';
    initial.checked = initialVisibility.get(layer.id) !== false;
    initialLabel.append(initial, document.createTextNode('Visible when this map opens'));
    initial.addEventListener('change', () => initialVisibility.set(layer.id, initial.checked));
    details.append(initialLabel);
    wrapper.append(details);

    if (selected) {
      handle.addEventListener('dragstart', (event) => {
        draggingLayerId = layer.id;
        wrapper.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', layer.id);
        }
      });
      handle.addEventListener('dragend', () => {
        draggingLayerId = null;
        wrapper.classList.remove('is-dragging');
        clearDropMarkers();
      });
      wrapper.addEventListener('dragover', (event) => {
        if (!draggingLayerId || draggingLayerId === layer.id) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        const rect = wrapper.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        wrapper.dataset.drop = after ? 'after' : 'before';
      });
      wrapper.addEventListener('dragleave', () => {
        delete wrapper.dataset.drop;
      });
      wrapper.addEventListener('drop', (event) => {
        if (!draggingLayerId || draggingLayerId === layer.id) return;
        event.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        const from = draggingLayerId;
        draggingLayerId = null;
        clearDropMarkers();
        moveLayerNode(from, layer.id, after);
      });
    }

    return wrapper;
  }

  function renderLayerOptions(): void {
    if (!layerOptions) return;

    if (allLayers.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No layers yet. Create them in the Layers admin.';
      layerOptions.replaceChildren(empty);
      return;
    }

    const byId = new Map(allLayers.map((layer) => [layer.id, layer]));
    const ordered = [
      ...layerOrder
        .map((id) => byId.get(id))
        .filter((layer): layer is LayerConfig => Boolean(layer)),
      ...allLayers.filter((layer) => !layerOrder.includes(layer.id)),
    ];

    layerOptions.replaceChildren(...ordered.map(renderLayerOption));
    updatePositionLabels();
  }

  function readSelectedLayers(): string[] {
    if (!layerOptions) return [];
    return [
      ...layerOptions.querySelectorAll<HTMLInputElement>(
        '.layer-option input[type="checkbox"]:checked',
      ),
    ].map((input) => input.value);
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

    for (const layer of layerOrder.map(id => allLayers.find(l => l.id === id)).filter((l): l is LayerConfig => Boolean(l) && selected.has(l!.id) && initialVisibility.get(l!.id) !== false)) {
      try {
        const geojson = await fetchLayerGeoJSON(layer);
        const style = resolveLayerStyle(layer.style, layerOverrides.get(layer.id));
        const paneName = 'preview-' + layer.id;
        const pane = instance.getPane(paneName) ?? instance.createPane(paneName);
        pane.style.zIndex = String(400 + layerOrder.indexOf(layer.id) * 2);
        const rendered = createGeoJSONLayer({ ...layer, style }, geojson, { pane: paneName });
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
    layerOrder = [];
    initialVisibility.clear();
    viewEditor.set({});
    layerOverrides = new Map();
    renderLayerOptions();
    if (cancelButton) cancelButton.hidden = true;
    if (heading) heading.textContent = 'Add a map';
    if (submitButton) submitButton.textContent = 'Create map';
  }

  async function startEdit(record: MapRecord): Promise<void> {
    if (!idField) return;
    idField.value = record.id;
    viewEditor.set(record.view_options);
    if (nameField) nameField.value = record.name;
    if (slugField) slugField.value = record.slug;
    if (baseField) baseField.value = isBaseMapKey(record.base_map) ? record.base_map : 'osm';
    if (visibilityField) visibilityField.value = record.visibility;
    if (organizationField) organizationField.value = record.organization_id ?? '';
    const description = formEl.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
    if (description) description.value = record.description ?? '';

    const { data: links } = await supabase
      .from('map_layers')
      .select('layer_id, style, visible_by_default')
      .eq('map_id', record.id)
      .order('position');
    const rows = (links ?? []) as { layer_id: string; style: LayerStyle | null; visible_by_default: boolean }[];
    initialVisibility.clear();
    rows.forEach(row => initialVisibility.set(row.layer_id, row.visible_by_default));
    layerOrder = rows.map((row) => row.layer_id);
    layerOverrides = new Map(
      rows.filter((row) => row.style).map((row) => [row.layer_id, row.style as LayerStyle]),
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
        actions.append(historyLink('maps', record.id));

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
        'id, slug, name, description, base_map, visibility, organization_id, view_options, organizations(id, name, slug)',
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
      .select('id, name, description, source_url, visibility, style, source_type, presentation')
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
        view_options: viewEditor.get(),
      };

      const { error } = await supabase.rpc('save_map', {
        p_map: { ...payload, id: id || null },
        p_layers: layerIds.map(layer_id => ({ layer_id, style: layerOverrides.get(layer_id) ?? null, visible_by_default: initialVisibility.get(layer_id) !== false })),
      });
      if (error) throw new Error(error.message);

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

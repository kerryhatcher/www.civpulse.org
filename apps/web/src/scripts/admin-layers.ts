import { historyLink } from '../lib/history';
import { createMapSettingsEditor } from '../lib/map-settings-editor';
import { applySwatch, createStyleEditor } from '../lib/layer-style-editor';
import {
  DEFAULT_LAYER_STYLE,
  fetchPropertyKeys,
  fetchLayerGeoJSON,
  geojsonPropertyKeys,
  readGeoJSONImport,
  resolveLayerStyle,
  type LayerConfig,
  type LayerVisibility,
} from '../lib/layers';
import { getSupabase } from '../lib/supabase';

type MessageKind = 'info' | 'error' | 'success';

const VISIBILITY_LABELS: Record<LayerVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

function isVisibility(value: string): value is LayerVisibility {
  return value === 'public' || value === 'unlisted' || value === 'private';
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function setMessage(root: ParentNode, text: string, kind: MessageKind = 'info'): void {
  const element = root.querySelector<HTMLElement>('[data-layer-message]');
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
  element.hidden = false;
}

export async function initLayerAdmin(): Promise<void> {
  const gate = document.querySelector<HTMLElement>('[data-admin-gate]');
  const denied = document.querySelector<HTMLElement>('[data-admin-denied]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const form = document.querySelector<HTMLFormElement>('[data-layer-form]');
  const list = document.querySelector<HTMLElement>('[data-layer-list]');
  if (!panel || !form || !list) return;

  const formEl = form;
  const listEl = list;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('/signin/?next=/admin/layers/');
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
  const sourceField = formEl.querySelector<HTMLInputElement>('input[name="source_url"]');
  const visibilityField = formEl.querySelector<HTMLSelectElement>('select[name="visibility"]');
  const submitButton = formEl.querySelector<HTMLButtonElement>('button[type="submit"]');
  const cancelButton = formEl.querySelector<HTMLButtonElement>('[data-layer-cancel]');
  const heading = document.querySelector<HTMLElement>('[data-layer-form-title]');
  const styleHost = formEl.querySelector<HTMLElement>('[data-layer-style-editor]');

  const presentationEditor = createMapSettingsEditor('Layer presentation', 'Configure legend group, titleProperty, searchFields, popupFields, renderer, attribution, sourceUrl, and note. See docs/maps.md.');
  presentationEditor.set({});
  formEl.insertBefore(presentationEditor.element, formEl.querySelector('.org-form-actions'));
  const styleEditor = createStyleEditor({ label: 'Default style' });
  if (styleHost) styleHost.replaceChildren(styleEditor.element);
  else formEl.append(styleEditor.element);

  const typeField = formEl.querySelector<HTMLSelectElement>('select[name="source_type"]')!;
  const fileField = formEl.querySelector<HTMLInputElement>('input[name="geojson_file"]')!;
  const importPanel = formEl.querySelector<HTMLElement>('[data-layer-import]')!;

  function syncSourceType(): void {
    const stored = typeField.value === 'postgis';
    importPanel.hidden = !stored;
    fileField.disabled = !stored;
    if (sourceField) sourceField.required = !stored;
    const label = formEl.querySelector('[data-layer-url-label]');
    if (label) label.textContent = stored ? 'Import from GeoJSON URL (instead of a file)' : 'GeoJSON URL *';
    styleEditor.setPropertyOptions([]);
  }
  typeField.addEventListener('change', syncSourceType);
  fileField.addEventListener('change', () => {
    const file = fileField.files?.[0];
    if (file) void readGeoJSONImport(file, '').then(data => {
      styleEditor.setPropertyOptions(geojsonPropertyKeys(data));
    }).catch(error => setMessage(formEl, error.message, 'error'));
  });

  const propertyKeyCache = new Map<string, string[]>();

  async function suggestProperties(url: string): Promise<void> {
    const trimmed = url.trim();
    if (!trimmed) return;
    const cached = propertyKeyCache.get(trimmed);
    if (cached) {
      styleEditor.setPropertyOptions(cached);
      return;
    }
    try {
      const keys = await fetchPropertyKeys(trimmed);
      propertyKeyCache.set(trimmed, keys);
      styleEditor.setPropertyOptions(keys);
    } catch {
      styleEditor.setPropertyOptions(null);
    }
  }

  sourceField?.addEventListener('blur', () => void suggestProperties(sourceField.value));

  let allLayers: LayerConfig[] = [];

  function resetForm(): void {
    formEl.reset();
    typeField.disabled = false;
    syncSourceType();
    styleEditor.set(DEFAULT_LAYER_STYLE);
    presentationEditor.set({});
    if (idField) idField.value = '';
    if (cancelButton) cancelButton.hidden = true;
    if (heading) heading.textContent = 'Add a layer';
    if (submitButton) submitButton.textContent = 'Create layer';
  }

  function startEdit(layer: LayerConfig): void {
    if (!idField) return;
    fileField.value = '';
    typeField.value = layer.source_type;
    typeField.disabled = true;
    syncSourceType();
    idField.value = layer.id;
    presentationEditor.set(layer.presentation);
    if (nameField) nameField.value = layer.name;
    if (sourceField) sourceField.value = layer.source_url ?? '';
    if (visibilityField) visibilityField.value = layer.visibility;
    const description = formEl.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
    if (description) description.value = layer.description ?? '';
    styleEditor.set(layer.style);
    if (layer.source_type === 'postgis') {
      void fetchLayerGeoJSON(layer).then(data => styleEditor.setPropertyOptions(geojsonPropertyKeys(data)))
        .catch(() => styleEditor.setPropertyOptions(null));
    } else void suggestProperties(layer.source_url ?? '');
    if (cancelButton) cancelButton.hidden = false;
    if (heading) heading.textContent = `Editing ${layer.name}`;
    if (submitButton) submitButton.textContent = 'Save changes';
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderRow(layer: LayerConfig): HTMLElement {
    const row = document.createElement('article');
    row.className = 'org-row';

    const info = document.createElement('div');
    info.className = 'org-row-info';
    const heading = document.createElement('span');
    heading.className = 'org-row-heading';
    const swatch = document.createElement('span');
    swatch.className = 'layer-swatch';
    applySwatch(swatch, resolveLayerStyle(layer.style));
    const name = document.createElement('span');
    name.className = 'org-row-name';
    name.textContent = layer.name;
    heading.append(swatch, name);
    const meta = document.createElement('span');
    meta.className = 'org-row-meta';
    meta.textContent = `${VISIBILITY_LABELS[layer.visibility]} · ${layer.source_type === 'postgis' ? 'Stored in PostGIS' : layer.source_url}`;
    info.append(heading, meta);
    row.append(info);

    const actions = document.createElement('div');
    actions.className = 'org-row-actions';
        actions.append(historyLink('layers', layer.id));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => startEdit(layer));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button-danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => void removeLayer(layer));

    actions.append(edit, remove);
    row.append(actions);

    return row;
  }

  async function loadLayers(): Promise<void> {
    const { data, error } = await supabase
      .from('layers')
      .select('id, name, description, source_url, visibility, style, source_type, presentation')
      .order('name');

    if (error) {
      setMessage(listEl, error.message, 'error');
      return;
    }

    const layers = (data ?? []) as unknown as LayerConfig[];
    allLayers = layers;

    if (layers.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No layers yet. Add the first one above.';
      listEl.replaceChildren(empty);
      return;
    }

    listEl.replaceChildren(...layers.map(renderRow));
  }

  async function removeLayer(layer: LayerConfig): Promise<void> {
    if (!window.confirm(`Delete layer “${layer.name}”? It will be removed from every map.`)) return;

    const { error } = await supabase.from('layers').delete().eq('id', layer.id);
    if (error) {
      setMessage(listEl, error.message, 'error');
      return;
    }

    setMessage(listEl, 'Layer deleted.', 'success');
    await loadLayers();
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void save();
  });

  async function save(): Promise<void> {
    const values = new FormData(formEl);
    const name = String(values.get('name') ?? '').trim();
    const sourceUrl = String(values.get('source_url') ?? '').trim();
    const visibilityValue = String(values.get('visibility') ?? 'public');
    const id = String(values.get('id') ?? '');

    const stored = typeField.value === 'postgis';
    const file = fileField.files?.[0] ?? null;
    if (!name || (!stored && !sourceUrl) || (stored && !id && !file && !sourceUrl)) {
      setMessage(formEl, 'A name and GeoJSON data (file or URL for stored layers) are required.', 'error');
      return;
    }

    if (stored && file && sourceUrl) {
      setMessage(formEl, 'Choose either a file or a URL for this import.', 'error');
      return;
    }
    if (submitButton?.disabled) return;
    if (submitButton) submitButton.disabled = true;
    setMessage(formEl, 'Saving…');

    try {
      const payload = {
        name,
        description: textOrNull(values.get('description')),
        source_url: sourceUrl,
        visibility: isVisibility(visibilityValue) ? visibilityValue : 'public',
        style: styleEditor.get(),
        presentation: presentationEditor.get(),
      };

      let error;
      if (stored) {
        const geojson = file || sourceUrl ? await readGeoJSONImport(file, sourceUrl) : null;
        ({ error } = await supabase.rpc('save_postgis_layer', {
          p_layer: { ...payload, id: id || null }, p_geojson: geojson,
        }));
      } else {
        ({ error } = id
          ? await supabase.from('layers').update(payload).eq('id', id)
          : await supabase.from('layers').insert(payload));
      }

      if (error) throw new Error(error.message);

      setMessage(formEl, id ? 'Layer updated.' : 'Layer created.', 'success');
      resetForm();
      await loadLayers();
    } catch (error) {
      setMessage(formEl, error instanceof Error ? error.message : String(error), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  cancelButton?.addEventListener('click', resetForm);

  resetForm();
  await loadLayers();

  const editId = new URLSearchParams(window.location.search).get('edit');
  const match = editId ? allLayers.find((layer) => layer.id === editId) : undefined;
  if (match) startEdit(match);
}

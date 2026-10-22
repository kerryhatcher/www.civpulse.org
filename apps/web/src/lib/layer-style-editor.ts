import { createMapSettingsEditor } from './map-settings-editor';
import {
  DEFAULT_LAYER_STYLE,
  normalizeLayerStyle,
  normalizePalette,
  type LayerStyle,
} from './layers';

interface FieldDef {
  key: keyof LayerStyle;
  label: string;
  input: 'color' | 'number' | 'text';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

const FIELDS: FieldDef[] = [
  { key: 'color', label: 'Line color', input: 'color' },
  { key: 'weight', label: 'Line width', input: 'number', min: 0, max: 12, step: 0.5 },
  { key: 'opacity', label: 'Line opacity', input: 'number', min: 0, max: 1, step: 0.05 },
  { key: 'fillColor', label: 'Fill color', input: 'color' },
  { key: 'fillOpacity', label: 'Fill opacity', input: 'number', min: 0, max: 1, step: 0.05 },
  { key: 'radius', label: 'Point radius', input: 'number', min: 1, max: 30, step: 1 },
  {
    key: 'dashArray',
    label: 'Dash pattern',
    input: 'text',
    placeholder: 'blank = solid',
  },
];

const UNIFORM_COLOR_FIELDS: (keyof LayerStyle)[] = ['color', 'fillColor'];

export interface StyleEditor {
  element: HTMLElement;
  /** Read the current, normalized style from the controls. */
  get(): LayerStyle;
  /** Apply a style (partial styles merge over the app default). */
  set(style?: Partial<LayerStyle> | null): void;
  /** Enable or disable every control, e.g. when inheriting the layer default. */
  setDisabled(disabled: boolean): void;
  /**
   * Populate the per-record color property dropdown from the source data.
   * Pass `null` when the source could not be read.
   */
  setPropertyOptions(keys: string[] | null): void;
  onChange(listener: (style: LayerStyle) => void): void;
}

function withAlpha(hex: string, alpha: number): string {
  const raw = hex.slice(1);
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Paint a DOM element as a representative swatch for a layer style. */
export function applySwatch(element: HTMLElement, style: LayerStyle): void {
  if (style.categorizeBy) {
    const palette = style.palette;
    const step = 100 / palette.length;
    const stops = palette
      .map((color, index) => `${color} ${index * step}% ${(index + 1) * step}%`)
      .join(', ');
    element.style.background = `linear-gradient(90deg, ${stops})`;
    element.style.borderColor = palette[0];
    element.style.borderWidth = '2px';
    element.style.borderStyle = 'solid';
    return;
  }
  element.style.borderColor = style.color;
  element.style.borderWidth = `${Math.max(1, style.weight)}px`;
  element.style.borderStyle = style.dashArray ? 'dashed' : 'solid';
  element.style.background = withAlpha(style.fillColor, Math.max(style.fillOpacity, 0.25));
}

/** Builds a reusable set of style controls with a live swatch preview. */
export function createStyleEditor(options: { label?: string } = {}): StyleEditor {
  const element = document.createElement('div');
  element.className = 'style-editor';

  if (options.label) {
    const heading = document.createElement('p');
    heading.className = 'style-editor-label';
    heading.textContent = options.label;
    element.append(heading);
  }

  const grid = document.createElement('div');
  grid.className = 'style-editor-grid';

  const inputs = new Map<keyof LayerStyle, HTMLInputElement>();

  for (const field of FIELDS) {
    const label = document.createElement('label');
    label.className = 'field';

    const caption = document.createElement('span');
    caption.textContent = field.label;

    const input = document.createElement('input');
    input.dataset.style = field.key;
    if (field.input === 'color') {
      input.type = 'color';
      input.value = DEFAULT_LAYER_STYLE[field.key] as string;
    } else if (field.input === 'number') {
      input.type = 'number';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(DEFAULT_LAYER_STYLE[field.key]);
    } else {
      input.type = 'text';
      input.maxLength = 40;
      if (field.placeholder) input.placeholder = field.placeholder;
      input.value = String(DEFAULT_LAYER_STYLE[field.key]);
    }

    // Give every input a valid default so `form.reset()` (which runs on save)
    // restores a usable value; a color input with no default warns on reset.
    input.defaultValue = input.value;

    inputs.set(field.key, input);
    label.append(caption, input);
    grid.append(label);
  }

  // --- Per-record coloring ------------------------------------------------

  const categorize = document.createElement('div');
  categorize.className = 'style-categorize';

  const categorizeToggleLabel = document.createElement('label');
  categorizeToggleLabel.className = 'style-categorize-toggle';
  const categorizeToggle = document.createElement('input');
  categorizeToggle.type = 'checkbox';
  categorizeToggleLabel.append(
    categorizeToggle,
    document.createTextNode('Use a different color for each record'),
  );

  const categorizeFields = document.createElement('div');
  categorizeFields.className = 'style-categorize-fields';

  const byLabel = document.createElement('label');
  byLabel.className = 'field';
  const byCaption = document.createElement('span');
  byCaption.textContent = 'Color by property';
  const bySelect = document.createElement('select');
  bySelect.dataset.categorizeBy = '';
  byLabel.append(byCaption, bySelect);

  const paletteLabel = document.createElement('label');
  paletteLabel.className = 'field';
  const paletteCaption = document.createElement('span');
  paletteCaption.textContent = 'Palette (comma-separated hex)';
  const paletteInput = document.createElement('input');
  paletteInput.type = 'text';
  paletteInput.dataset.palette = '';
  paletteInput.placeholder = 'blank = default palette';
  paletteLabel.append(paletteCaption, paletteInput);

  categorizeFields.append(byLabel, paletteLabel);
  categorize.append(categorizeToggleLabel, categorizeFields);

  // --- Preview ------------------------------------------------------------

  const preview = document.createElement('p');
  preview.className = 'style-preview';
  const area = document.createElement('span');
  area.className = 'style-preview-area';
  const point = document.createElement('span');
  point.className = 'style-preview-point';
  const previewLabel = document.createElement('span');
  previewLabel.className = 'style-preview-caption';
  previewLabel.textContent = 'Preview';

  const palettePreview = document.createElement('span');
  palettePreview.className = 'style-palette-preview';

  preview.append(area, point, palettePreview, previewLabel);

  const advanced = createMapSettingsEditor('Icons & exact colors', 'Configure categoryStyles, categoryTarget, colorProperty, icon, iconBy, and icons. Icon URLs must be local assets or HTTP(S). See docs/maps.md for the schema.');
  element.append(grid, categorize, preview, advanced.element);

  const listeners: ((style: LayerStyle) => void)[] = [];

  let propertyKeys: string[] = [];
  let selectedProperty = '';
  let propertyStatus: 'idle' | 'ready' | 'empty' | 'error' = 'idle';

  function renderPropertyOptions(): void {
    const placeholders: Record<typeof propertyStatus, string> = {
      idle: 'Choose GeoJSON data to load properties',
      ready: 'Select a property…',
      empty: 'No properties found in the source',
      error: 'Could not read the source GeoJSON',
    };

    const options: HTMLOptionElement[] = [new Option(placeholders[propertyStatus], '')];
    for (const key of propertyKeys) options.push(new Option(key, key));
    if (selectedProperty && !propertyKeys.includes(selectedProperty)) {
      options.push(new Option(`${selectedProperty} (not in source)`, selectedProperty));
    }

    bySelect.replaceChildren(...options);
    bySelect.disabled = disabled || propertyStatus !== 'ready';
    bySelect.value = selectedProperty;
    if (bySelect.value !== selectedProperty) bySelect.value = '';
  }

  function get(): LayerStyle {
    const raw: Record<string, unknown> = {};
    for (const [key, input] of inputs) raw[key] = input.value;
    raw.categorizeBy = categorizeToggle.checked ? bySelect.value : '';
    raw.palette = normalizePalette(paletteInput.value);
    return normalizeLayerStyle({ ...raw, ...advanced.get() } as Partial<LayerStyle>);
  }

  function updatePreview(style: LayerStyle): void {
    const categorized = Boolean(style.categorizeBy);

    if (categorized) {
      palettePreview.replaceChildren(
        ...style.palette.slice(0, 10).map((color) => {
          const chip = document.createElement('i');
          chip.style.background = color;
          return chip;
        }),
      );
    }
    palettePreview.hidden = !categorized;
    area.hidden = categorized;
    point.hidden = categorized;

    area.style.borderColor = style.color;
    area.style.borderWidth = `${Math.max(1, style.weight)}px`;
    area.style.borderStyle = style.dashArray ? 'dashed' : 'solid';
    area.style.background = withAlpha(style.fillColor, style.fillOpacity);
    point.style.borderColor = style.color;
    point.style.borderWidth = `${Math.max(1, style.weight)}px`;
    point.style.background = withAlpha(style.fillColor, Math.max(style.fillOpacity, 0.4));
    const size = Math.max(6, Math.min(28, style.radius * 2));
    point.style.width = `${size}px`;
    point.style.height = `${size}px`;
  }

  function syncCategorizeControls(): void {
    categorizeFields.hidden = !categorizeToggle.checked;
    for (const key of UNIFORM_COLOR_FIELDS) {
      const input = inputs.get(key);
      if (input) input.disabled = disabled || categorizeToggle.checked;
    }
  }

  function set(style?: Partial<LayerStyle> | null): void {
    const resolved = normalizeLayerStyle(style);
    advanced.set({ categoryStyles: resolved.categoryStyles, categoryTarget: resolved.categoryTarget, colorProperty: resolved.colorProperty, icon: resolved.icon, iconBy: resolved.iconBy, icons: resolved.icons });
    for (const [key, input] of inputs) {
      input.value = String(resolved[key]);
    }
    categorizeToggle.checked = Boolean(resolved.categorizeBy);
    selectedProperty = resolved.categorizeBy;
    paletteInput.value = resolved.palette.join(', ');
    renderPropertyOptions();
    syncCategorizeControls();
    updatePreview(resolved);
  }

  let disabled = false;

  function setDisabled(value: boolean): void {
    disabled = value;
    for (const input of inputs.values()) input.disabled = value;
    advanced.element.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(input => { input.disabled = value; });
    categorizeToggle.disabled = value;
    paletteInput.disabled = value;
    renderPropertyOptions();
    syncCategorizeControls();
  }

  function setPropertyOptions(keys: string[] | null): void {
    if (keys === null) {
      propertyStatus = 'error';
    } else {
      propertyKeys = keys;
      propertyStatus = keys.length > 0 ? 'ready' : 'empty';
    }
    renderPropertyOptions();
  }

  function notify(): void {
    const style = get();
    syncCategorizeControls();
    updatePreview(style);
    for (const listener of listeners) listener(style);
  }

  for (const input of inputs.values()) input.addEventListener('input', notify);
  advanced.element.querySelector('textarea')?.addEventListener('input', notify);
  categorizeToggle.addEventListener('change', notify);
  bySelect.addEventListener('change', notify);
  paletteInput.addEventListener('input', notify);

  set(DEFAULT_LAYER_STYLE);

  return {
    element,
    get,
    set,
    setDisabled,
    setPropertyOptions,
    onChange(listener) {
      listeners.push(listener);
    },
  };
}

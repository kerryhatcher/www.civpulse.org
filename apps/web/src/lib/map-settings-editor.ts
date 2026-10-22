/** Advanced persisted settings stay editable without inventing layer-specific forms. */
export function createMapSettingsEditor(label: string, help: string): {
  element: HTMLElement;
  set(value: unknown): void;
  get(): Record<string, unknown>;
} {
  const details = document.createElement('details'); details.className = 'map-json-settings';
  const summary = document.createElement('summary'); summary.textContent = label;
  const field = document.createElement('label'); field.className = 'field';
  const caption = document.createElement('span'); caption.textContent = `${label} (JSON object)`;
  const input = document.createElement('textarea'); input.spellcheck = false;
  const description = document.createElement('p'); description.className = 'status'; description.textContent = help;
  field.append(caption, input); details.append(summary, description, field);
  function get(): Record<string, unknown> {
    try {
      const value = JSON.parse(input.value || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      input.setCustomValidity(''); return value;
    } catch { input.setCustomValidity('Enter a valid JSON object.'); return {}; }
  }
  input.addEventListener('input', get);
  input.addEventListener('invalid', () => { details.open = true; });
  return { element: details, get, set(value) { input.value = JSON.stringify(value ?? {}, null, 2); input.setCustomValidity(''); } };
}

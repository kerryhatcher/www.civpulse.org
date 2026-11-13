import { parseLegislativeImport, type LegislativeImportRecord } from '../lib/legislative-import';
import { getSupabase } from '../lib/supabase';

export function initLegislativeImport(onSaved: () => Promise<void>) {
  const form = document.querySelector<HTMLFormElement>('[data-legislative-import]')!;
  const file = form.querySelector<HTMLInputElement>('input[type=file]')!;
  const button = form.querySelector<HTMLButtonElement>('button')!;
  const status = form.querySelector<HTMLElement>('[data-import-status]')!;
  let batches: LegislativeImportRecord[][] = [];
  let nextBatch = 0;
  let saved = 0;
  file.addEventListener('change', async () => {
    batches = []; nextBatch = 0; saved = 0; button.disabled = true;
    const selected = file.files?.[0];
    if (!selected) { status.textContent = 'Choose a normalized JSON import file.'; return; }
    try {
      if (selected.size > 20_000_000) throw new Error('Choose a JSON file smaller than 20 MB.');
      const text = await selected.text();
      if (file.files?.[0] !== selected) return;
      batches = parseLegislativeImport(text);
      const records = batches.flat();
      const counts = Object.entries(Object.groupBy(records, row => row.table)).map(([table, rows]) => `${rows!.length} ${table.replaceAll('_', ' ')}`);
      status.textContent = `${records.length} records in ${batches.length} batches: ${counts.join('; ')}. Ready to import.`;
      button.textContent = 'Import records'; button.disabled = false;
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not read the import file.'; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!batches.length || button.disabled) return;
    button.disabled = true; file.disabled = true;
    try {
      while (nextBatch < batches.length) {
        status.textContent = `Saving batch ${nextBatch + 1} of ${batches.length}. ${saved} records saved.`;
        const { error } = await getSupabase().rpc('import_legislation', { p_records: batches[nextBatch] });
        if (error) throw error;
        saved += batches[nextBatch].length; nextBatch++;
      }
      status.textContent = `Import complete. ${saved} records saved in ${batches.length} batches.`;
      file.value = '';
      try { await onSaved(); }
      catch { status.textContent += ' Reload the page to refresh the saved-record list.'; }
    } catch (error) {
      status.textContent = `${saved} records saved. Batch ${nextBatch + 1} stopped: ${error instanceof Error ? error.message : String((error as { message?: string }).message ?? 'Request failed')}. Resume retries the stopped batch using its provider IDs.`;
      button.textContent = 'Resume import'; button.disabled = false;
    } finally { file.disabled = false; }
  });
}

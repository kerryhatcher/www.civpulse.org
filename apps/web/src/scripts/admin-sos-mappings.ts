import type { Election, ElectionDetail } from '../lib/elections';
import type { SosContestMapping } from '../lib/sos-ballot';
import { describeMappingBatch, parseMappingBatch, sameMapping, type MappingSource } from '../lib/sos-mapping-admin';
import { fetchSosJson, resultsFilesOrigin, validatePointer, validateScope } from '../lib/sos-results-reader';
import { getSupabase } from '../lib/supabase';

/** Called only inside the existing authenticated administrator gate. */
export function initSosMappingsAdmin(): void {
  const root = document.querySelector<HTMLElement>('[data-sos-mappings]');
  if (!root) return;
  const select = root.querySelector<HTMLSelectElement>('[data-mapping-election]')!;
  const input = root.querySelector<HTMLTextAreaElement>('[data-mapping-json]')!;
  const file = root.querySelector<HTMLInputElement>('[data-mapping-file]')!;
  const preview = root.querySelector<HTMLButtonElement>('[data-mapping-preview]')!;
  const save = root.querySelector<HTMLButtonElement>('[data-mapping-save]')!;
  const reviewed = root.querySelector<HTMLInputElement>('[data-mapping-reviewed]')!;
  const status = root.querySelector<HTMLElement>('[data-mapping-status]')!;
  const details = root.querySelector<HTMLDetailsElement>('[data-mapping-details]')!;
  const description = root.querySelector<HTMLElement>('[data-mapping-preview-text]')!;
  const supabase = getSupabase();
  let elections: Election[] = [], busy = false, version = 0;
  let prepared: { election: Election; rows: SosContestMapping[]; input: string; summary: string } | null = null;
  function render(): void {
    select.disabled = busy; input.disabled = busy; file.disabled = busy;
    preview.disabled = busy || !select.value || !input.value;
    reviewed.disabled = busy || !prepared;
    save.disabled = busy || !prepared || !reviewed.checked;
  }
  function invalidate(): void { version++; prepared = null; reviewed.checked = false; details.hidden = true; description.textContent = ''; render(); }
  async function rpc(name: string, args: Record<string, unknown>): Promise<any> {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw Error(`Request rejected: ${name}. Review permissions and ballot membership, then validate again.`);
    return data;
  }
  async function json(url: string): Promise<unknown> {
    return fetchSosJson(url, fetch, 'no-store');
  }
  select.addEventListener('change', invalidate);
  input.addEventListener('input', invalidate);
  reviewed.addEventListener('change', render);
  file.addEventListener('change', async () => {
    invalidate(); const selected = file.files?.[0], token = version;
    if (!selected) return;
    if (selected.size > 2097152) { status.textContent = 'Mapping file exceeds 2 MiB.'; return; }
    try { const value = await selected.text(); if (token !== version) return; input.value = value; render(); status.textContent = 'File loaded. Validate and review before saving.'; }
    catch { if (token === version) status.textContent = 'Could not read mapping file.'; }
  });
  preview.addEventListener('click', async () => {
    if (preview.disabled) return;
    invalidate(); const token = version, election = elections.find(e => e.id === select.value);
    if (!election) return;
    busy = true; render(); status.textContent = 'Validating ballot targets and pinned source identities…';
    try {
      const rows = parseMappingBatch(input.value);
      const ballot = await rpc('get_election', { p_id:election.id });
      if (ballot?.status !== 'ok' || ballot.election?.id !== election.id) throw Error('Election unavailable.');
      const scopes = new Map<string, MappingSource>();
      const ids = [...new Set(rows.map(row => row.jurisdiction_id))];
      let snapshot: string;
      if (election.visibility === 'public') {
        const origin = resultsFilesOrigin(import.meta.env.PUBLIC_RESULTS_FILES_ORIGIN);
        const pointer = validatePointer(await json(`${origin}/elections/${election.id}/latest.json`), election.id);
        if (pointer.source_url !== election.results_json_url) throw Error('Published source URL differs from the saved election source.');
        snapshot = pointer.snapshot_id;
        for (const [index, id] of ids.entries()) {
          status.textContent = `Validating source jurisdiction ${index + 1}/${ids.length}…`;
          const jurisdiction = pointer.jurisdictions.find(j => j.id === id);
          if (!jurisdiction?.url) throw Error(`Source jurisdiction ${id} is unavailable.`);
          const scope = validateScope(await json(jurisdiction.url), pointer, id);
          scopes.set(id, { name:scope.jurisdiction.name, items:scope.items });
        }
      } else {
        const meta = await rpc('get_sos_results', { p_election_id:election.id });
        if (meta?.status !== 'ok' || meta.source_url !== election.results_json_url || !Array.isArray(meta.jurisdictions)) throw Error('Source snapshot unavailable or source URL changed.');
        snapshot = meta.snapshot_id;
        for (const id of ids) {
          const index = meta.jurisdictions.findIndex((j: any) => j.id === id);
          const jurisdiction = meta.jurisdictions[index];
          if (!jurisdiction || !Number.isInteger(jurisdiction.item_count) || jurisdiction.item_count < 0 || jurisdiction.item_count > 10000) throw Error(`Source jurisdiction ${id} is unavailable.`);
          const items: MappingSource['items'] = [];
          for (let offset = 0; offset < jurisdiction.item_count; offset += 10) {
            const page = await rpc('get_sos_results', { p_election_id:election.id,p_snapshot_id:snapshot,p_jurisdiction_index:index,p_offset:offset,p_limit:10 });
            if (page?.status !== 'ok' || page.snapshot_id !== snapshot || !Array.isArray(page.items) || page.items.length !== Math.min(10,jurisdiction.item_count-offset)) throw Error('Incomplete pinned source snapshot.');
            items.push(...page.items);
          }
          scopes.set(id, { name:jurisdiction.name, items });
        }
      }
      const existing = await rpc('get_sos_results_mappings', { p_election_id:election.id });
      if (existing?.status !== 'ok' || !Array.isArray(existing.mappings)) throw Error('Existing mapping readback unavailable.');
      const replaced = existing.mappings.filter((saved: SosContestMapping) => rows.some(row => row.jurisdiction_id === saved.jurisdiction_id && row.source_contest_id === saved.source_contest_id && !sameMapping(row,saved)));
      const summary = `${election.name} · ${election.election_date} · ${election.visibility}\nElection ${election.id}\nSource snapshot ${snapshot}\n${rows.length} mappings across ${ids.length} jurisdictions\n\n${describeMappingBatch(rows, ballot as ElectionDetail, scopes)}\n\nExisting links replaced (${replaced.length}):\n${JSON.stringify(replaced,null,2)}`;
      if (token !== version) return;
      prepared = { election, rows, input:input.value, summary }; description.textContent = summary; details.hidden = false;
      status.textContent = `Validated ${rows.length} mappings. Review every link and check the approval box before saving. No changes saved.`;
    } catch (error) { if (token === version) status.textContent = error instanceof Error ? error.message : 'Validation failed.'; }
    finally { busy = false; render(); }
  });
  save.addEventListener('click', async () => {
    if (save.disabled || !prepared || prepared.input !== input.value || prepared.election.id !== select.value) return;
    const batch = prepared, token = version;
    busy = true; render(); let accepted = 0, failure = '';
    try {
      for (const row of batch.rows) {
        if (token !== version) throw Error('Election details changed. Validate again before continuing.');
        status.textContent = `Saving mapping ${accepted + 1}/${batch.rows.length}. Keep this page open…`;
        await rpc('put_sos_results_mapping', { p_election_id:batch.election.id,p_jurisdiction_id:row.jurisdiction_id,p_source_contest_id:row.source_contest_id,p_contest_id:row.contest_id ?? null,p_question_id:row.question_id ?? null,p_choices:row.choices });
        accepted++;
      }
    } catch (error) { failure = error instanceof Error ? error.message : 'Save interrupted.'; }
    try {
      const readback = await rpc('get_sos_results_mappings', { p_election_id:batch.election.id });
      if (readback?.status !== 'ok' || !Array.isArray(readback.mappings)) throw Error('Mapping readback unavailable.');
      const verified = batch.rows.filter(row => readback.mappings.some((saved: SosContestMapping) => sameMapping(row,saved))).length;
      status.textContent = `${verified}/${batch.rows.length} mappings verified in saved readback. ${failure || (verified === batch.rows.length ? 'Saved. Verify the public ballot in each selected county; a static rebuild may still be pending.' : 'Readback differs. Validate and review again before retrying.')} ${accepted} requests acknowledged. Earlier accepted rows remain saved; unchanged retries are idempotent.`;
    } catch { status.textContent = `${accepted}/${batch.rows.length} requests acknowledged, but saved readback could not be verified. ${failure} Validate and review again before retrying; the last request may have committed.`; }
    prepared = null; reviewed.checked = false; busy = false; render();
  });
  document.addEventListener('elections-updated', event => {
    const selected = select.value;
    elections = (event as CustomEvent<Election[]>).detail;
    invalidate();
    select.replaceChildren(new Option('Select an election…', ''), ...elections.map(e => new Option(`${e.name} · ${e.election_date} · ${e.visibility}`,e.id)));
    select.value = elections.some(e => e.id === selected) ? selected : ''; render();
  });
  render();
}

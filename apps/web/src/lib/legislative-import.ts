import { legislativeResources } from './legislation';

export interface LegislativeImportRecord { table: string; data: Record<string, unknown> }
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
export function parseLegislativeImport(text: string): LegislativeImportRecord[][] {
  if (new TextEncoder().encode(text).length > 20_000_000) throw new Error('Choose a JSON file smaller than 20 MB.');
  const records: unknown = JSON.parse(text);
  if (!Array.isArray(records) || !records.length || records.length > 20_000) throw new Error('Provide an array of 1–20,000 records.');
  const keys = new Set<string>();
  const batches: LegislativeImportRecord[][] = [];
  let batch: LegislativeImportRecord[] = [];
  let batchBytes = 2; // JSON array brackets; commas are counted as records are added.
  for (const [index, item] of records.entries()) {
    if (!item || typeof item !== 'object' || !legislativeResources[item.table] || !item.data || typeof item.data !== 'object' || Array.isArray(item.data)) throw new Error(`Invalid record ${index + 1}: provide table and data.`);
    const data = item.data as Record<string, unknown>;
    if (['source_system', 'source_id'].some(key => typeof data[key] !== 'string' || !(data[key] as string).trim())) throw new Error(`Record ${index + 1} needs source_system and source_id.`);
    const fields = new Set(['id', ...legislativeResources[item.table].fields.map(field => field.name)]);
    if (Object.keys(data).some(key => !fields.has(key))) throw new Error(`Unknown field in record ${index + 1}.`);
    const key = JSON.stringify([item.table, data.source_system, data.source_id]);
    if (keys.has(key)) throw new Error(`Repeated provider key in record ${index + 1}.`);
    keys.add(key);
    const record = { table: item.table, data };
    const recordBytes = bytes(record);
    if (recordBytes + 2 > 1_900_000) throw new Error(`Record ${index + 1} exceeds the API batch limit.`);
    if (batch.length === 100 || batchBytes + recordBytes + (batch.length ? 1 : 0) > 1_900_000) {
      batches.push(batch); batch = []; batchBytes = 2;
    }
    batchBytes += recordBytes + (batch.length ? 1 : 0);
    batch.push(record);
  }
  if (batch.length) batches.push(batch);
  return batches;
}

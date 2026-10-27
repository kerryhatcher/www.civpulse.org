import {readBuildRpc} from './build-read';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LegislativeRow } from './legislation';

const PAGE_SIZE = 100;
const CONCURRENCY = 3;
const MAX_ROWS = 100_000;
interface BuildReads {
  active: number;
  waiting: (() => void)[];
  tables: Map<string, Promise<LegislativeRow[]>>;
  expires: number;
}
const clients = new WeakMap<SupabaseClient, BuildReads>();
function readsFor(client: SupabaseClient): BuildReads {
  let reads = clients.get(client);
  if (!reads || (import.meta.env?.DEV && Date.now() >= reads.expires && !reads.active)) {
    reads = { active: 0, waiting: [], tables: new Map(), expires: Date.now() + 30_000 };
    clients.set(client, reads);
  }
  return reads;
}
async function bounded<T>(reads: BuildReads, run: () => PromiseLike<T>): Promise<T> {
  if (reads.active >= CONCURRENCY) await new Promise<void>(resolve => reads.waiting.push(resolve));
  else reads.active++;
  try { return await run(); }
  finally {
    const next = reads.waiting.shift();
    if (next) next();
    else reads.active--;
  }
}

/** Build-only, anonymous discovery reads. Never pass direct-ID or hidden contexts.
 * Share tables across profiles/archives and keep at most three RPCs in flight,
 * including when only one large table remains. No cross-build/disk cache. */
export function readPublicLegislationTable(client: SupabaseClient, table: string): Promise<LegislativeRow[]> {
  const reads = readsFor(client);
  const cached = reads.tables.get(table);
  if (cached) return cached;
  const request = loadTable(client, reads, table);
  reads.tables.set(table, request);
  request.catch(() => { if (reads.tables.get(table) === request) reads.tables.delete(table); });
  return request;
}
async function loadTable(client: SupabaseClient, reads: BuildReads, table: string): Promise<LegislativeRow[]> {
  const started = performance.now();
  async function page(offset: number, expected?: number) {
    const { data, error } = await bounded(reads, () => readBuildRpc(client, 'browse_legislation', {p_table:table,p_offset:offset,p_limit:PAGE_SIZE}));
    if (error) throw new Error(`Public legislation build failed (${table}, offset ${offset}): ${error.message}`);
    if (!data || !Array.isArray(data.rows) || !Number.isSafeInteger(data.total) || data.total < 0 || data.total > MAX_ROWS) throw new Error(`Invalid public legislation page (${table})`);
    if (expected !== undefined && data.total !== expected) throw new Error(`Public legislation totals changed (${table})`);
    if (data.rows.length !== Math.min(PAGE_SIZE, data.total - offset)) throw new Error(`Incomplete public legislation export (${table}, offset ${offset})`);
    for (const row of data.rows) {
      if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)) throw new Error(`Invalid public legislative record (${table})`);
      if (row.visibility !== 'public') throw new Error(`Non-public legislative record in discovery export (${table})`);
    }
    return data as { rows: LegislativeRow[]; total: number };
  }
  const first = await page(0), pages = Math.ceil(first.total / PAGE_SIZE);
  const chunks: LegislativeRow[][] = [first.rows];
  let next = 1, failed = false;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(0, pages - 1)) }, async () => {
    while (!failed && next < pages) {
      const index = next++;
      try { chunks[index] = (await page(index * PAGE_SIZE, first.total)).rows; }
      catch (error) { failed = true; throw error; }
    }
  }));
  const rows = chunks.flat(), seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Invalid or repeated public legislative record (${table})`);
    seen.add(row.id);
  }
  console.info(`Public legislation build: ${table} (${rows.length} rows, ${Math.max(1, pages)} pages, ${Math.round(performance.now() - started)}ms)`);
  return rows;
}

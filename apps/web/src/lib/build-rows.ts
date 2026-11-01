import type { SupabaseClient } from '@supabase/supabase-js';

/** Sequential pages stay below the Data API row cap, with stable ordering. */
export async function readRows<T>(client: SupabaseClient, table: string, columns: string, order: string[], publicOnly = false): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from(table).select(columns);
    if (publicOnly) query = query.eq('visibility', 'public');
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load build-time ${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

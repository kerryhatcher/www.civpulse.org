import { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? null, null, 2) }] };
}

export function fail(error: unknown) {
  return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
}

export function defined<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Common registration/error handling; the database still enforces every write. */
export function createToolkit(server: McpServer, supabase: SupabaseClient) {
  let adminCheck: Promise<void> | undefined;
  function ensureAdmin(): Promise<void> {
    return adminCheck ??= (async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Admin access required');
    })();
  }

  function register<S extends z.ZodRawShape>(name: string, description: string, shape: S,
    run: (input: z.infer<z.ZodObject<S>>) => Promise<unknown>,
    options: { write?: boolean; destructive?: boolean; idempotent?: boolean; ownProfile?: boolean } = {}) {
    server.registerTool(name, {
      description, inputSchema: z.object(shape), annotations: {
        readOnlyHint: !options.write, destructiveHint: options.destructive ?? Boolean(options.write),
        idempotentHint: options.idempotent ?? !options.write, openWorldHint: false,
      },
    }, async input => {
      try {
        if (options.write && !options.ownProfile) await ensureAdmin();
        return ok(await run(input as z.infer<z.ZodObject<S>>));
      } catch (error) { return fail(error); }
    });
  }

  function readRpc(name: string, description: string, shape: z.ZodRawShape, rpc: string,
    args: (input: Record<string, unknown>) => Record<string, unknown>) {
    register(name, description, shape, async input => {
      const { data, error } = await supabase.rpc(rpc, args(input as Record<string, unknown>));
      if (error) throw new Error(error.message);
      return data;
    });
  }

  function getRpc(name: string, description: string, rpc: string) {
    readRpc(name, description, { id: z.string().uuid() }, rpc, ({ id }) => ({ p_id: id }));
  }

  function create(resource: string, table: string, description: string, shape: z.ZodRawShape, columns = '*') {
    register(`create_${resource}`, description, shape, async input => {
      const { data, error } = await supabase.from(table).insert(defined(input)).select(columns).single();
      if (error) throw new Error(error.message);
      return data;
    }, { write: true, destructive: false });
  }

  function update(resource: string, table: string, description: string, shape: z.ZodRawShape, columns = '*') {
    register(`update_${resource}`, description, { id: z.string().uuid(), ...z.object(shape).partial().shape }, async ({ id, ...rest }) => {
      const patch = defined(rest);
      if (!Object.keys(patch).length) throw new Error('Provide at least one field to update');
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select(columns).single();
      if (error) throw new Error(error.message);
      return data;
    }, { write: true, idempotent: true });
  }

  function remove(resource: string, table: string, description: string) {
    register(`delete_${resource}`, description, { id: z.string().uuid() }, async ({ id }) => {
      const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
      if (error) throw new Error(error.message);
      return { deleted: data?.length ?? 0, id };
    }, { write: true, idempotent: true });
  }

  function relationship(resource: string, table: string, keyNames: string[], fields: z.ZodRawShape) {
    const keys = Object.fromEntries(keyNames.map(key => [key, z.string().uuid()]));
    create(resource, table, `Create a ${resource.replaceAll('_', ' ')} link (admin only).`, { ...keys, ...fields });
    register(`update_${resource}`, `Update link fields without changing either endpoint (admin only).`,
      { ...keys, ...z.object(fields).partial().shape }, async input => {
        const values = input as Record<string, unknown>;
        const patch = defined(Object.fromEntries(Object.entries(values).filter(([key]) => !keyNames.includes(key))));
        if (!Object.keys(patch).length) throw new Error('Provide at least one field to update');
        let query = supabase.from(table).update(patch);
        for (const key of keyNames) query = query.eq(key, values[key]);
        const { data, error } = await query.select('*').single();
        if (error) throw new Error(error.message);
        return data;
      }, { write: true, idempotent: true });
    register(`delete_${resource}`, `Delete only this ${resource.replaceAll('_', ' ')} link (admin only).`, keys, async input => {
      let query = supabase.from(table).delete();
      for (const key of keyNames) query = query.eq(key, (input as Record<string, unknown>)[key]);
      const { data, error } = await query.select(keyNames.join(','));
      if (error) throw new Error(error.message);
      return { deleted: data?.length ?? 0, ...input };
    }, { write: true, idempotent: true });
  }

  return { register, readRpc, getRpc, create, update, remove, relationship, ensureAdmin };
}

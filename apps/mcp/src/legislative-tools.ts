import type { McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createToolkit } from "./toolkit";
import { legislativeResources } from "../../web/src/lib/legislation";
import { readGeorgiaSource, readGeorgiaSourceViaReader } from "./georgia-source";

export function registerLegislativeTools(
  server: McpServer,
  supabase: SupabaseClient,
  sourceReaderUrl?: string,
) {
  const { readRpc, register } = createToolkit(server, supabase);
  register(
    "get_georgia_legislative_source",
    "Read official Georgia General Assembly sessions, chamber rosters, vote lists or vote details with provenance and pagination. Use numeric official member IDs to reconcile an existing person and dated office term before import_legislation. isRollCall denotes attendance, not a legislative vote. This read-only tool never imports or guesses identities, outcomes or missing choices.",
    {
      resource: z.enum(['sessions', 'members', 'votes', 'vote']),
      session_id: z.number().int().positive().optional(),
      chamber: z.enum(['house', 'senate']).optional(),
      vote_id: z.number().int().positive().optional(),
      member_id: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    },
    input => sourceReaderUrl ? readGeorgiaSourceViaReader(input,sourceReaderUrl) : readGeorgiaSource(input),
  );
  readRpc(
    "browse_legislation",
    "Browse legislative terms, sessions, bills, sponsorships, actions, votes and media links. Visibility is enforced for every referenced object. Use id for a known unlisted record; bill_id/person_id provide direct unlisted context. Results include total and bounded rows with reference labels.",
    {
      table: z
        .enum(Object.keys(legislativeResources) as [string, ...string[]])
        .default("bills"),
      id: z.string().uuid().optional(),
      filters: z.record(z.string(), z.unknown()).default({}),
      query: z.string().max(500).default(""),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
      bill_id: z.string().uuid().optional(),
      person_id: z.string().uuid().optional(),
      vote_id: z.string().uuid().optional(),
    },
    "browse_legislation",
    ({
      table,
      id,
      filters,
      query,
      limit,
      offset,
      bill_id,
      person_id,
      vote_id,
    }) => ({
      p_table: table,
      p_id: id ?? null,
      p_filters: filters,
      p_query: query,
      p_limit: limit,
      p_offset: offset,
      p_bill_id: bill_id ?? null,
      p_person_id: person_id ?? null,
      p_vote_id: vote_id ?? null,
    }),
  );
  readRpc(
    "get_legislative_vote_totals",
    "Compare visible member choices against official reported totals; null comparison means incomplete coverage or unspecified totals.",
    { vote_id: z.string().uuid() },
    "get_legislative_vote_totals",
    ({ vote_id }) => ({ p_vote_id: vote_id }),
  );
  readRpc(
    "get_person_legislative_record",
    "Get historical member vote choices linked to the office held at the time. Missing choices are unknown, never inferred absences. Procedural choices are not endorsements.",
    {
      person_id: z.string().uuid(),
      session_id: z.string().uuid().optional(),
      body_id: z.string().uuid().optional(),
      category: z.string().optional(),
      term_id: z.string().uuid().optional(),
      bill_query: z.string().max(500).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    },
    "get_person_legislative_record",
    ({
      person_id,
      session_id,
      body_id,
      category,
      limit,
      offset,
      term_id,
      bill_query,
    }) => ({
      p_person_id: person_id,
      p_session_id: session_id ?? null,
      p_body_id: body_id ?? null,
      p_category: category ?? null,
      p_term_id: term_id ?? null,
      p_bill_query: bill_query ?? null,
      p_limit: limit,
      p_offset: offset,
    }),
  );
  register(
    "import_legislation",
    "Import up to 1,000 normalized legislative records in ordered, atomic batches of at most 100 (admin only). Each batch commits separately. On a failed batch, returns partial status and next_offset for an idempotent retry; later batches are not attempted. Parents must precede children. Preserve original source IDs, choices and provenance; never guess identities. Default mode=atomic preserves the original single-batch transaction and response (at most 100 rows). Explicit mode=batched enables resumable multi-batch imports. Preserve reviewed attendance classifications.",
    {
      records: z.array(z.object({
        table: z.enum(Object.keys(legislativeResources) as [string, ...string[]]),
        data: z.record(z.string(), z.unknown()),
      })).max(1000),
      mode: z.enum(["atomic", "batched"]).default("atomic"),
      start_offset: z.number().int().min(0).max(1000).default(0),
    },
    async ({ records, start_offset, mode }) => {
      if (mode === "atomic") {
        if (records.length > 100 || start_offset !== 0) throw new Error("Atomic imports require at most 100 records and start_offset=0; use mode=batched explicitly for larger imports");
        const { data, error } = await supabase.rpc("import_legislation", { p_records: records });
        if (error) throw new Error(error.message);
        return data;
      }
      if (start_offset > records.length) throw new Error("start_offset exceeds bundle length");
      if (new TextEncoder().encode(JSON.stringify(records)).byteLength > 2_000_000) {
        throw new Error("Provide at most 2 MB of normalized records");
      }
      let offset = start_offset;
      while (offset < records.length) {
        const batch = records.slice(offset, offset + 100);
        try {
          const { error } = await supabase.rpc("import_legislation", { p_records: batch });
          if (error) throw new Error(error.message);
        } catch (error) {
          return {
            status: "partial", imported_count: offset - start_offset,
            next_offset: offset, total: records.length,
            error: error instanceof Error ? error.message : "Import batch failed",
            retry_note: "Retry this bundle from next_offset. Provider keys make a retry safe if the last response was uncertain.",
          };
        }
        offset += batch.length;
      }
      return { status: "complete", imported_count: offset - start_offset, next_offset: offset, total: records.length };
    },
    { write: true, idempotent: true },
  );

  const tableSchema = z.enum(
    Object.keys(legislativeResources) as [string, ...string[]],
  );
  register(
    "describe_legislative_resource",
    "Get fields, allowed choices, required values and foreign-key targets for a legislative resource before editing or importing.",
    { table: tableSchema },
    async ({ table }) => legislativeResources[table],
  );
  register(
    "save_legislative_record",
    "Create or patch a legislative record (admin only). First use describe_legislative_resource. Supply id to patch an existing row; omit it to create. Context cannot be reassigned. For repeatable imports use import_legislation with provider IDs.",
    {
      table: tableSchema,
      id: z.string().uuid().optional(),
      data: z.record(z.string(), z.unknown()),
    },
    async ({ table, id, data }) => {
      const values = legislativeInputSchema(table, Boolean(id)).parse(data);
      if (!Object.keys(values).length)
        throw new Error("Provide at least one field");
      const query = id
        ? supabase.from(table).update(values).eq("id", id)
        : supabase.from(table).insert(values);
      const result = await query.select("*").single();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    { write: true },
  );
  register(
    "delete_legislative_record",
    "Delete a legislative record (admin only). Referenced records must be reconciled first; audit history remains.",
    { table: tableSchema, id: z.string().uuid() },
    async ({ table, id }) => {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      return { id, deleted: data?.length ?? 0 };
    },
    { write: true, idempotent: true },
  );
}

export function legislativeInputSchema(table: string, partial = false) {
  const config = legislativeResources[table];
  if (!config) throw new Error("Unknown resource");
  const shape: Record<string, z.ZodType> = {};
  for (const field of config.fields) {
    let schema: z.ZodType = field.reference
      ? z.string().uuid()
      : field.type === "integer"
        ? z.number().int()
        : z.string();
    if (field.choices) schema = z.enum(field.choices as [string, ...string[]]);
    if (!field.required) schema = schema.nullable().optional();
    else if (field.default) schema = schema.optional();
    shape[field.name] = schema;
  }
  const schema = z.strictObject(shape);
  return partial ? schema.partial() : schema;
}

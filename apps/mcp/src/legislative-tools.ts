import type { McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createToolkit } from "./toolkit";
import { legislativeResources } from "../../web/src/lib/legislation";

export function registerLegislativeTools(
  server: McpServer,
  supabase: SupabaseClient,
) {
  const { readRpc, register } = createToolkit(server, supabase);
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
    "Atomically import up to 100 normalized legislative records. Each item has table and data with source_system/source_id. Order parents before children; explicit UUIDs connect records. Repeating provider keys updates those records. Never import guessed votes or infer identity from names.",
    {
      records: z
        .array(
          z.object({
            table: z.enum(
              Object.keys(legislativeResources) as [string, ...string[]],
            ),
            data: z.record(z.string(), z.unknown()),
          }),
        )
        .max(100),
    },
    async ({ records }) => {
      const { data, error } = await supabase.rpc("import_legislation", {
        p_records: records,
      });
      if (error) throw new Error(error.message);
      return data;
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

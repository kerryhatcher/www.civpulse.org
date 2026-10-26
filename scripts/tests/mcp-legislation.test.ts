import { expect, test } from "bun:test";
import {
  registerLegislativeTools,
  legislativeInputSchema,
} from "../../apps/mcp/src/legislative-tools";

test("legislative tools forward filters and require admin for normalized imports", async () => {
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const schemas = new Map<string, any>();
  const calls: any[] = [];
  let admin = false;
  const client = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      return {
        data: name === "is_admin" ? admin : { rows: [], total: 0 },
        error: null,
      };
    },
  };
  registerLegislativeTools(
    {
      registerTool: (name: string, schema: unknown, handler: any) => {
        expect(handlers.has(name)).toBe(false);
        handlers.set(name, handler);
        schemas.set(name, schema);
      },
    } as never,
    client as never,
  );
  const id = "00000000-0000-4000-8000-000000000001";
  const input = schemas
    .get("browse_legislation")
    .inputSchema.parse({ table: "bills", id, bill_id: id, query: "HB 1" });
  await handlers.get("browse_legislation")!(input);
  expect(calls.at(-1)).toEqual({
    name: "browse_legislation",
    args: {
      p_table: "bills",
      p_id: id,
      p_filters: {},
      p_query: "HB 1",
      p_limit: 25,
      p_offset: 0,
      p_bill_id: id,
      p_person_id: null,
      p_vote_id: null,
    },
  });
  const result = await handlers.get("import_legislation")!({ records: [] });
  expect(result.isError).toBe(true);
  expect(calls.at(-1).name).toBe("is_admin");
  expect(() =>
    legislativeInputSchema("legislative_vote_choices").parse({
      vote_id: id,
      office_term_id: id,
      choice: "guessed",
      source_choice: "Unknown",
    }),
  ).toThrow();
  expect(schemas.get("import_legislation").annotations.idempotentHint).toBe(
    true,
  );
});

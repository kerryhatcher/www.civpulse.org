import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ok } from './toolkit';
import { relatedReads } from './related-read-catalog';

// Explicit public operations only: never accept arbitrary table or handler names.
export const saveResources = [
  'organization', 'calendar', 'event', 'person', 'election', 'map', 'layer',
  'contest', 'ballot_question', 'article', 'layer_feature', 'office', 'office_term',
] as const;
export const relationshipKinds = [
  'map_layer', 'contest_candidate', 'person_organization',
  'organization_relationship', 'article_person', 'article_organization',
] as const;

export function compactWriteReplacement(name: string, input: Record<string, unknown>) {
  const match = /^(create|update|delete)_(.+)$/.exec(name);
  if (!match) return undefined;
  const [, operation, resource] = match;
  if ((relationshipKinds as readonly string[]).includes(resource)) {
    return operation === 'delete'
      ? { name: 'delete_relationship', arguments: { request: { relationship: resource, ...input } } }
      : { name: 'save_relationship', arguments: { request: { relationship: resource, change: { operation, ...input } } } };
  }
  if (operation !== 'delete' && (saveResources as readonly string[]).includes(resource)) {
    return { name: `save_${resource}`, arguments: { request: { operation, ...input } } };
  }
  return undefined;
}

type Entry = {
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  run: (input: Record<string, unknown>) => Promise<ReturnType<typeof ok> & { isError?: boolean }>;
};

/** Collect only the allowlisted writes; their original guarded handlers do the work. */
export class WriteCatalog {
  private entries = new Map<string, Entry>();

  capture(name: string, entry: Entry): boolean {
    if (!compactWriteReplacement(name, {})) return false;
    if (this.entries.has(name)) throw new Error(`Duplicate compact write: ${name}`);
    this.entries.set(name, entry);
    return true;
  }

  register(server: McpServer) {
    const entry = (name: string) => {
      const found = this.entries.get(name);
      if (!found) throw new Error(`Missing compact write handler: ${name}`);
      return found;
    };
    const relationshipSchemas = <T extends z.ZodObject>(make: (kind: typeof relationshipKinds[number]) => T) => {
      const [first, ...rest] = relationshipKinds;
      return [make(first), ...rest.map(make)] as const;
    };
    const operationSchema = (resource: string) => z.discriminatedUnion('operation', [
      entry(`create_${resource}`).schema.extend({ operation: z.literal('create') }).strict(),
      entry(`update_${resource}`).schema.extend({ operation: z.literal('update') }).strict(),
    ]);
    const invoke = (resource: string, change: Record<string, unknown>) => {
      const { operation, ...input } = change;
      return entry(`${operation}_${resource}`).run(input);
    };
    const describe = (resource: string) =>
      `Create: ${entry(`create_${resource}`).description} Update: ${entry(`update_${resource}`).description}`
        .replace(/\bget_office_terms\b/g, `read_related_records (relation=${relatedReads.get_office_terms})`)
        .replace(/\b(?:create|update|delete)_[a-z_]+\b/g, name => compactWriteReplacement(name, {})?.name ?? name);
    const saveAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
    for (const resource of saveResources) {
      server.registerTool(`save_${resource}`, {
        description: `Use request.operation=create or update; updates preserve omissions and never upsert. Delete separately. ${describe(resource)}`,
        inputSchema: z.object({ request: operationSchema(resource) }).strict(),
        // A mixed create/update tool cannot claim that all calls are retry-safe.
        annotations: saveAnnotations,
      }, async ({ request }) => invoke(resource, request));
    }
    server.registerTool('save_relationship', {
      description: `Create or partially update one relationship (admin only). Select request.relationship and change.operation=create or update. Composite links require both endpoint IDs and update attributes only. Organization relationships use a row UUID for updates; endpoints, labels and source may be edited. Omitted fields are preserved; update never upserts. Delete separately. ${entry('create_organization_relationship').description}`,
      inputSchema: z.object({ request: z.discriminatedUnion('relationship', relationshipSchemas(resource =>
        z.object({ relationship: z.literal(resource), change: operationSchema(resource) }).strict(),
      )) }).strict(),
      annotations: saveAnnotations,
    }, async ({ request }) => invoke(request.relationship, request.change));
    server.registerTool('delete_relationship', {
      description: 'Delete only one relationship (admin only); preserve people, organizations, articles, contests, maps and layers. Select request.relationship. Composite links require both endpoint IDs; organization_relationship requires its row UUID and removes the link from both organization profiles. Use save_relationship for create/update.',
      inputSchema: z.object({ request: z.discriminatedUnion('relationship', relationshipSchemas(resource =>
        entry(`delete_${resource}`).schema.extend({ relationship: z.literal(resource) }).strict(),
      )) }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    }, async ({ request }) => {
      const { relationship, ...input } = request;
      return entry(`delete_${relationship}`).run(input);
    });
  }
}

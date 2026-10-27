import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ok } from './toolkit';

// An allowlist of existing reads, not arbitrary tables/RPCs or a generic join API.
export const relatedReads = {
  get_map_layers: 'map_layers',
  get_person_articles: 'person_articles',
  get_organization_articles: 'organization_articles',
  get_person_candidacies: 'person_candidacies',
  list_person_organizations: 'person_organizations',
  list_contests: 'election_contests',
  list_ballot_questions: 'election_ballot_questions',
  list_contest_candidates: 'contest_candidates',
  get_contest_candidate: 'contest_candidate',
  list_map_layer_links: 'map_layer_links',
  get_organization_relationships: 'organization_relationships',
  list_article_people: 'article_people',
  list_article_organizations: 'article_organizations',
  list_calendars: 'calendars',
  get_office_terms: 'office_terms',
} as const;

export function compactRelatedReadReplacement(name: string, input: Record<string, unknown>) {
  if (!Object.hasOwn(relatedReads, name)) return undefined;
  return { name: 'read_related_records', arguments: { request: { ...input, relation: relatedReads[name as keyof typeof relatedReads] } } };
}

type Entry = {
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  run: (input: Record<string, unknown>) => Promise<ReturnType<typeof ok> & { isError?: boolean }>;
};

/** The original guarded readers retain all authorization and output shaping. */
export class RelatedReadCatalog {
  private entries = new Map<string, Entry>();

  capture(name: string, entry: Entry): boolean {
    if (!Object.hasOwn(relatedReads, name)) return false;
    if (this.entries.has(name)) throw new Error(`Duplicate related reader: ${name}`);
    this.entries.set(name, entry);
    return true;
  }

  register(server: McpServer) {
    const variants = Object.entries(relatedReads).map(([name, relation]) => {
      const entry = this.entries.get(name);
      if (!entry) throw new Error(`Missing related reader: ${name}`);
      return entry.schema.extend({ relation: z.literal(relation) }).strict().describe(entry.description);
    });
    const [first, ...rest] = variants;
    if (!first) throw new Error('Related reader catalog cannot be empty');
    server.registerTool('read_related_records', {
      description: 'Read related civic records using request.relation and its original UUID keys. Responses retain their original arrays or status envelopes, ordering and fields. map_layers returns visible styled layers; map_layer_links, article_people and article_organizations are admin-only editable links. Other reads use existing person/election/contest/organization visibility gates. contest_candidate requires contest_id and person_id; office_terms requires person_id or organization_id (both allowed). calendars accepts an optional organization_id. No arbitrary joins, account records, geometry, implicit pagination or broadened discovery.',
      inputSchema: z.object({ request: z.discriminatedUnion('relation', [first, ...rest]) }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ request }) => {
      const { relation, ...input } = request;
      const name = Object.entries(relatedReads).find(([, value]) => value === relation)![0];
      return this.entries.get(name)!.run(input);
    });
  }
}

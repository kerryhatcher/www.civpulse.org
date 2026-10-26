import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createToolkit } from './toolkit';

const uuid = z.string().uuid();
const key = z.string().min(1).max(500);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const provenance = z.object({ source_url: z.string().url().startsWith('https://'), document_sha256: sha,
  locator: z.string().min(1).max(2000) }).strict();
const observation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attendance'), source_key: key, provenance,
    data: z.object({ person_id: uuid, status: z.enum(['present','absent','excused','observed','unknown']), evidence: z.string().min(1).max(2000) }).strict() }).strict(),
  z.object({ kind: z.literal('vote'), source_key: key, provenance,
    data: z.object({ subject: z.string().min(1).max(300), description: z.string().max(100000).optional(),
      outcome: z.enum(['passed','failed','tabled','withdrawn']).nullable().optional(), position: z.number().int().optional(),
      agenda_context: z.string().max(10000).optional() }).strict() }).strict(),
  z.object({ kind: z.literal('choice'), source_key: key, provenance,
    data: z.object({ person_id: uuid, vote_source_key: key, choice: z.enum(['yes','no','abstain','recused','unknown']),
      original_text: z.string().min(1).max(2000) }).strict() }).strict(),
]);

export function registerMeetingImportTools(server: McpServer, supabase: SupabaseClient) {
  const { register, readRpc } = createToolkit(server, supabase);
  register('import_meeting_records', 'Validate or atomically import up to 100 sourced attendance, motion rounds and individual choices (2 MiB, admin only). Default dry_run=true. Resolve existing meeting/person UUIDs; order attendance then votes then choices. Each provider/source_key is immutable: exact replay returns canonical IDs unchanged; changed snapshots or editorial drift reject the entire batch. Omission never deletes. Use observed for presence supported only at a ballot, unknown for roster-only evidence, and choice unknown for Vote Not Recorded. Never infer ballots or outcomes from totals, unanimity or sponsorship. Preserve agenda context separately from actual motion text. See get_meeting for reconciliation.',
    { meeting_id: uuid, provider: z.string().min(1).max(100), records: z.array(observation).min(1).max(100), dry_run: z.boolean().default(true) },
    async ({ meeting_id, provider, records, dry_run }) => {
      if (new TextEncoder().encode(JSON.stringify(records)).length > 2 * 1024 * 1024) throw new Error('Maximum import size: 2 MiB');
      const { data, error } = await supabase.rpc('import_meeting_records', { p_meeting_id: meeting_id, p_provider: provider, p_records: records, p_dry_run: dry_run });
      if (error) throw new Error(error.message);
      return data;
    }, { write: true, destructive: false, idempotent: true });
  readRpc('get_person_meeting_votes', 'Read paginated meeting ballots with original source evidence, optional organization and inclusive date filters. Public meetings only for non-admins, including ordinary signed-in users; private/unlisted meetings require admin discovery access. Unknown means no supported recorded choice. Public slug profiles show imports after rebuild; signed-in/UUID profiles read live.',
    { person_id: uuid, organization_id: uuid.optional(), from: z.string().date().optional(), to: z.string().date().optional(),
      offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(50).default(21) },
    'get_person_meeting_votes', ({ person_id, organization_id, from, to, offset, limit }) => ({ p_person_id: person_id,
      p_organization_id: organization_id, p_from: from, p_to: to, p_offset: offset, p_limit: limit }));
}

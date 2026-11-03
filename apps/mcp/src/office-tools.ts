import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createToolkit } from './toolkit';
import type { WriteCatalog } from './write-catalog';
import type { RelatedReadCatalog } from './related-read-catalog';

/** Offices and actual service are independent of election candidacies. */
export function registerOfficeTools(server: McpServer, supabase: SupabaseClient, writes?: WriteCatalog, reads?: RelatedReadCatalog) {
  const { register, create, update } = createToolkit(server, supabase, writes, reads);

  register('list_offices', 'Find existing public offices before creating a seat. Filter by organization or exact office UUID; paginate with offset.', {
    organization_id: z.string().uuid().optional(),
    id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }, async ({ organization_id, id, limit, offset }) => {
    let query = supabase.from('offices').select('*').order('name').order('id');
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (id) query = query.eq('id', id);
    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return data;
  });

  register('get_office_terms', 'Get dated actual service through the person/organization visibility gate. Provide person_id or organization_id. Election victories do not automatically create service records.', {
    person_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
  }, async ({ person_id, organization_id }) => {
    if (!person_id && !organization_id) throw new Error('Provide person_id or organization_id');
    const { data, error } = await supabase.rpc('get_office_terms', {
      p_person_id: person_id ?? null, p_organization_id: organization_id ?? null,
    });
    if (error) throw new Error(error.message);
    return data;
  });

  if(writes){
    register('read_officeholder_observations','Read bounded dated roster observations for an existing person or organization. Snapshots do not establish term boundaries or current officeholders. Optional exact day/year context and supersession history; same public-only visibility for ordinary signed-in users.',{
      person_id:z.string().uuid().optional(),organization_id:z.string().uuid().optional(),as_of:z.string().date().optional(),history:z.boolean().default(false),offset:z.number().int().min(0).max(2147483647).default(0),limit:z.number().int().min(1).max(100).default(50)
    },async input=>{const {data,error}=await supabase.rpc('read_officeholder_observations',{p_person_id:input.person_id??null,p_organization_id:input.organization_id??null,p_as_of:input.as_of??null,p_history:input.history,p_offset:input.offset,p_limit:input.limit});if(error)throw Error(error.message);return data;});
    register('accept_officeholder_observations','Admin version-1 dated roster evidence acceptance, default dry run; up to 100 immutable rows / 1 MiB atomically. Preserve reported labels; exact reviewed UUID reconciliation, day/year/unknown precision and source URL/SHA/retrieval/locator required. No fuzzy matching or people/term creation. Changed stable identities require latest supersedes_id and correction_reason; no overwrite. See docs/backend.md for row contract.',{
      version:z.literal(1),provider:z.string().min(1).max(100),rows:z.array(z.record(z.string(),z.unknown())).min(1).max(100),dry_run:z.boolean().default(true)
    },async input=>{const {data,error}=await supabase.rpc('accept_officeholder_observations',{p_version:input.version,p_provider:input.provider,p_rows:input.rows,p_dry_run:input.dry_run});if(error)throw Error(error.message);return data;},{write:true,destructive:false,idempotent:true});
  }

  const office = {
    organization_id: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    district: z.string().max(160).optional(),
    seat: z.string().max(160).optional(),
    description: z.string().max(4000).nullish(),
  };
  create('office', 'offices', 'Create a durable office or seat (admin only). Resolve an existing organization and list_offices first to avoid duplicates.', office);
  update('office', 'offices', 'Partially update an office (admin only). Omitted fields are preserved.', office);

  const term = {
    office_id: z.string().uuid(),
    person_id: z.string().uuid(),
    selection_method: z.enum(['elected', 'appointed']),
    starts_on: z.iso.date(),
    ends_on: z.iso.date().nullish().describe('Inclusive last day of actual service; null means ongoing. Do not forecast a departure.'),
    starts_on_precision: z.enum(['day', 'year']).optional().describe('For year precision, store January 1 solely as a sorting bound.'),
    ends_on_precision: z.enum(['day', 'year']).optional().describe('For a concluded year-only term, store December 31 solely as a sorting bound.'),
    source_url: z.string().url().max(2000).regex(/^https?:\/\/[^\s]+$/i).nullish(),
  };
  create('office_term', 'office_terms', 'Record one period of actual office service (admin only). Read get_office_terms first. Separate reelected terms when boundaries are documented; use election/contest/candidacy tools for election dates. Database validates date order, precision bounds and duplicate starts.', term);
  update('office_term', 'office_terms', 'Partially correct a service record (admin only). Omitted fields are preserved; null ends_on records ongoing service. Database validates date order and precision bounds. Preserve historical service and its source.', term);
}

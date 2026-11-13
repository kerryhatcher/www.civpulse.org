import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ok, fail } from './toolkit';

const operation = z.discriminatedUnion('action', [
  z.object({ action: z.literal('browse'), dataset: z.enum(['payroll','payments']).default('payments'),
    year: z.number().int().min(2015).max(2100).nullable().default(null), person_id: z.string().uuid().nullable().default(null),
    query: z.string().max(200).default(''), offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(100).default(50), sort: z.enum(['amount','name']).default('amount'), }).strict(),
  z.object({ action: z.enum(['begin','append','publish','withdraw','review_person','resolve_recipient','resolve_payroll_person']), payload: z.record(z.string(),z.unknown()) }).strict(),
]);
export function registerSchoolFinanceTools(server: McpServer, supabase: SupabaseClient) {
  server.registerTool('school_finances', {
    description: 'Bibb school payroll/payment records. operation.action=browse reads published releases with dataset/year/query/person filters, sort and pagination; source rows are not headcounts or invoices. Never add overlapping payroll and payment totals. All other actions require admin: begin registers the schema-v1 manifest; append accepts 1–500 immutable rows / 1 MiB with exact decimal strings and source row numbers; publish requires confirm_publication=true and expected_current_id (null initially), complete count and exact totals. It atomically replaces the current release. During staging, resolve_payroll_person links a supported existing person using release_id, row_number, person_id, confirm_identity=true and a sourced review_note. Preserve ambiguity: unresolved payroll rows receive separate public person stubs flagged for review; names alone do not prove identity. review_person requires release_id, row_number, person_id, confirm_identity=true and sourced review_note; never merges people. Payment publication reuses a unique exact person/organization name match, otherwise creates a provisional organization stub marked for review. resolve_recipient takes recipient_id, kind (person/organization), optional target_id (omit to create a stub) and a sourced review_note; aggregate SALARY/SALARIES/BENEFITS rows have no payee profile. withdraw hides the release and its generated profiles without reviving history. Retain original files in collector evidence. See docs/school-finances.md for precise contracts.',
    inputSchema: z.object({operation}).strict(),
    annotations: {readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false},
  }, async ({operation:input}) => {
    try {
      if (input.action === 'browse') {
        const {data,error}=await supabase.rpc('browse_school_finances',{p_dataset:input.dataset,p_year:input.year,p_query:input.query,p_offset:input.offset,p_limit:input.limit,p_sort:input.sort,p_person_id:input.person_id});
        if(error)throw new Error(error.message);return ok(data);
      }
      const {data:admin,error:adminError}=await supabase.rpc('is_admin');
      if(adminError)throw new Error(adminError.message);if(!admin)throw new Error('Admin access required');
      const {data,error}=await supabase.rpc('manage_school_finances',{p_action:input.action,p_payload:input.payload});
      if(error)throw new Error(error.message);return ok(data);
    } catch(error) {return fail(error);}
  });
}

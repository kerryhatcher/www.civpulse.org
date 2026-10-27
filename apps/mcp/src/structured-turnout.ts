import { z } from 'zod';

export const turnoutMeasureNames = {
 early: ['accepted'],
 absentee: ['requested','issued','returned','accepted','rejected','spoiled_canceled','outstanding','acceptance_ratio'],
 turnout: ['turnout'],
} as const;
const cell = z.object({value:z.number().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),display:z.string().max(200)}).strict();
export const structuredTurnout = z.object({
 schema_version:z.literal(1), provider:z.literal('georgia-sos-turnout'),
 election_id:z.string().uuid(), election_date:z.string().date(),status:z.literal('unofficial'),
 source_url:z.literal('https://sos.ga.gov/page/election-data-hub-unofficial-turnout'),
 app_id:z.literal('137c0a43-928b-427a-a267-eb55aa7fa8a9'),
 capture_run_id:z.string().uuid(), captured_at:z.string().datetime({offset:true}),
 upstream_sha256:z.string().regex(/^[a-f0-9]{64}$/),
 tables:z.array(z.object({
  table:z.enum(['early','absentee','turnout']),object_id:z.enum(['7cc869cd-2124-43be-82f4-1c8d394dc6d8','CTgPMg','QDFdpV']),
  source_title:z.string().min(1).max(300),as_of_label:z.string().max(200),
  as_of:z.string().datetime({offset:true}).nullable(),as_of_timezone:z.literal('America/New_York'),
  rows:z.array(z.object({county_fips:z.string().regex(/^13\d{3}$/),county_label:z.string().min(1).max(100),
   ballot_style:z.string().min(1).max(100),counting_group:z.enum(['advance','absentee_mail']),
   locator:z.string().min(1).max(500), measures:z.record(z.string(),cell),
  }).strict()).max(1000),
 }).strict()).length(3),
}).strict();

/** Conversion is deliberately separate from publication; no network or credentials. */
export function parseStructuredTurnout(document:string) {
 if(new TextEncoder().encode(document).length>2*1024*1024) throw new Error('JSON evidence exceeds 2 MiB');
 const data=structuredTurnout.parse(JSON.parse(document));
 const seen=new Set<string>();
 for(const table of data.tables){
  if(seen.has(table.table))throw new Error('Duplicate table');seen.add(table.table);
  if(table.object_id!==({early:'7cc869cd-2124-43be-82f4-1c8d394dc6d8',absentee:'CTgPMg',turnout:'QDFdpV'}[table.table]))throw new Error('Object identity mismatch');
  for(const row of table.rows){
   const names=turnoutMeasureNames[table.table];
   if(Object.keys(row.measures).sort().join()!==[...names].sort().join())throw new Error('Measure schema changed');
   for(const [key,cell] of Object.entries(row.measures))if(cell.value!==null && (key==='acceptance_ratio'?cell.value>1:!Number.isSafeInteger(cell.value)))throw new Error('Invalid count or ratio');
  }
 }
 return data;
}

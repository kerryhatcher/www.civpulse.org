import { parseArgs } from 'node:util';
import { basename } from 'node:path';
import { prepareSchoolRows } from './lib/school-finances';
const { values } = parseArgs({ args: Bun.argv.slice(2), options: {
  file: { type: 'string' }, dataset: { type: 'string' }, year: { type: 'string' },
  'source-url': { type: 'string' }, 'retrieved-at': { type: 'string' },
  'organization-id': { type: 'string' }, output: { type: 'string' },
} });
if (!values.file || !values.output || !values.year || !values['retrieved-at'] || !values['source-url'] || !['payroll','payments'].includes(values.dataset ?? '')) {
  throw new Error('Required: --file CSV/TXT --dataset payroll|payments --year YYYY --source-url HTTPS --retrieved-at ISO --output bundle.json; optional --organization-id UUID');
}
const sourceUrl = new URL(values['source-url']);
if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'open.ga.gov' || sourceUrl.username || sourceUrl.password) throw new Error('Use an official Open Georgia HTTPS source URL');
if (!Number.isFinite(Date.parse(values['retrieved-at']))) throw new Error('Invalid retrieval date');
const bytes = new Uint8Array(await Bun.file(values.file).arrayBuffer());
const { rows, source_row_numbers, ...expected } = prepareSchoolRows(bytes, values.dataset as 'payroll' | 'payments', Number(values.year));
const manifest = { dataset: values.dataset, fiscal_year: Number(values.year), organization_id: values['organization-id'] ?? null,
  source_url: sourceUrl.href, source_filename: basename(values.file), source_sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
  source_filters: { organization: 'BIBB COUNTY BOARD OF EDUCATION', organization_id: '6111', fiscal_year: Number(values.year), organization_type: 'Local Boards of Education' },
  retrieved_at: new Date(values['retrieved-at']).toISOString(), parser_version: 'civpulse-school-finances-v1', ...expected };
await Bun.write(values.output, JSON.stringify({ schema_version: 1, manifest, source_row_numbers, rows }, null, 2) + '\n');
console.log(JSON.stringify({ output: values.output, ...expected }));

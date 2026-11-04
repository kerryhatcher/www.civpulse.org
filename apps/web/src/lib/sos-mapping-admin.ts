import type { ElectionDetail } from './elections';
import type { SosContestMapping } from './sos-ballot';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 200;
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
export function parseMappingBatch(input: string): SosContestMapping[] {
  if (new TextEncoder().encode(input).length > 2097152) throw Error('Mapping JSON exceeds 2 MiB.');
  const rows: unknown = JSON.parse(input);
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw Error('Provide 1–1,000 mappings.');
  const sources = new Set<string>(), targets = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const fail = () => { throw Error(`Invalid or duplicate mapping at row ${index + 1}.`); };
    if (!object(row) || !keys(row, ['jurisdiction_id','source_contest_id','contest_id','question_id','choices']) || !text(row.jurisdiction_id) || !text(row.source_contest_id)) { fail(); continue; }
    const contest = row.contest_id != null, question = row.question_id != null;
    if (contest === question || !uuid.test(String(contest ? row.contest_id : row.question_id)) || !Array.isArray(row.choices) || !row.choices.length || row.choices.length > 200) { fail(); continue; }
    const source = JSON.stringify([row.jurisdiction_id,row.source_contest_id]);
    const target = JSON.stringify([row.jurisdiction_id,contest ? 'contest' : 'question',contest ? row.contest_id : row.question_id]);
    if (sources.has(source) || targets.has(target)) fail();
    sources.add(source); targets.add(target);
    const from = new Set<string>(), to = new Set<string>();
    for (const choice of row.choices) {
      if (!object(choice) || !keys(choice, ['source_choice_id','person_id','choice_label']) || !text(choice.source_choice_id) || (contest ? !uuid.test(String(choice.person_id)) || choice.choice_label != null : !text(choice.choice_label) || choice.person_id != null)) { fail(); continue; }
      const destination = String(contest ? choice.person_id : choice.choice_label);
      if (from.has(choice.source_choice_id) || to.has(destination)) fail();
      from.add(choice.source_choice_id); to.add(destination);
    }
  }
  return rows as SosContestMapping[];
}

export type MappingSource = { name: string; items: Array<{ data: Record<string, any> }> };
/** Resolve identities only: an administrator must review real-world equivalence. */
export function describeMappingBatch(rows: SosContestMapping[], ballot: ElectionDetail, sources: Map<string, MappingSource>): string {
  return rows.map((row, index) => {
    const scope = sources.get(row.jurisdiction_id);
    const source = scope?.items.find(i => i.data.id === row.source_contest_id)?.data;
    const target = row.contest_id ? ballot.contests.find(c => c.id === row.contest_id) : ballot.ballot_questions.find(q => q.id === row.question_id);
    if (!scope || !source || !target) throw Error(`Row ${index + 1}: source or ballot target is unavailable in this election.`);
    const title = 'office' in target ? [target.office,target.district,target.seat].filter(Boolean).join(' · ') : target.title;
    const lines = row.choices.map(choice => {
      const option = Array.isArray(source.ballotOptions) && source.ballotOptions.find((o: any) => o.id === choice.source_choice_id);
      if (!option) throw Error(`Row ${index + 1}: source choice is unavailable.`);
      const person = 'candidates' in target ? target.candidates.find(c => c.person.id === choice.person_id)?.person : undefined;
      if ('candidates' in target ? !person : !target.choices.includes(choice.choice_label!)) throw Error(`Row ${index + 1}: choice is not in the existing ballot target.`);
      return `  ${option.name} [${choice.source_choice_id}] → ${person?.full_name ?? choice.choice_label}${person ? ` [${person.id}]` : ''}`;
    });
    return `${index + 1}. ${scope.name} [${row.jurisdiction_id}]\n${source.name} [${row.source_contest_id}] → ${title} [${target.id}]${'question_text' in target ? `\nBallot wording: ${target.question_text}` : ''}\n${lines.join('\n')}`;
  }).join('\n\n');
}

/** The RPC orders choices independently from submitted JSON. */
export function sameMapping(a: SosContestMapping, b: SosContestMapping): boolean {
  const normalize = (row: SosContestMapping) => JSON.stringify({ jurisdiction_id: row.jurisdiction_id, source_contest_id: row.source_contest_id, contest_id: row.contest_id ?? null, question_id: row.question_id ?? null, choices: row.choices.map(c => ({ source_choice_id:c.source_choice_id, person_id:c.person_id ?? null, choice_label:c.choice_label ?? null })).sort((x,y) => x.source_choice_id.localeCompare(y.source_choice_id)) });
  return normalize(a) === normalize(b);
}

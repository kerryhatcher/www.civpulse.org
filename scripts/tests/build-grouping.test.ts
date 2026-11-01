import { expect, test } from 'bun:test';
import { assembleDirectoryData } from '../../apps/web/src/lib/directory-build-data';
import { attachProfileLegislation, loadProfileSectionBuildData } from '../../apps/web/src/lib/profile-section-build-data';
import { emptyProfileSections, type PublicProfileSections } from '../../apps/web/src/lib/profile-sections';
import type { LegislativeRow } from '../../apps/web/src/lib/legislation';
import type { SupabaseClient } from '@supabase/supabase-js';

test('directory grouping preserves source text order, empty groups and input rows', () => {
  type Records = Parameters<typeof assembleDirectoryData>[0];
  type Related = Parameters<typeof assembleDirectoryData>[1];
  const records = {
    people: [{ id: 'a', slug: 'a', full_name: 'First', visibility: 'public' }, { id: 'b', slug: 'b', full_name: 'Second', visibility: 'public' }],
    organizations: [{ id: 'org', slug: 'org', name: 'Org' }, { id: 'empty', slug: 'empty', name: 'Empty' }],
    elections: [{ id: 'election', name: 'Election', slug: 'election', kind: 'general', election_date: '2026-11-03', visibility: 'public', organization_id: 'org' }, { id: 'empty', name: 'Empty election', slug: 'empty', kind: 'general', election_date: '2026-11-03', visibility: 'public' }],
  } as Records;
  const related = {
    affiliations: [{ organization_id: 'org', person_id: 'b', role: 'Second role' }, { organization_id: 'org', person_id: 'a', role: 'First role' }],
    contests: [{ id: 'z', election_id: 'election', office: 'Second office' }, { id: 'a', election_id: 'election', office: 'First office' }],
    candidates: [{ contest_id: 'a', person_id: 'b', party: null, status: 'running', is_write_in: false }, { contest_id: 'z', person_id: 'a', party: 'Green', status: 'won', is_write_in: true }],
    questions: [{ election_id: 'election', title: 'Question', question_text: 'Question text', description: '', jurisdiction: null, choices: ['Yes', 'No'] }],
  } as Related;
  const before = JSON.stringify({ records, related });
  const result = assembleDirectoryData(records, related);
  expect(result.organizations[0].search).toBe('Org org Second Second role First First role');
  expect(result.organizations[1].search).toBe('Empty empty');
  expect(result.elections[0].search).toBe('Election election general 2026-11-03 Org Second office First office Second running ballot candidate First Green won write-in certified write in Question Question text  Yes No');
  expect(result.elections[1].search).toBe('Empty election empty general 2026-11-03');
  expect(JSON.stringify({ records, related })).toBe(before);
  expect(assembleDirectoryData({ people: [], organizations: [], elections: [] }, { affiliations: [], contests: [], candidates: [], questions: [] })).toEqual({ people: [], organizations: [], elections: [] });
});

test('sponsorship matching retains global row order across reversed/repeated/multiple office terms', () => {
  const profile = (...ids: string[]) => ({ ...emptyProfileSections(), officeTerms: ids.map(id => ({ id })) }) as PublicProfileSections;
  const people = new Map([
    ['multiple', profile('term-c', 'term-a', 'term-c')],
    ['empty', profile()], ['unmatched', profile('missing')],
    ['vote-only', { ...profile(), legislativeVotes: [{ id: 'vote' }] }],
    ['single', profile('term-b')],
  ]);
  const sponsorships = [
    { id: 'z', office_term_id: 'term-a' }, { id: 'a', office_term_id: 'term-b' },
    { id: 'm', office_term_id: 'term-c' }, { id: 'b', office_term_id: 'term-a' },
    { id: 'c', office_term_id: 'term-c' }, { id: 'unknown', office_term_id: 'missing-other' },
    { id: 'null-term', office_term_id: null }, { id: 'no-term' },
  ] as LegislativeRow[];
  const resources = { legislative_terms: [{ id: 'legislative-term' }], bill_sponsorships: sponsorships };
  const expected = new Map([...people].map(([id, person]) => [id,
    person.officeTerms.length || person.legislativeVotes.length
      ? { ...resources, bill_sponsorships: sponsorships.filter(row => person.officeTerms.some(term => term.id === row.office_term_id)) }
      : {},
  ]));
  const before = JSON.stringify(resources);
  attachProfileLegislation(people, resources);
  for (const [id, person] of people) expect(person.legislation).toEqual(expected.get(id)!);
  expect(people.get('multiple')!.legislation.bill_sponsorships.map(row => row.id)).toEqual(['z', 'm', 'b', 'c']);
  expect(people.get('multiple')!.legislation.legislative_terms).toBe(resources.legislative_terms);
  expect(JSON.stringify(resources)).toBe(before);
  const empty = new Map([['person', profile('term-a')]]);
  attachProfileLegislation(empty, { bill_sponsorships: [] });
  expect(empty.get('person')!.legislation.bill_sponsorships).toEqual([]);
  expect(() => attachProfileLegislation(new Map(), { bill_sponsorships: [] })).not.toThrow();
});

test('profile export assembly attaches indexed sponsorships after the shared public reads', async () => {
  const id = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const term = (number:number) => ({ id:id(number), organization_id:'org', starts_on:'2020-01-01', office_name:'Council', person_name:'Example' });
  const sponsors = [{ id:id(3), office_term_id:id(2), visibility:'public' }, { id:id(4), office_term_id:id(1), visibility:'public' }, { id:id(5), office_term_id:id(2), visibility:'public' }];
  const client = { rpc: async (name:string,args:Record<string,unknown>) => {
    if(name==='export_public_profile_rows') return { data:args.p_section==='offices' ? [{ owner_id:'person', position:0, data:term(1) }, { owner_id:'person', position:1, data:term(2) }] : [],error:null };
    expect(name).toBe('export_public_legislation_page');
    expect(Object.keys(args).sort()).toEqual(['p_limit','p_offset','p_table']);
    const rows=args.p_table==='bill_sponsorships'?sponsors:[];
    return { data:{total:rows.length,rows},error:null };
  } } as unknown as SupabaseClient;
  const result=await loadProfileSectionBuildData(client);
  expect(result.people.get('person')!.legislation.bill_sponsorships).toEqual(sponsors);
  expect(result.organizations.get('org')!.officeTerms.map(row=>row.id)).toEqual([id(1),id(2)]);
});

test('profile resource JSON and content hashes ignore out-of-order public export completion', async () => {
  const tables = ['legislative_terms', 'legislative_sessions', 'legislative_bodies', 'bill_sponsorships'];
  const outputs: string[] = [];
  const completions: string[][] = [];
  for (const slow of ['legislative_terms', 'legislative_sessions']) {
    const completed: string[] = [];
    const client = { rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'export_public_profile_rows') return {
        data: args.p_section === 'legislative_votes' ? [{ owner_id: 'person', position: 0, data: { id: 'vote' } }] : [], error: null,
      };
      const table = String(args.p_table);
      if (table === slow) await Bun.sleep(20);
      completed.push(table);
      const rows = [{ id: `00000000-0000-4000-8000-${String(tables.indexOf(table)).padStart(12, '0')}`, visibility: 'public' }];
      return { data: { total: rows.length, rows }, error: null };
    } } as unknown as SupabaseClient;
    const profile = (await loadProfileSectionBuildData(client)).people.get('person')!;
    expect(Object.keys(profile.legislation)).toEqual(tables);
    outputs.push(JSON.stringify(profile));
    completions.push(completed);
  }
  expect(completions[0]).not.toEqual(completions[1]);
  expect(outputs[0]).toBe(outputs[1]);
  expect(Bun.hash(outputs[0])).toBe(Bun.hash(outputs[1]));
});

const baseline = process.env.BUILD_GROUPING_BASELINE_DIR;
test.skipIf(!baseline)('directory/profile snapshot paths, hashes and public HTML match the pre-change output', async () => {
  let files = 0;
  for (const directory of ['directory-data', 'profile-data', 'people', 'orgs', 'elections']) {
    const expected = [...new Bun.Glob('**/*').scanSync({ cwd: `${baseline}/${directory}`, onlyFiles: true })].sort();
    const actual = [...new Bun.Glob('**/*').scanSync({ cwd: `apps/web/dist/${directory}`, onlyFiles: true })].sort();
    expect(actual, directory).toEqual(expected);
    for (const file of expected) {
      expect(await Bun.file(`apps/web/dist/${directory}/${file}`).text(), `${directory}/${file}`).toBe(await Bun.file(`${baseline}/${directory}/${file}`).text());
      files++;
    }
  }
  expect(files).toBeGreaterThan(100);
});

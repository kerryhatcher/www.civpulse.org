import {readPublicProfileBuildPage} from './build-read';
import { readPublicLegislationTable } from './legislation-build-data';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBuildSupabase } from './supabase-build';
import { emptyProfileSections, type PublicProfileSections } from './profile-sections';
import type { LegislativeRow } from './legislation';

/** Index the already-public export once; restore its global row order after
 * joining each profile's distinct office terms. Do not reorder shared resources. */
export function attachProfileLegislation(people:Map<string,PublicProfileSections>,resources:Record<string,LegislativeRow[]>) {
  const sponsorships=resources.bill_sponsorships;
  const byTerm=new Map<string,number[]>();
  for(let position=0;position<sponsorships.length;position++) {
    const term=sponsorships[position].office_term_id;
    if(typeof term!=='string')continue;
    const group=byTerm.get(term);
    if(group)group.push(position);else byTerm.set(term,[position]);
  }
  for(const profile of people.values()) {
    if(!profile.legislativeVotes.length&&!profile.officeTerms.length)continue;
    const matches:number[]=[];
    for(const term of new Set(profile.officeTerms.map(term=>term.id))) {
      for(const position of byTerm.get(term)??[])matches.push(position);
    }
    matches.sort((a,b)=>a-b);
    profile.legislation={...resources,bill_sponsorships:matches.map(position=>sponsorships[position])};
  }
}

export async function loadProfileSectionBuildData(client: SupabaseClient) {
  const people = new Map<string,PublicProfileSections>(), organizations = new Map<string,PublicProfileSections>();
  const get = (map: typeof people,id: string) => { if (!map.has(id)) map.set(id,emptyProfileSections()); return map.get(id)!; };
  const resourceTables = ['legislative_terms','legislative_sessions','legislative_bodies','bill_sponsorships'];
  const resourceRows: LegislativeRow[][] = [];
  const tasks = ['offices','person_articles','organization_articles','candidacies','votes','legislative_votes'].map(section => async () => {
    const started = performance.now();
    let exported = 0;
    for (let offset=0;;offset+=500) {
      const { data,error } = await readPublicProfileBuildPage(client,section,offset);
      if (error) throw new Error(`Public profile export failed (${section}, offset ${offset}): ${error.message}`);
      const rows = data as {owner_id:string;position:number;data:unknown}[];
      if (!Array.isArray(rows)) throw new Error(`Invalid public profile export (${section})`);
      exported += rows.length;
      for (const row of rows) {
        const target = get(section==='organization_articles' ? organizations : people,row.owner_id);
        if (section==='offices') {
          target.officeTerms.push(row.data as PublicProfileSections['officeTerms'][number]);
          const term = row.data as PublicProfileSections['officeTerms'][number];
          get(organizations,term.organization_id).officeTerms.push(term);
        } else if (section.endsWith('articles')) target.articles.push(row.data as PublicProfileSections['articles'][number]);
        else if (section==='candidacies') target.candidacies.push(row.data as PublicProfileSections['candidacies'][number]);
        else if (section==='votes') target.votes.push(row.data as PublicProfileSections['votes'][number]);
        else target.legislativeVotes.push(row.data as LegislativeRow);
      }
      if (rows.length<500) break;
    }
    console.info(`Public profile build: ${section} (${exported} rows, ${Math.round(performance.now() - started)}ms)`);
  });
  resourceTables.forEach((table,index) => tasks.push(async () => {
    resourceRows[index] = await readPublicLegislationTable(client, table);
  }));
  // Bounded workers prevent per-profile HTTP fan-out during imports/builds.
  let next=0;
  await Promise.all(Array.from({length:3},async()=>{while(next<tasks.length) await tasks[next++]();}));
  // JSON key order contributes to profile content hashes; never use RPC completion order.
  const resources = Object.fromEntries(resourceTables.map((table,index) => [table,resourceRows[index]]));
  attachProfileLegislation(people,resources);
  for (const profile of organizations.values()) profile.officeTerms.sort((a,b)=>b.starts_on.localeCompare(a.starts_on)||a.office_name.localeCompare(b.office_name)||a.person_name.localeCompare(b.person_name)||a.id.localeCompare(b.id));
  return {people,organizations};
}
let snapshot: ReturnType<typeof loadProfileSectionBuildData> | undefined;
let refreshAfter=0;
export function getProfileSectionBuildData() {
  const client=getBuildSupabase();
  if (!client) return Promise.resolve({people:new Map<string,PublicProfileSections>(),organizations:new Map<string,PublicProfileSections>()});
  if (import.meta.env.DEV && Date.now()>=refreshAfter) { snapshot=undefined; refreshAfter=Date.now()+30_000; }
  return snapshot??=loadProfileSectionBuildData(client);
}

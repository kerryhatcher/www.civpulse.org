import { getSupabase } from './supabase';
import { currentCandidacies, currentOfficeTerms, type PublicProfileSections } from './profile-sections';
let snapshot: Promise<PublicProfileSections|null> | undefined;
/** UUID viewers and signed-in profiles always retain their live access checks. */
export function getPublicProfileSnapshot(): Promise<PublicProfileSections|null> {
  const url=document.querySelector<HTMLElement>('[data-profile-snapshot]')?.dataset.profileSnapshot;
  if (!url) return Promise.resolve(null);
  return snapshot??=loadPublicProfileSnapshot(url);
}
export async function loadPublicProfileSnapshot(url:string|undefined,client=getSupabase()):Promise<PublicProfileSections|null> {
    if(!url) return null;
    const {data:{session}}=await client.auth.getSession();
    if (session) return null;
    const response=await fetch(url);
    if (!response.ok) throw new Error(`Could not load published profile: HTTP ${response.status}`);
    const data=await response.json() as PublicProfileSections;
    return {...data,officeTerms:currentOfficeTerms(data.officeTerms),candidacies:currentCandidacies(data.candidacies)};
}

const files=new Map<string,Promise<unknown>>();
async function readFile(url:string) {
  if(!files.has(url)) files.set(url,(async()=>{
    const response=await fetch(url);
    if(!response.ok) throw new Error(`Could not load published voting records: HTTP ${response.status}`);
    return response.json();
  })().catch(error=>{files.delete(url);throw error;}));
  return files.get(url)!;
}
export async function readProfileVoteGroups(profile:PublicProfileSections,args:Record<string,unknown>) {
  const offset=Number(args.p_offset??0),limit=Number(args.p_limit??20);
  const filtered=['p_term_id','p_session_id','p_body_id','p_category','p_bill_query'].some(key=>args[key]);
  if(!filtered && profile.legislativeInitial && limit===20) {
    if(offset===0) return profile.legislativeInitial;
    const url=profile.legislativePages?.[offset];
    if(!url) return {total:profile.legislativeInitial.total,rows:[]};
    return await readFile(url) as {total:number;rows:import('./legislation').LegislativeRow[]};
  }
  const {groupProfileVotes}=await import('./profile-sections');
  const votes=profile.legislativeVotesUrl ? await readFile(profile.legislativeVotesUrl) as import('./legislation').LegislativeRow[] : profile.legislativeVotes;
  return groupProfileVotes({...profile,legislativeVotes:votes},args);
}

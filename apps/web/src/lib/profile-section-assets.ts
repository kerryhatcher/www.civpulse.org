import { getProfileSectionBuildData } from './profile-section-build-data';
import { fetchPublicPeople } from './people';
import { fetchOrganizations } from './organizations';
import { emptyProfileSections, groupProfileVotes } from './profile-sections';

export async function loadProfileSectionAssets() {
  const [sections,people,organizations]=await Promise.all([getProfileSectionBuildData(),fetchPublicPeople(),fetchOrganizations()]);
  const assets = new Map<string,{path:string;body:string}>();
  async function add(key:string,value:unknown) {
    const body=JSON.stringify(value);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const asset={path:`${key}-${hash}.json`,body};
    assets.set(key,asset);
    return `/profile-data/${asset.path}`;
  }
  for (const [kind,records,profiles] of [['people',people,sections.people],['organizations',organizations,sections.organizations]] as const) {
    for (const record of records) {
      const profile={...(profiles.get(record.id)??emptyProfileSections())};
      if (profile.legislativeVotes.length) {
        const groups=groupProfileVotes(profile,{p_limit:Number.MAX_SAFE_INTEGER});
        profile.legislativeInitial={total:groups.total,rows:groups.rows.slice(0,20)};
        profile.legislativePages={};
        for(let offset=20;offset<groups.total;offset+=20) profile.legislativePages[offset]=await add(`vote-pages/${record.id}/${offset}`,{total:groups.total,rows:groups.rows.slice(offset,offset+20)});
        profile.legislativeVotesUrl=await add(`vote-filters/${record.id}`,profile.legislativeVotes);
        profile.legislativeVotes=[];
      }
      await add(`${kind}/${record.id}`,profile);
    }
  }
  return assets;
}
let assets: ReturnType<typeof loadProfileSectionAssets> | undefined;
let refreshAfter=0;
export function getProfileSectionAssets() {
  if (import.meta.env.DEV && Date.now()>=refreshAfter) {assets=undefined;refreshAfter=Date.now()+30_000;}
  return assets??=loadProfileSectionAssets();
}
export async function profileSectionUrl(kind:'people'|'organizations',id:string) {
  const asset=(await getProfileSectionAssets()).get(`${kind}/${id}`);
  if (!asset) throw new Error(`Missing public profile snapshot: ${kind}/${id}`);
  return `/profile-data/${asset.path}`;
}

import { getProfileSectionBuildData } from './profile-section-build-data';
import { fetchPublicPeople } from './people';
import { fetchOrganizations } from './organizations';
import { emptyProfileSections, groupProfileVotes, type PublicProfileSections } from './profile-sections';
import type { LegislativeRow } from './legislation';

export interface ProfileAsset { path:string; body:string }
const referenceTables=['legislative_terms','legislative_sessions','legislative_bodies'] as const;
const assetUrl=(path:string)=>`/profile-data/${path}`;

/** Owners remain distinct while identical public bodies share one physical file. */
export async function buildProfileSectionAssets(
  sections:{people:Map<string,PublicProfileSections>;organizations:Map<string,PublicProfileSections>},
  people:readonly {id:string}[],organizations:readonly {id:string}[],
) {
  const owners=new Map<string,ProfileAsset>(),files=new Map<string,ProfileAsset>();
  const serialized=new WeakMap<object,string>(),byBody=new Map<string,ProfileAsset>();
  const serialize=(value:object)=>{
    let body=serialized.get(value);
    if(body===undefined){body=JSON.stringify(value);serialized.set(value,body);}
    return body;
  };
  async function add(value:object) {
    const body=serialize(value),existing=byBody.get(body);
    if(existing)return existing;
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    const asset={path:`assets/${hash}.json`,body};
    byBody.set(body,asset);files.set(asset.path,asset);return asset;
  }
  const empty=emptyProfileSections();
  const profiles=[...people.map(record=>({key:`people/${record.id}`,profile:sections.people.get(record.id)??empty})),
    ...organizations.map(record=>({key:`organizations/${record.id}`,profile:sections.organizations.get(record.id)??empty}))];
  // Price reference extraction against the actual primary bodies, after vote
  // paging/filter assets have been separated and identical owners can deduplicate.
  for(const entry of profiles){
    if(!entry.profile.legislativeVotes.length)continue;
    const profile={...entry.profile};
    const groups=groupProfileVotes(profile,{p_limit:Number.MAX_SAFE_INTEGER});
    profile.legislativeInitial={total:groups.total,rows:groups.rows.slice(0,20)};
    profile.legislativePages={};
    for(let offset=20;offset<groups.total;offset+=20)profile.legislativePages[offset]=assetUrl((await add({total:groups.total,rows:groups.rows.slice(offset,offset+20)})).path);
    profile.legislativeVotesUrl=assetUrl((await add(profile.legislativeVotes)).path);
    profile.legislativeVotes=[];
    entry.profile=profile;
  }
  // Shared reference arrays already have stable export order. Identity grouping
  // avoids serializing those large arrays again for every owner.
  const identities=new WeakMap<object,number>();let nextIdentity=0;
  const identity=(value:object)=>{let id=identities.get(value);if(id===undefined){id=nextIdentity++;identities.set(value,id);}return id;};
  type References={value:Record<string,LegislativeRow[]>;profiles:Set<PublicProfileSections>;url?:string};
  const referenceGroups=new Map<string,References>(),referencesByProfile=new Map<PublicProfileSections,References>();
  for(const {profile} of profiles){
    const rows=referenceTables.map(table=>profile.legislation[table]);
    if(!rows.every(Array.isArray)||!rows.some(rows=>rows.length))continue;
    const key=rows.map(identity).join(',');
    let group=referenceGroups.get(key);
    if(!group){group={value:Object.fromEntries(referenceTables.map((table,index)=>[table,rows[index]])),profiles:new Set()};referenceGroups.set(key,group);}
    group.profiles.add(profile);referencesByProfile.set(profile,group);
  }
  const bytes=(body:string)=>new TextEncoder().encode(body).length;
  const stripped=(profile:PublicProfileSections)=>({...profile,
    legislation:Object.fromEntries(Object.entries(profile.legislation).filter(([table])=>!referenceTables.includes(table as typeof referenceTables[number])))});
  const extracted=(profile:PublicProfileSections,url:string)=>({...stripped(profile),legislativeResourcesUrl:url});
  const placeholderUrl=assetUrl(`assets/${'0'.repeat(64)}.json`);
  for(const group of referenceGroups.values()){
    const unique=new Map<string,PublicProfileSections>();
    for(const profile of group.profiles){const value=stripped(profile);unique.set(serialize(value),value);}
    const referenceBytes=bytes(serialize(group.value));
    let inlineBytes=0,separatedBytes=0;
    for(const [body,profile] of unique){
      // Insert the shared object's fields into legislation, counting its comma
      // only when other fields remain. Avoid serializing the large arrays per owner.
      inlineBytes+=bytes(body)+referenceBytes-2+(serialize(profile.legislation)==='{}'?0:1);
      separatedBytes+=bytes(serialize({...profile,legislativeResourcesUrl:placeholderUrl}));
    }
    // Count emitted bodies, not owners; the fixed-length hash URL has the same
    // UTF-8 size as its placeholder. Require actual deduplicated savings >1 KiB.
    if(inlineBytes-separatedBytes-referenceBytes>1024)group.url=assetUrl((await add(group.value)).path);
  }
  for(const {key,profile:source} of profiles){
    const references=referencesByProfile.get(source);
    const profile=references?.url?extracted(source,references.url):source;
    owners.set(key,await add(profile));
  }
  return {owners,files};
}

export async function loadProfileSectionAssets() {
  const [sections,people,organizations]=await Promise.all([getProfileSectionBuildData(),fetchPublicPeople(),fetchOrganizations()]);
  return buildProfileSectionAssets(sections,people,organizations);
}
let assets: ReturnType<typeof loadProfileSectionAssets> | undefined;
let refreshAfter=0;
export function getProfileSectionAssets() {
  if (import.meta.env.DEV && Date.now()>=refreshAfter) {assets=undefined;refreshAfter=Date.now()+30_000;}
  return assets??=loadProfileSectionAssets();
}
export async function profileSectionUrl(kind:'people'|'organizations',id:string) {
  const asset=(await getProfileSectionAssets()).owners.get(`${kind}/${id}`);
  if (!asset) throw new Error(`Missing public profile snapshot: ${kind}/${id}`);
  return assetUrl(asset.path);
}

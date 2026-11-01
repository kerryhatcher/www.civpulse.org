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
  // Shared reference arrays already have stable export order. Identity grouping
  // avoids serializing those large arrays again for every owner.
  const identities=new WeakMap<object,number>();let nextIdentity=0;
  const identity=(value:object)=>{let id=identities.get(value);if(id===undefined){id=nextIdentity++;identities.set(value,id);}return id;};
  type References={value:Record<string,LegislativeRow[]>;count:number;url?:string};
  const referenceGroups=new Map<string,References>(),referencesByProfile=new Map<PublicProfileSections,References>();
  for(const {profile} of profiles){
    const rows=referenceTables.map(table=>profile.legislation[table]);
    if(!rows.every(Array.isArray)||!rows.some(rows=>rows.length))continue;
    const key=rows.map(identity).join(',');
    let group=referenceGroups.get(key);
    if(!group){group={value:Object.fromEntries(referenceTables.map((table,index)=>[table,rows[index]])),count:0};referenceGroups.set(key,group);}
    group.count++;referencesByProfile.set(profile,group);
  }
  const bytes=(body:string)=>new TextEncoder().encode(body).length;
  const pointerBytes=bytes(JSON.stringify({legislativeResourcesUrl:assetUrl(`assets/${'0'.repeat(64)}.json`)}));
  for(const group of referenceGroups.values()){
    const size=bytes(serialize(group.value));
    // Conservatively account for the pointer and shared file. Avoid an extra
    // request/file unless repeated references save over 1 KiB of JSON overall.
    if(group.count>1&&group.count*(size-pointerBytes-1)-size>1024)group.url=assetUrl((await add(group.value)).path);
  }
  for(const {key,profile:source} of profiles){
    const references=referencesByProfile.get(source);
    const profile=source.legislativeVotes.length||references?.url?{...source}:source;
    if(references?.url){
      profile.legislation=Object.fromEntries(Object.entries(source.legislation).filter(([table])=>!referenceTables.includes(table as typeof referenceTables[number])));
      profile.legislativeResourcesUrl=references.url;
    }
    if(profile.legislativeVotes.length){
      const groups=groupProfileVotes(profile,{p_limit:Number.MAX_SAFE_INTEGER});
      profile.legislativeInitial={total:groups.total,rows:groups.rows.slice(0,20)};
      profile.legislativePages={};
      for(let offset=20;offset<groups.total;offset+=20)profile.legislativePages[offset]=assetUrl((await add({total:groups.total,rows:groups.rows.slice(offset,offset+20)})).path);
      profile.legislativeVotesUrl=assetUrl((await add(profile.legislativeVotes)).path);
      profile.legislativeVotes=[];
    }
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

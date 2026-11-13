import { getBuildSupabase } from './supabase-build';
import { fetchPublicPeople } from './people';
import { fetchOrganizations } from './organizations';
import { fetchPublicElections } from './elections';
import { loadDirectoryBuildData } from './directory-build-data';
import type { DirectoryKind } from './directories';

async function loadAssets() {
  const client = getBuildSupabase();
  const [people,organizations,elections] = await Promise.all([fetchPublicPeople(),fetchOrganizations(),fetchPublicElections()]);
  const data = client ? await loadDirectoryBuildData(client,{people,organizations,elections}) : {people:[],organizations:[],elections:[]};
  return Promise.all((Object.keys(data) as DirectoryKind[]).map(async kind => {
    const body = JSON.stringify(data[kind]);
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
    const hash = Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,'0')).join('');
    return {kind,path:`${kind}-${hash}.json`,body};
  }));
}
let assets: ReturnType<typeof loadAssets> | undefined;
let refreshAfter = 0;
export function getDirectoryAssets() {
  if (import.meta.env.DEV && Date.now() >= refreshAfter) { assets=undefined; refreshAfter=Date.now()+30_000; }
  return assets ??= loadAssets();
}
export async function directoryUrl(kind: DirectoryKind) {
  const asset = (await getDirectoryAssets()).find(asset => asset.kind === kind)!;
  return `/directory-data/${asset.path}`;
}

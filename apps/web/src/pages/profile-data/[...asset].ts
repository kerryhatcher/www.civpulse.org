import type { APIRoute } from 'astro';
import { getProfileSectionAssets } from '../../lib/profile-section-assets';
export async function getStaticPaths() {
  return [...(await getProfileSectionAssets()).values()].map(asset=>({params:{asset:asset.path},props:{body:asset.body}}));
}
export const GET:APIRoute=({props})=>new Response(props.body,{headers:{'Content-Type':'application/json; charset=utf-8'}});

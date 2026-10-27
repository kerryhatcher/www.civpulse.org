import type { APIRoute } from 'astro';
import { getDirectoryAssets } from '../../lib/directory-assets';
import { getLegislationDirectoryAssets } from '../../lib/legislation-directory-assets';
export async function getStaticPaths() {
  const [directories,legislation] = await Promise.all([getDirectoryAssets(),getLegislationDirectoryAssets()]);
  return [...directories,...legislation.assets].map(asset => ({params:{asset:asset.path},props:{body:asset.body}}));
}
export const GET: APIRoute = ({props}) => new Response(props.body,{headers:{'Content-Type':'application/json; charset=utf-8'}});

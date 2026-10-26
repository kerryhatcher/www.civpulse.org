import type { APIRoute } from 'astro';
import { getDirectoryAssets } from '../../lib/directory-assets';
export async function getStaticPaths() {
  return (await getDirectoryAssets()).map(asset => ({params:{asset:asset.path},props:{body:asset.body}}));
}
export const GET: APIRoute = ({props}) => new Response(props.body,{headers:{'Content-Type':'application/json; charset=utf-8'}});

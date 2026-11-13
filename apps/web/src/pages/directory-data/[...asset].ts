import type { APIRoute } from 'astro';
import { getDirectoryAssets } from '../../lib/directory-assets';
import { getLegislationDirectoryAssets } from '../../lib/legislation-directory-assets';
import {getLegislationDetailAssets} from '../../lib/legislation-detail-assets';
import {getRequestAssets} from '../../lib/request-assets';
export async function getStaticPaths() {
  const [directories,legislation,details,requests] = await Promise.all([getDirectoryAssets(),getLegislationDirectoryAssets(),getLegislationDetailAssets(),getRequestAssets()]);
  return [...directories,...legislation.assets,...details.assets,...requests.assets].map(asset => ({params:{asset:asset.path},props:{body:asset.body}}));
}
export const GET: APIRoute = ({props}) => new Response(props.body,{headers:{'Content-Type':'application/json; charset=utf-8'}});

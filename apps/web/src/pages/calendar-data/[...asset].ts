import type { APIRoute } from 'astro';
import { getCalendarAssets } from '../../lib/calendar-assets';
export async function getStaticPaths() {
  return [...new Map([...(await getCalendarAssets()).values()].map(asset=>[asset.path,asset])).values()].map(asset=>({params:{asset:asset.path},props:{body:asset.body}}));
}
export const GET:APIRoute=({props})=>new Response(props.body,{headers:{'Content-Type':'application/json; charset=utf-8'}});

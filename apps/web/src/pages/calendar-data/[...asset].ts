import type { APIRoute } from 'astro';
import { getCalendarAssets } from '../../lib/calendar-assets';
export async function getStaticPaths() {
  return [...(await getCalendarAssets()).values()].map(asset=>({params:{asset:asset.path},props:{body:asset.body}}));
}
export const GET:APIRoute=({props})=>new Response(props.body,{headers:{'Content-Type':'application/json; charset=utf-8'}});

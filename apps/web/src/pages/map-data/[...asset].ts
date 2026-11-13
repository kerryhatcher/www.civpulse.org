import type { APIRoute } from 'astro';
import { getMapBuildData } from '../../lib/map-build-data';

export async function getStaticPaths() {
  return (await getMapBuildData()).assets.map(asset => ({ params: { asset: asset.path }, props: { body: asset.body } }));
}

export const GET: APIRoute = ({ props }) => new Response(props.body, {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

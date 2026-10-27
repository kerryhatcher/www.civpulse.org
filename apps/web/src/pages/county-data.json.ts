import type { APIRoute } from 'astro';
import { getCountyIndex } from '../lib/county-build-data';

export const GET: APIRoute = async () => new Response(JSON.stringify(await getCountyIndex()), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

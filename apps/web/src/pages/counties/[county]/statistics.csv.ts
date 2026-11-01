import type { APIRoute } from 'astro';
import {GEORGIA_COUNTY_HUBS} from '../../../lib/county-scope';
import {getCountyStatisticDownloadRecords,countyStatisticsCsv} from '../../../lib/county-statistics';
export function getStaticPaths(){return GEORGIA_COUNTY_HUBS.filter(c=>c.fips!=='13021').map(c=>({params:{county:c.slug},props:{fips:c.fips}}));}
export const GET:APIRoute=async({props})=>new Response(countyStatisticsCsv(await getCountyStatisticDownloadRecords(props.fips)),{headers:{'Content-Type':'text/csv; charset=utf-8'}});

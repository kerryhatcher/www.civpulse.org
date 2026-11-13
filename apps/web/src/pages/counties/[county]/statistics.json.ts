import type {APIRoute} from 'astro';
import {GEORGIA_COUNTY_HUBS} from '../../../lib/county-scope';
import {getCountyStatisticDownloadRecords} from '../../../lib/county-statistics';
export function getStaticPaths(){return GEORGIA_COUNTY_HUBS.map(c=>({params:{county:c.slug},props:{fips:c.fips}}));}
export const GET:APIRoute=async({props})=>new Response(JSON.stringify({records:await getCountyStatisticDownloadRecords(props.fips)}),{headers:{'Content-Type':'application/json'}});

import type {APIRoute} from 'astro';
import {getCountyStatisticRecords,countyStatisticsCsv} from '../../lib/county-statistics';
export const GET:APIRoute=async()=>new Response(countyStatisticsCsv(await getCountyStatisticRecords()),{headers:{'Content-Type':'text/csv; charset=utf-8'}});

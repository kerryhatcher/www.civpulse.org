import type { APIRoute } from 'astro';
import {getCountyStatisticDownloadRecords,countyStatisticsCsv} from '../../../lib/county-statistics';
export const GET:APIRoute=async()=>new Response(countyStatisticsCsv(await getCountyStatisticDownloadRecords('13021')),{headers:{'Content-Type':'text/csv; charset=utf-8'}});

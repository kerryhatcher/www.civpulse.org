import type { APIRoute } from 'astro';
import {getCountyStatisticRecords,countyStatisticsCsv} from '../../../lib/county-statistics';
export const GET:APIRoute=async()=>new Response(countyStatisticsCsv((await getCountyStatisticRecords()).filter(r=>r.county_fips==='13021'||r.county_fips==='13000')),{headers:{'Content-Type':'text/csv; charset=utf-8'}});

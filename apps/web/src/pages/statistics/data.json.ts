import type {APIRoute} from 'astro';
import {getCountyStatisticRecords} from '../../lib/county-statistics';
export const GET:APIRoute=async()=>new Response(JSON.stringify({records:await getCountyStatisticRecords()}),{headers:{'Content-Type':'application/json'}});

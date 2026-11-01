import type {McpServer} from '@modelcontextprotocol/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {createToolkit} from './toolkit';

export async function getCountyStatisticCatalog(supabase:SupabaseClient){
  const tables=['county_geographies','county_statistic_topics','county_statistic_indicators','county_statistic_sources'];
  const reads=await Promise.all(tables.map(table=>supabase.from(table).select('*')));
  for(const r of reads)if(r.error)throw Error(r.error.message);
  return Object.fromEntries(tables.map((t,i)=>[t,reads[i].data]));
}

/** Public official-source aggregates; both MCP catalogs expose these tools. */
export function registerCountyStatisticTools(server:McpServer,supabase:SupabaseClient){
 const {register}=createToolkit(server,supabase);
 register('get_county_statistic_catalog','Discover structured Georgia county civic and demographic statistics. Returns all counties/FIPS/slugs, topics, indicators (units, definitions, headline positions), and official source datasets with URLs, retrieval dates and SHA-256 checksums. Start here before search_county_statistics; 13000 is the Georgia state comparison. Current profile has 59 measures per geography. More official sources/measures can be added by admins.',{},async()=>{
  return getCountyStatisticCatalog(supabase);
 });
 register('search_county_statistics','Search official-source county civic/demographic data by county name/FIPS, measure, topic, publisher, reference period or query text. Filter with county_fips, indicator_code or topic. Returns numeric values, units, availability, Georgia/county identity, periods, source URLs/checksums, numerator/denominator, ACS margins and SAIPE confidence intervals. Empty query browses; paginate until total_count is covered. Values are source-specific estimates, not personalized data. For Georgia comparisons query county_fips=13000 using the same indicator. Static downloads: /counties/<slug>/statistics.csv and statistics.json; live REST: county_statistic_records.',{
  query:z.string().max(500).default(''),county_fips:z.string().regex(/^13\d{3}$/).nullish(),indicator_code:z.string().max(80).nullish(),topic:z.string().max(80).nullish(),limit:z.number().int().min(1).max(500).default(100),offset:z.number().int().min(0).default(0),
 },async({query,county_fips,indicator_code,topic,limit,offset})=>{
  const {data,error}=await supabase.rpc('search_county_statistics',{p_query:query,p_county_fips:county_fips??null,p_indicator_code:indicator_code??null,p_topic:topic??null,p_limit:limit,p_offset:offset});if(error)throw Error(error.message);return data;
 });
 register('save_county_statistic','Create or update a structured official-source county statistic (admin only). Resolve county, indicator and source from get_county_statistic_catalog first. Supply exact existing updated_at to update; null creates only and never overwrites. Preserve period, provenance, uncertainty and calculation inputs. Explicit unavailable/suppressed status requires null value; do not substitute zero or guess missing data. Updates mark the static website for rebuild; REST/MCP reads change immediately.',{
  county_fips:z.string().regex(/^13\d{3}$/),indicator_code:z.string().min(1).max(80),expected_updated_at:z.string().datetime({offset:true}).nullable(),
  value:z.number().finite().nullable(),status:z.enum(['available','suppressed','unavailable']),period:z.string().trim().min(1).max(200),source_id:z.string().min(1).max(100),source_variables:z.string().min(1).max(2000),
  numerator:z.number().finite().nullish(),denominator:z.number().finite().positive().nullish(),margin_of_error:z.number().finite().nonnegative().nullish(),lower_bound:z.number().finite().nullish(),upper_bound:z.number().finite().nullish(),confidence_level:z.number().gt(0).lt(100).nullish(),detail:z.string().max(4000).default(''),components:z.record(z.string(),z.unknown()).default({}),
 },async({expected_updated_at,...values})=>{
  const row={...values,numerator:values.numerator??null,denominator:values.denominator??null,margin_of_error:values.margin_of_error??null,lower_bound:values.lower_bound??null,upper_bound:values.upper_bound??null,confidence_level:values.confidence_level??null};
  const query=expected_updated_at===null?supabase.from('county_statistics').insert(row):supabase.from('county_statistics').update(row).eq('county_fips',values.county_fips).eq('indicator_code',values.indicator_code).eq('updated_at',expected_updated_at);
  const {data,error}=await query.select('*').maybeSingle();if(error)throw Error(error.message);if(!data)throw Error('Statistic changed or no longer exists. Read it again before saving.');return data;
 },{write:true,idempotent:false});
 register('save_county_statistic_source','Create/update an official-source dataset catalog entry (admin only). Verify the original official source and exact file SHA-256 before saving. This metadata is returned by public API/MCP and static exports. Existing statistic rows retain their values; refresh them separately. Changes trigger a website rebuild.',{
  id:z.string().min(1).max(100),publisher:z.string().min(1).max(200),title:z.string().min(1).max(300),source_url:z.string().url().regex(/^https:\/\/[^\s]+$/),retrieved_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),sha256:z.string().regex(/^[0-9a-f]{64}$/),
 },async input=>{const {data,error}=await supabase.from('county_statistic_sources').upsert(input).select('*').single();if(error)throw Error(error.message);return data;},{write:true,idempotent:true});
}

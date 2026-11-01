import { getBuildSupabase } from './supabase-build';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GEORGIA_COUNTY_HUBS } from './county-scope';
import { organizationCountyCoverage, mapCountyCoverage } from '../data/county-coverage';

export interface StatisticRecord {
  county_fips: string; indicator_code: string; value: number|null; status: 'available'|'suppressed'|'unavailable';
  label: string; unit: string; period: string; source_id: string; source_url: string; source_title: string;
  publisher: string; retrieved_on: string; sha256: string; source_variables: string;
  numerator: number|null; denominator: number|null; margin_of_error: number|null;
  lower_bound: number|null; upper_bound: number|null; confidence_level: number|null;
  detail: string; components: Record<string,unknown>; definition: string;
  topic_id: string; topic_title: string; topic_note: string; topic_position: number;
  indicator_position: number; headline_position: number|null; county_name: string; county_slug: string;
}
export interface CountyStatistic {
  label: string; value: string; georgia: string; period: string; code: string;
  source: string; stateSource: string; detail?: string; stateDetail?: string;
  record: StatisticRecord; stateRecord: StatisticRecord;
}
export function formatStatistic(row: Pick<StatisticRecord,'value'|'status'|'unit'>): string {
  if(row.status!=='available'||row.value===null)return row.status==='suppressed'?'Suppressed by Census':'Not available';
  const value=Number(row.value);
  if(row.unit==='percent')return `${value.toFixed(1)}%`;
  if(row.unit==='usd')return `$${value.toLocaleString('en-US',{maximumFractionDigits:0})}`;
  if(row.unit==='minutes')return `${value.toFixed(1)} min`;
  if(row.unit==='square_miles')return `${value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} sq mi`;
  if(row.unit==='ratio')return value.toFixed(2);
  if(row.unit==='density')return value.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
  return value.toLocaleString('en-US',{maximumFractionDigits:0});
}
function detail(row:StatisticRecord):string|undefined {
  if(row.lower_bound!==null&&row.upper_bound!==null)return `${row.confidence_level}% interval: ${Number(row.lower_bound).toFixed(1)}–${Number(row.upper_bound).toFixed(1)}${row.unit==='percent'?'%':''}`;
  return row.detail||undefined;
}
interface CountyStatisticSnapshot {
 records: StatisticRecord[];
 byFips: Map<string, StatisticRecord[]>;
 georgiaByCode: Map<string, StatisticRecord>;
 downloadsByFips: Map<string, StatisticRecord[]>;
 povertyScaleMax: number;
 ageScaleMax: number;
}
const snapshots=new WeakMap<SupabaseClient,{promise:Promise<CountyStatisticSnapshot>;expires:number}>();
async function load(client:SupabaseClient):Promise<CountyStatisticSnapshot>{
 const records:StatisticRecord[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await client.from('county_statistic_records').select('*').order('county_fips').order('topic_position').order('indicator_position').order('indicator_code').range(offset,offset+499);
  if(error)throw Error(`Could not build county statistics: ${error.message}`);
  records.push(...data as StatisticRecord[]);if(data.length<500)break;
 }
 const byFips=new Map<string,StatisticRecord[]>();
 let povertyMax=0,ageMax=0;
 for(const row of records){
  const group=byFips.get(row.county_fips);
  if(group)group.push(row);else byFips.set(row.county_fips,[row]);
  if(row.status==='available'){
   if(row.topic_id==='poverty')povertyMax=Math.max(povertyMax,Number(row.upper_bound??row.value));
   if(row.topic_id==='age')ageMax=Math.max(ageMax,Number(row.value));
  }
 }
 // Fail closed: incomplete imports must not silently publish empty county profiles.
 for(const fips of ['13000',...GEORGIA_COUNTY_HUBS.map(c=>c.fips)]){
  const county=byFips.get(fips)??[];
  if(county.length!==59||new Set(county.map(r=>r.indicator_code)).size!==59)throw Error(`County ${fips} needs all 59 statistics before publication.`);
  if(county.filter(r=>r.headline_position!==null).length!==6)throw Error(`County ${fips} needs six headline statistics.`);
 }
 const georgia=byFips.get('13000')!;
 const georgiaByCode=new Map(georgia.map(row=>[row.indicator_code,row]));
 const downloadsByFips=new Map<string,StatisticRecord[]>();
 for(const county of GEORGIA_COUNTY_HUBS){
  const local=byFips.get(county.fips)!;
  for(const row of local){
   const state=georgiaByCode.get(row.indicator_code);
   if(!state)throw Error(`Missing Georgia comparison ${row.indicator_code}`);
   if(state.period!==row.period||state.source_id.replace(/-(co|st)$/,'')!==row.source_id.replace(/-(co|st)$/,''))throw Error(`Mismatched comparison period/source ${row.indicator_code}`);
  }
  // The public reader orders by FIPS, so Georgia (13000) precedes each county.
  downloadsByFips.set(county.fips,[...georgia,...local]);
 }
 return {records,byFips,georgiaByCode,downloadsByFips,
  povertyScaleMax:Math.max(50,Math.ceil(povertyMax/20)*20),
  ageScaleMax:Math.max(10,Math.ceil(ageMax/5)*5)};
}
/** A client shares one validated snapshot and all derived indexes. Development
 * expires the entire object together after 30 seconds, including pending reads. */
export function readCountyStatisticSnapshot(client:SupabaseClient):Promise<CountyStatisticSnapshot>{
 const cached=snapshots.get(client);
 if(cached&&!(import.meta.env.DEV&&Date.now()>=cached.expires))return cached.promise;
 const promise=load(client);snapshots.set(client,{promise,expires:Date.now()+30_000});return promise;
}
function getSnapshot():Promise<CountyStatisticSnapshot>{
 const client=getBuildSupabase();if(!client)throw Error('County statistics require a configured public database.');
 return readCountyStatisticSnapshot(client);
}
export async function getCountyStatisticRecords():Promise<StatisticRecord[]>{
 return (await getSnapshot()).records;
}
export async function getCountyStatisticDownloadRecords(fips:string):Promise<StatisticRecord[]>{
 const records=(await getSnapshot()).downloadsByFips.get(fips);
 if(!records)throw Error(`Unknown Georgia county ${fips}`);
 return records;
}
export async function getCountyProfile(fips:string){
 const metadata=GEORGIA_COUNTY_HUBS.find(c=>c.fips===fips);if(!metadata)throw Error(`Unknown Georgia county ${fips}`);
 const snapshot=await getSnapshot(),local=snapshot.byFips.get(fips)!;
 const statistics:CountyStatistic[]=local.map(row=>{const georgia=snapshot.georgiaByCode.get(row.indicator_code)!;return {label:row.label,value:formatStatistic(row),georgia:formatStatistic(georgia),period:row.period,code:row.indicator_code,source:row.source_url,stateSource:georgia.source_url,detail:detail(row),stateDetail:detail(georgia),record:row,stateRecord:georgia};});
 const groups=[...new Set(local.map(r=>r.topic_id))].map(id=>{const first=local.find(r=>r.topic_id===id)!;return {id,title:first.topic_title,note:first.topic_note,statistics:statistics.filter(s=>s.record.topic_id===id)};});
 const byCode=new Map(statistics.map(s=>[s.code,s]));
 const comparison=(code:string,label:string,note:string)=>{const s=byCode.get(code)!;return {label,note,county:s.record.value,state:s.stateRecord.value};};
 return {name:`${metadata.name} County`,shortName:metadata.name,state:'Georgia',fips,slug:metadata.slug,
  organizationSlugs:fips==='13021'?['bibb-county-board-of-elections','macon-water-authority-district-1']:Object.keys(organizationCountyCoverage).filter(slug=>organizationCountyCoverage[slug].includes(fips)),
  mapSlugs:fips==='13021'?['commissioners','voting','school-board','transit','libraries','recreation']:Object.keys(mapCountyCoverage).filter(slug=>mapCountyCoverage[slug].includes(fips)),
  census:{source:`https://www.census.gov/quickfacts/${metadata.slug.replaceAll('-','')}countygeorgia`,stateSource:'https://www.census.gov/quickfacts/GA',
   ageSource:byCode.get('AGE04_TOT')!.source,povertySource:byCode.get('SAIPE-2024-ALL')!.source,
   checked:local.map(r=>r.retrieved_on).sort().at(-1)!,groups,statistics,
   povertyScaleMax:snapshot.povertyScaleMax,
   ageScaleMax:snapshot.ageScaleMax,
   overviewCodes:statistics.filter(s=>s.record.headline_position!==null).sort((a,b)=>a.record.headline_position!-b.record.headline_position!).map(s=>s.code),
   comparisons:[comparison('HSG445224','Homeownership','Occupied housing units'),comparison('EDU685224','Bachelor’s degree or higher','Adults age 25+'),comparison('INT250224','Broadband subscription','Households')],
  }};
}
export type CountyProfile=Awaited<ReturnType<typeof getCountyProfile>>;
export function statisticSource(stat:CountyStatistic,state=false):string{return state?stat.stateSource:stat.source;}
export function countyStatisticsCsv(records:StatisticRecord[]):string{
 const keys=['county_fips','county_name','indicator_code','label','topic_id','value','unit','status','period','numerator','denominator','margin_of_error','lower_bound','upper_bound','confidence_level','detail','source_variables','publisher','source_title','source_url','retrieved_on','sha256','definition','components'] as const;
 const cell=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
 return [keys.join(','),...records.map(row=>keys.map(key=>cell(key==='components'?JSON.stringify(row[key]):row[key])).join(','))].join('\r\n')+'\r\n';
}

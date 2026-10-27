/** bun run scripts/prepare-georgia-turnout.ts input.json output.json */
import counties from './data/georgia-counties.json';
import {parseStructuredTurnout} from '../apps/mcp/src/structured-turnout';
const [input,output]=Bun.argv.slice(2);
if(!input||!output)throw new Error('Usage: bun run scripts/prepare-georgia-turnout.ts input.json output.json');
const bundle=await Bun.file(input).json();
const mappings={
 'early-voting-by-county':{table:'early',measures:{'Ballots Accepted':'accepted'}},
 'absentee-by-county':{table:'absentee',measures:{'Ballots Requested':'requested','Ballots Issued':'issued','Ballots Returned':'returned','Ballots Accepted':'accepted','% Accepted of Returned':'acceptance_ratio','Ballots Rejected':'rejected','Other (Spoiled & Canceled)':'spoiled_canceled','Ballots Outstanding':'outstanding'}},
 'turnout-by-county-and-ballot-style':{table:'turnout',measures:{Turnout:'turnout'}},
} as const;
if(bundle.schema_version!==1||!Array.isArray(bundle.tables)||bundle.tables.length!==3)throw new Error('Unsupported bundle');
const document={schema_version:1,provider:'georgia-sos-turnout',election_id:bundle.election_id,election_date:bundle.election_date,
 status:'unofficial',source_url:bundle.source_url,app_id:'137c0a43-928b-427a-a267-eb55aa7fa8a9',
 capture_run_id:bundle.capture_run_id,captured_at:bundle.captured_at,upstream_sha256:bundle.snapshot_sha256,
 tables:bundle.tables.map((record:any)=>{
  if(record.schema_version!==1||record.source_id!=='georgia-sos-turnout'||record.election_date!==bundle.election_date||record.source_url!==bundle.source_url||record.unofficial!==true)throw new Error('Source identity mismatch');
  const d=record.data;const mapping=mappings[d.table as keyof typeof mappings];if(!mapping)throw new Error('Unknown source table');
  if([...d.measures].sort().join()!==Object.keys(mapping.measures).sort().join()||d.dimensions.join()!==(mapping.table==='turnout'?'County,Ballot Style':'County'))throw new Error('Source schema changed');
  const label=d.source_as_of;let asOf:string|null=null;
  if(label){
   const match=/^\*Data as of : (\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(label);
   if(!match)throw new Error('Unknown as-of label');
   const [,m,day,y,h,min,s,ampm]=match;const hour=Number(h)%12+(ampm==='PM'?12:0);
   // Resolve the local wall clock through Intl, never assume the capture's offset.
   const wall=`${y}-${m.padStart(2,'0')}-${day.padStart(2,'0')}T${String(hour).padStart(2,'0')}:${min}:${s}`;
   const candidates=['-04:00','-05:00'].map(offset=>wall+offset).filter(value=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`===wall;
   });if(candidates.length!==1)throw new Error('Ambiguous or invalid source time');asOf=candidates[0];
  }
  return {table:mapping.table,object_id:d.object_id,source_title:d.source_title,as_of_label:label,as_of:asOf,as_of_timezone:'America/New_York',rows:d.rows.map((row:any,index:number)=>{
   const county=counties.find(c=>c.name.toUpperCase()===row.dimensions.County.toUpperCase());if(!county)throw new Error('Unresolved county');
   const style=row.dimensions['Ballot Style']??(mapping.table==='early'?'Early In-Person':'Absentee');
   if(!['Early In-Person','Absentee'].includes(style))throw new Error('Unknown ballot style');
   if(Object.keys(row.measures).sort().join()!==Object.keys(mapping.measures).sort().join())throw new Error('Row measure schema changed');
   return {county_fips:county.fips,county_label:row.dimensions.County,ballot_style:style,counting_group:style==='Early In-Person'?'advance':'absentee_mail',
    locator:`${d.object_id}: normalized row ${index+1}; County=${row.dimensions.County}${mapping.table==='turnout'?`; Ballot Style=${style}`:''}`,
    measures:Object.fromEntries(Object.entries(mapping.measures).map(([source,key])=>[key,row.measures[source]]))};
  })};
 })};
const json=JSON.stringify(document);parseStructuredTurnout(json);await Bun.write(output,json);
console.log(JSON.stringify({path:output,sha256:new Bun.CryptoHasher('sha256').update(json).digest('hex'),rows:document.tables.map((t:any)=>({table:t.table,rows:t.rows.length}))}));

/** Fetch official Census bulk files, validate all 159 counties and emit a seed for
 * a NEW migration. Never connects to or writes production. Run with Bun.
 * Usage: bun run scripts/import-county-statistics.ts --output /tmp/county-statistics.json
 * Optional: --seed /absolute/path/to/NEW-migration.sql (appends initial/import SQL).
 */
import { mkdir } from 'node:fs/promises';
import counties from './data/georgia-counties.json';
import topics from './data/county-statistic-catalog.json';
const cache=process.env.CENSUS_CACHE_DIR ?? '/tmp/civpulse-census';
const checked=new Date().toISOString().slice(0,10);
const base='https://www2.census.gov/';
const acsTables=['B05002','B21001','B11001','B25010','B25003','B25077','B25064','B25088','B19013','B19301','B23025','B08013','B08303','B15003','B28003','B28002','C16001','B18101'];
export function csvRow(line:string):string[]{
 const cells:string[]=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;}
 cells.push(value.replace(/\r$/,''));return cells;
}
function csv(text:string){const lines=text.trim().split(/\r?\n/);const header=csvRow(lines.shift()!);return lines.map(line=>Object.fromEntries(csvRow(line).map((v,i)=>[header[i],v])));}
function sha(data:Uint8Array|string){return new Bun.CryptoHasher('sha256').update(data).digest('hex');}
const sources:Record<string,Record<string,unknown>>={};
async function file(id:string,path:string,url:string,title:string){
 const target=`${cache}/${path}`;if(!await Bun.file(target).exists()){const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);await Bun.write(target,new Uint8Array(await r.arrayBuffer()));}
 const bytes=new Uint8Array(await Bun.file(target).arrayBuffer());
 sources[id]={id,publisher:'U.S. Census Bureau',title,source_url:url,retrieved_on:new Date(Bun.file(target).lastModified).toISOString().slice(0,10),sha256:sha(bytes)};
 return bytes;
}
async function acs(table:string){
 const target=`${cache}/${table}.json`,url=`${base}programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-${table.toLowerCase()}.dat`;
 if(!await Bun.file(target).exists()){
  const response=await fetch(url);if(!response.ok||!response.body)throw Error(`${table}: ${response.status}`);
  const hasher=new Bun.CryptoHasher('sha256'),reader=response.body.getReader(),decoder=new TextDecoder();let pending='',header:string[]=[],rows:Record<string,Record<string,string>>={};
  const line=(s:string)=>{if(!header.length){header=s.trim().split('|');return;}if(!/^0400000US13\||^0500000US13\d{3}\|/.test(s))return;const cells=s.trim().split('|');rows[cells[0].split('US')[1]]=Object.fromEntries(header.slice(1).map((h,i)=>[h,cells[i+1]]));};
  while(true){const {value,done}=await reader.read();if(done)break;hasher.update(value);pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop()!;for(const s of lines)line(s);}if(pending)line(pending);
  if(Object.keys(rows).length!==160)throw Error(`${table}: incomplete Georgia geography coverage`);
  await Bun.write(target,JSON.stringify({url,sha256:hasher.digest('hex'),rows}));
 }
 const saved=await Bun.file(target).json();if(saved.url!==url||Object.keys(saved.rows).length!==160||!/^[a-f0-9]{64}$/.test(saved.sha256))throw Error(`Invalid ${table} cache`);
 sources[table]={id:table,publisher:'U.S. Census Bureau',title:`2020–2024 ACS five-year estimates · ${table}`,source_url:url,retrieved_on:new Date(Bun.file(target).lastModified).toISOString().slice(0,10),sha256:saved.sha256};
 return saved.rows as Record<string,Record<string,string>>;
}
async function unzip(path:string,entry?:string){const p=Bun.spawn(['unzip','-p',path,...(entry?[entry]:[])],{stdout:'pipe',stderr:'pipe'});const text=await new Response(p.stdout).text();if(await p.exited)throw Error(await new Response(p.stderr).text());return text;}
export async function buildCountyStatistics(){
 await mkdir(cache,{recursive:true});
 const data:Record<string,Record<string,Record<string,string>>>={};
 for(let i=0;i<acsTables.length;i+=3)await Promise.all(acsTables.slice(i,i+3).map(async t=>{data[t]=await acs(t);}));
 const load=async(id:string,path:string,url:string,title:string)=>new TextDecoder().decode(await file(id,path,url,title));
 const population=csv(await load('population','population.csv',`${base}programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv`,'Vintage 2025 county population totals'));
 const ages=csv(await load('age','ages.csv',`${base}programs-surveys/popest/datasets/2020-2025/counties/asrh/cc-est2025-agesex-13.csv`,'Vintage 2025 Georgia county age and sex estimates')).filter(r=>r.YEAR==='7');
 const race=csv(await load('race','race.csv',`${base}programs-surveys/popest/datasets/2020-2025/counties/asrh/cc-est2025-alldata-13.csv`,'Vintage 2025 Georgia county race and Hispanic origin estimates')).filter(r=>r.YEAR==='7'&&r.AGEGRP==='0');
 const pop2020=csv(await load('census2020','census2020.txt',`${base}geo/docs/reference/cenpop2020/county/CenPop2020_Mean_CO13.txt`,'2020 Census county population counts'));
 const gazText=await load('land','land.txt',`${base}geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_gaz_counties_13.txt`,'2020 Gazetteer Georgia county land area');
 const gazLines=gazText.trim().split(/\r?\n/),gazHeader=gazLines.shift()!.trim().split('\t');const gaz=gazLines.map(l=>Object.fromEntries(l.trim().split('\t').map((v,i)=>[gazHeader[i],v])));
 const saipe=(await load('saipe','saipe.txt',`${base}programs-surveys/saipe/datasets/2024/2024-state-and-county/est24all.txt`,'2024 SAIPE state and county income and poverty estimates')).split(/\r?\n/).filter(l=>l.startsWith('13 '));
 const housingPath=`${cache}/housing.xlsx`;await file('housing','housing.xlsx',`${base}programs-surveys/popest/tables/2020-2025/housing/totals/CO-EST2025-HU-13.xlsx`,'Vintage 2025 Georgia county housing-unit estimates');
 const strings=[...(await unzip(housingPath,'xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
 const housing:Record<string,number>={};for(const row of (await unzip(housingPath,'xl/worksheets/sheet1.xml')).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  const cells=[...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)];let name='',value:number|undefined;
  for(const c of cells){const ref=c[1].match(/r="([A-Z]+)[0-9]+"/)?.[1],v=c[2].match(/<v>([^<]+)<\/v>/)?.[1];if(ref==='A'&&v&&c[1].includes('t="s"'))name=strings[Number(v)].replace(/^\./,'').replace(' County, Georgia','');if(ref==='H'&&v)value=Number(v);}
  if(name&&value!==undefined)housing[name]=value;
 }
 const business:Record<string,Record<string,string>>={},nonemployer:Record<string,Record<string,string>>={};
 for(const [id,kind] of [['cbp-co','county'],['cbp-st','state'],['nes-co','county'],['nes-st','state']] as const){
  const cbp=id.startsWith('cbp');const url=cbp?`${base}programs-surveys/cbp/datasets/2023/cbp23${kind==='county'?'co':'st'}.zip`:`${base}programs-surveys/nonemployer-statistics/datasets/2024/historical-datasets/nonemp24${kind==='county'?'co':'st'}.zip`;
  await file(id,`${id}.zip`,url,cbp?'2023 County Business Patterns':'2024 Nonemployer Statistics');
  const text=await unzip(`${cache}/${id}.zip`);const lines=text.split(/\r?\n/),header=csvRow(lines[0]);
  for(const line of lines.slice(1)){if(!line.startsWith('"13",'))continue;const c=csvRow(line),r=Object.fromEntries(header.map((h,i)=>[h,c[i]]));
   if(cbp&&r.naics==='------'&&(kind==='county'||r.lfo==='-'))business[kind==='county'?`13${r.fipscty}`:'13000']={...r,source:id};
   if(!cbp&&r.NAICS==='00'&&(kind==='county'||r.LFO==='-'))nonemployer[kind==='county'?`13${r.CTY}`:'13000']={...r,source:id};
  }
 }
 const geographies=[{fips:'13000',name:'Georgia',slug:'georgia',kind:'state'},...counties.map(c=>({...c,slug:c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),kind:'county'}))];
 if(ages.length!==159||race.length!==159||pop2020.length!==159||gaz.length!==159)throw Error('Official source geography coverage must contain 159 counties.');
 const records:any[]=[];
 for(const county of geographies){
  const fips=county.fips,state=fips==='13000',key=state?'13':fips;
  const pop=population.find(r=>r.STATE==='13'&&r.COUNTY===fips.slice(2));if(!pop)throw Error(`Missing population ${fips}`);
  const age=state?Object.fromEntries(Object.keys(ages[0]).filter(k=>/^[A-Z0-9_]+$/.test(k)).map(k=>[k,String(ages.reduce((n,r)=>n+Number(r[k]||0),0))])):ages.find(r=>r.COUNTY===fips.slice(2));
  const races=state?Object.fromEntries(Object.keys(race[0]).map(k=>[k,String(race.reduce((n,r)=>n+Number(r[k]||0),0))])):race.find(r=>r.COUNTY===fips.slice(2));
  const s=saipe.find(l=>Number(l.slice(3,6))===Number(fips.slice(2)));if(!age||!races||!s||!business[fips]||!nonemployer[fips])throw Error(`Incomplete official sources ${fips}: age=${Boolean(age)} race=${Boolean(races)} saipe=${Boolean(s)} cbp=${Boolean(business[fips])} nes=${Boolean(nonemployer[fips])}`);
  const totalPopulation=Number(pop.POPESTIMATE2025);
  if(Number(age.POPESTIMATE)!==totalPopulation||Number(races.TOT_POP)!==totalPopulation)throw Error(`Population/age/race vintages disagree for ${fips}`);
  const ageBands=topics.find(t=>t.id==='age')!.indicators.map(i=>i.code);
  if(ageBands.reduce((n,k)=>n+Number(age[k]),0)!==totalPopulation)throw Error(`Age bands do not sum to population ${fips}`);
  const get=(table:string,index:number)=>{const code=`${table}_E${String(index).padStart(3,'0')}`,raw=data[table][key]?.[code];if(raw===undefined)throw Error(`Missing ${table} ${fips} ${code}`);const value=Number(raw);return Number.isFinite(value)&&value>=0?value:null;};
  for(const topic of topics)for(const indicator of topic.indicators){
   const row:any={county_fips:fips,indicator_code:indicator.code,value:null,status:'available',period:indicator.period,source_id:'',source_variables:'',numerator:null,denominator:null,margin_of_error:null,lower_bound:null,upper_bound:null,confidence_level:null,detail:'',components:{}};
   const direct=(source:string,variable:string,value:number|null)=>{row.source_id=source;row.source_variables=variable;row.value=value;};
   const percent=(source:string,variable:string,n:number|null,d:number|null)=>{direct(source,variable,n===null||d===null||d<=0?null:Math.round(1000*n/d)/10);row.numerator=n;row.denominator=d&&d>0?d:null;};
   const acsDirect=(table:string,index:number)=>{direct(table,`${table}_${String(index).padStart(3,'0')}E`,get(table,index));const m=Number(data[table][key][`${table}_M${String(index).padStart(3,'0')}`]);if(m>=0&&Number.isFinite(m)){row.margin_of_error=m;row.confidence_level=90;}};
   const acsRatio=(table:string,indices:number[],denominator=1,complement=false)=>{
    const values=indices.map(i=>get(table,i)),d=get(table,denominator);const sum=values.some(v=>v===null)?null:values.reduce<number>((a,v)=>a+v!,0);const n=complement&&d!==null&&sum!==null?d-sum:sum;
    percent(table,`${indices.map(i=>`${table}_${String(i).padStart(3,'0')}E`).join('+')}/${table}_${String(denominator).padStart(3,'0')}E${complement?' (complement)':''}`,n,d);
    row.components=Object.fromEntries([...new Set([...indices,denominator])].map(i=>[`${table}_${String(i).padStart(3,'0')}`,{estimate:get(table,i),margin_of_error:Number(data[table][key][`${table}_M${String(i).padStart(3,'0')}`])}]));
   };
   const total=Number(pop.POPESTIMATE2025),ageN=(name:string)=>Number(age[name]),raceN=(name:string)=>Number(races[name]);
   const code=indicator.code;
   if(code==='PST045225')direct('population','POPESTIMATE2025',total);
   else if(code==='POP010220')direct('census2020','POPULATION',state?pop2020.reduce((n,r)=>n+Number(r.POPULATION),0):Number(pop2020.find(r=>r.COUNTYFP===fips.slice(2))!.POPULATION));
   else if(code==='PST120225')percent('population','(POPESTIMATE2025 - ESTIMATESBASE2020) / ESTIMATESBASE2020',total-Number(pop.ESTIMATESBASE2020),Number(pop.ESTIMATESBASE2020));
   else if(code==='AGE295225')percent('age','(POPESTIMATE - AGE18PLUS_TOT) / POPESTIMATE',ageN('POPESTIMATE')-ageN('AGE18PLUS_TOT'),ageN('POPESTIMATE'));
   else if(code==='AGE775225')percent('age','AGE65PLUS_TOT / POPESTIMATE',ageN('AGE65PLUS_TOT'),ageN('POPESTIMATE'));
   else if(code==='SEX255225')percent('age','POPEST_FEM / POPESTIMATE',ageN('POPEST_FEM'),ageN('POPESTIMATE'));
   else if(topic.id==='age'){percent('age',`${code} / POPESTIMATE`,ageN(code),ageN('POPESTIMATE'));row.detail=`${ageN(code).toLocaleString('en-US')} residents`;}
   else if(topic.id==='race-ethnicity'){
    const prefixes:Record<string,string>={RHI125225:'WA',RHI225225:'BA',RHI325225:'IA',RHI425225:'AA',RHI525225:'NA',RHI625225:'TOM',RHI725225:'H',RHI825225:'NHWA'};
    const prefix=prefixes[code];percent('race',`(${prefix}_MALE + ${prefix}_FEMALE) / TOT_POP`,raceN(`${prefix}_MALE`)+raceN(`${prefix}_FEMALE`),raceN('TOT_POP'));
   }else if(topic.id==='poverty'){
    const start=code.endsWith('ALL')?34:code.endsWith('UNDER18')?76:118;
    direct('saipe',`est24all.txt columns ${start+1}–${start+4}`,Number(s.slice(start,start+4)));
    row.lower_bound=Number(s.slice(start+5,start+9));row.upper_bound=Number(s.slice(start+10,start+14));row.confidence_level=90;
    const countStart=code.endsWith('ALL')?7:code.endsWith('UNDER18')?49:91;row.components={count:Number(s.slice(countStart,countStart+8)),count_lower:Number(s.slice(countStart+9,countStart+17)),count_upper:Number(s.slice(countStart+18,countStart+26))};
   }else if(code==='HSG010225')direct('housing','Housing units, July 1, 2025 (column H)',housing[county.name]??null);
   else if(code==='POP645224')acsRatio('B05002',[13]);
   else if(code==='VET605224')acsDirect('B21001',2);
   else if(code==='HSD410224')acsDirect('B11001',1);
   else if(code==='HSD310224')acsDirect('B25010',1);
   else if(code==='HSG445224')acsRatio('B25003',[2]);
   else if(code==='HSG495224')acsDirect('B25077',1);
   else if(code==='HSG860224')acsDirect('B25064',1);
   else if(code==='HSG650224')acsDirect('B25088',2);
   else if(code==='INC110224')acsDirect('B19013',1);
   else if(code==='INC910224')acsDirect('B19301',1);
   else if(code==='LFE046224')acsRatio('B23025',[3]);
   else if(code==='LFE305224'){
    const n=get('B08013',1),d=get('B08303',1);direct('B08013','B08013_001E / B08303_001E',n===null||!d?null:Math.round(10*n/d)/10);row.numerator=n;row.denominator=d;row.components={denominator_source:sources.B08303};
   }else if(code==='EST211223')direct(business[fips].source,'est (NAICS total)',Number(business[fips].est));
   else if(code==='BZA110223')direct(business[fips].source,'emp (NAICS total)',Number(business[fips].emp));
   else if(code==='NES010224')direct(nonemployer[fips].source,'ESTAB (NAICS 00)',nonemployer[fips].ESTAB_F?null:Number(nonemployer[fips].ESTAB));
   else if(code==='EDU635224')acsRatio('B15003',Array.from({length:9},(_,i)=>17+i));
   else if(code==='EDU685224')acsRatio('B15003',[22,23,24,25]);
   else if(code==='COM100224')acsRatio('B28003',[2]);
   else if(code==='INT250224')acsRatio('B28002',[4]);
   else if(code==='POP815224')acsRatio('C16001',[2],1,true);
   else if(code==='DIS010224'){
    const nums=[4,7,10,13,23,26,29,32],dens=[3,6,9,12,22,25,28,31];const sum=(cells:number[])=>{const values=cells.map(i=>get('B18101',i));return values.some(v=>v===null)?null:values.reduce<number>((a,v)=>a+v!,0);};const n=sum(nums),d=sum(dens);
    percent('B18101',`sum(${nums.join(',')}) / sum(${dens.join(',')}) in B18101`,n,d);row.components={numerator_cells:nums,denominator_cells:dens};
   }else if(code==='LND110220'||code==='POP060220'){
    const area=state?gaz.reduce((n,r)=>n+Number(r.ALAND_SQMI),0):Number(gaz.find(r=>r.GEOID===fips)!.ALAND_SQMI);
    const count=state?pop2020.reduce((n,r)=>n+Number(r.POPULATION),0):Number(pop2020.find(r=>r.COUNTYFP===fips.slice(2))!.POPULATION);
    direct('land',code==='LND110220'?'ALAND_SQMI':'2020 Census POPULATION / ALAND_SQMI',code==='LND110220'?Math.round(area*100)/100:Math.round(count/area*10)/10);
    if(code==='POP060220'){row.numerator=count;row.denominator=area;row.components={population_source:sources.census2020};}
   }else throw Error(`Unmapped indicator ${code}`);
   if(row.value===null){row.status='unavailable';row.detail='Not available in the official source.';}else if(!Number.isFinite(row.value))throw Error(`Non-numeric ${fips} ${code}`);
   if(!row.source_id)throw Error(`Missing source ${fips} ${code}`);
   records.push(row);
  }
 }
 if(records.length!==160*59)throw Error(`Expected 9,440 observations, got ${records.length}`);
 const indicators=topics.flatMap(t=>t.indicators.map(({period,...i})=>({...i,topic_id:t.id,definition:t.note})));
 return {geographies,topics:topics.map(({indicators,...t})=>t),indicators,sources:Object.values(sources),records};
}
if(import.meta.main){
 const snapshot=await buildCountyStatistics();const args=process.argv.slice(2),output=args[args.indexOf('--output')+1];
 if(args.includes('--output'))await Bun.write(output,JSON.stringify(snapshot,null,2)+'\n');
 const seed=args[args.indexOf('--seed')+1];if(args.includes('--seed')){
  const entries=[['county_geographies',snapshot.geographies],['county_statistic_topics',snapshot.topics],['county_statistic_indicators',snapshot.indicators],['county_statistic_sources',snapshot.sources],['county_statistics',snapshot.records]] as const;
  const existing=await Bun.file(seed).text();if(existing.includes('-- Official Census snapshot'))throw Error('Refusing to append another snapshot to a migration. Create a new migration for a refresh.');
  let sql='\n-- Official Census snapshot, retrieved '+checked+'. Reproduce with scripts/import-county-statistics.ts.\n';
  for(const [table,rows] of entries){const keys=Object.keys(rows[0]);const conflict=table==='county_statistics'?['county_fips','indicator_code']:table==='county_geographies'?['fips']:table==='county_statistic_indicators'?['code']:['id'];const quote=(s:string)=>`'${s.replaceAll("'","''")}'`;sql+=`insert into public.${table} (${keys.join(',')}) select ${keys.join(',')} from jsonb_populate_recordset(null::public.${table},${quote(JSON.stringify(rows))}::jsonb) on conflict (${conflict.join(',')}) do update set ${keys.filter(k=>!conflict.includes(k)).map(k=>`${k}=excluded.${k}`).join(',')};\n`;}
  await Bun.write(seed,(await Bun.file(seed).text())+sql);
 }
 console.log(`Validated ${snapshot.geographies.length-1} counties + Georgia, ${snapshot.indicators.length} measures, ${snapshot.records.length} observations.`);
}

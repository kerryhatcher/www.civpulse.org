import {getSupabase} from '../lib/supabase';
import {selectedCounty} from './county-filter';
const labels:Record<string,string>={accepted:'Accepted ballots',requested:'Requested ballots',issued:'Issued ballots',returned:'Returned ballots',rejected:'Rejected ballots',spoiled_canceled:'Spoiled / canceled',outstanding:'Outstanding ballots',acceptance_ratio:'Accepted / returned ratio',turnout:'Turnout'};
function el(tag:string,text:string){const e=document.createElement(tag);e.textContent=text;return e;}
export function initStructuredTurnout(){
 const election=document.querySelector<HTMLSelectElement>('#result-election')!;
 const status=document.querySelector<HTMLElement>('#turnout-status')!;
 const content=document.querySelector<HTMLElement>('#turnout-rows')!;
 const history=document.querySelector<HTMLSelectElement>('#turnout-history')!;
 const more=document.querySelector<HTMLButtonElement>('#turnout-more')!;
 let generation=0,offset=0,shown=0,currentReport:string|null=null;
 async function load(append=false){
  const request=++generation;const id=election.value;
  more.hidden=true;if(!append){offset=0;shown=0;content.replaceChildren();}
  if(!id){status.textContent='Choose an election to view structured turnout.';return;}
  status.textContent='Loading structured turnout…';
  try{
   const {data,error}=await getSupabase().rpc('get_structured_turnout',{p_election_id:id,p_report_id:append?currentReport:history.value||null,p_offset:offset,p_limit:100});
   if(request!==generation)return;if(error)throw error;
   if(data.status!=='ok'){status.textContent=data.status==='empty'?'No structured turnout reports yet. Missing data is not zero.':'Structured turnout unavailable.';history.replaceChildren();return;}
   currentReport=data.report.id;
   const county=selectedCounty();
   const matches=(row:{county_fips:string})=>county==='all'||row.county_fips===county;
   let scanned=offset+data.rows.length;
   const rows=data.rows.filter(matches);
   while(rows.length<100&&scanned<data.total){
    const next=await getSupabase().rpc('get_structured_turnout',{p_election_id:id,p_report_id:currentReport,p_offset:scanned,p_limit:100});
    if(request!==generation)return;
    if(next.error||next.data?.status!=='ok'||next.data.report.id!==currentReport||!next.data.rows.length)throw new Error('Could not read the turnout snapshot');
    scanned+=next.data.rows.length;rows.push(...next.data.rows.filter(matches));
   }
   if(!append){
    const selected=history.value;history.replaceChildren();const latest=document.createElement('option');latest.value='';latest.textContent='Latest snapshot';history.append(latest);
    for(const report of data.history){const option=document.createElement('option');option.value=report.id;option.textContent=`Collected ${new Date(report.captured_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})}`;history.append(option);}history.value=selected;
    content.append(el('p',`Unofficial · turnout only · Collected ${new Date(data.report.captured_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})}. Source times are shown separately below.`));
    const source=document.createElement('a');source.href=data.report.source_url;source.textContent='Georgia SOS source';content.append(source,el('p',`Evidence SHA-256: ${data.report.sha256}`));
   }
   for(const row of rows){
    const card=document.createElement('article');card.append(el('h3',`${row.county_label} (${row.county_fips}) · ${row.ballot_style} · ${row.table}`));
    card.append(el('p',`${row.source_title} · ${row.counting_group.replaceAll('_',' ')} · ${row.as_of_label||'Source as-of time not reported'}`));
    const list=document.createElement('dl');
    for(const [name,cell] of Object.entries(row.measures) as Array<[string,{value:number|null;display:string}]>){list.append(el('dt',labels[name]??name),el('dd',`${cell.display} (${cell.value===null?'Unavailable':name==='acceptance_ratio'?`ratio ${cell.value}`:cell.value.toLocaleString('en-US')})`));}
    card.append(list,el('p',`Source object ${row.object_id} · ${row.locator}`));content.append(card);
   }
   offset=scanned;shown+=rows.length;more.hidden=offset>=data.total;
   status.textContent=`${shown} matching rows shown · checked ${offset} of ${data.total} source rows. These overlapping tables are separate views; never add them together. Registration and precinct denominators are not reported.`;
  }catch{if(request===generation)status.textContent='Could not load structured turnout. Please retry Load reports.';}
 }
 election.addEventListener('change',()=>{history.replaceChildren();void load();});
 window.addEventListener('countychange',()=>void load());
 document.querySelector('#result-form')!.addEventListener('submit',()=>void load());
 history.addEventListener('change',()=>void load());more.addEventListener('click',()=>void load(true));
 void load();
}

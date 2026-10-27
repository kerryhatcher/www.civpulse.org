import { getSupabase } from '../lib/supabase';

type Counts={ballots?:number|null;voters?:number|null;registered?:number|null;precincts_reported?:number|null;precincts_total?:number|null};
type Report={id:string;scope:{county:string;unit_type:string;unit:string;counting_group:string;ballot_style:string};observed_at:string;supersedes:string|null;
 snapshot:{status:string;note?:string;turnout:Counts;contests:Array<Counts & {contest_id?:string;question_id?:string;choices:Array<{label:string;votes:number}>;total_votes?:number|null;unresolved_write_ins?:number|null;undervotes?:number|null;overvotes?:number|null}>}};
const n=(v:number|null|undefined)=>v==null?'Not reported':v.toLocaleString('en-US');
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function counts(parent:HTMLElement,c:Counts){
 parent.append(element('p',`Ballots: ${n(c.ballots)} · Voters: ${n(c.voters)} · Registered voters: ${n(c.registered)}`));
 const numerator=c.voters??c.ballots;
 const basis=c.voters!=null?'voters':'ballots';
 const turnout=numerator!=null&&c.registered!=null&&c.registered>0?`${(100*numerator/c.registered).toFixed(2)}%`:'Not reported';
 parent.append(element('p',`Turnout (${basis} / registered): ${turnout} · Precincts reported: ${n(c.precincts_reported)} / ${n(c.precincts_total)}`));
}
export async function initElectionResults(){
 const select=document.querySelector<HTMLSelectElement>('#result-election')!;
 const status=document.querySelector<HTMLElement>('#result-status')!;
 const reports=document.querySelector<HTMLElement>('#result-reports')!;
 const history=document.querySelector<HTMLInputElement>('#result-history')!;
 const more=document.querySelector<HTMLButtonElement>('#result-more')!;
 let offset=0; let generation=0; const titles=new Map<string,string>();
 async function load(append=false){
  const request=++generation;
  if(!append){offset=0;reports.replaceChildren();}
  more.hidden=true;
  if(!select.value){status.textContent='Choose an election to view reports.';return;}
  status.textContent='Loading reports…';
  try{
   const db=getSupabase();
   const {data,error}=await db.rpc('get_election_results',{p_election_id:select.value,p_history:history.checked,p_offset:offset,p_limit:20});
   if(request!==generation)return;
   if(error)throw error;
   if(data.status!=='ok'){status.textContent='Election unavailable or access restricted.';return;}
   for(const r of data.reports as Report[]){
    const article=element('article');
    article.append(element('h2',`${r.scope.county} · ${r.scope.unit_type}: ${r.scope.unit}`));
    article.append(element('p',`${r.snapshot.status==='certified'?'Certified':r.snapshot.status==='official'?'Official':'Unofficial'} · ${r.scope.counting_group.replaceAll('_',' ')} · Ballot style: ${r.scope.ballot_style}`));
    article.append(element('p',`Report time: ${new Date(r.observed_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})}`));
    if(r.supersedes)article.append(element('p','Replaces an earlier report; totals are cumulative.'));
    counts(article,r.snapshot.turnout);
    if(r.snapshot.note)article.append(element('p',r.snapshot.note));
    for(const c of r.snapshot.contests){
     article.append(element('h3',titles.get(c.contest_id??c.question_id??'')??'Contest'));
     const table=element('table');const head=element('tr');head.append(element('th','Candidate / choice'),element('th','Votes'));const thead=element('thead');thead.append(head);table.append(thead);
     const body=element('tbody');for(const choice of c.choices){const row=element('tr');row.append(element('td',choice.label),element('td',n(choice.votes)));body.append(row);}table.append(body);article.append(table);
     article.append(element('p',`Printed total votes: ${n(c.total_votes)} · Unresolved write-ins (separate): ${n(c.unresolved_write_ins)} · Undervotes: ${n(c.undervotes)} · Overvotes: ${n(c.overvotes)}`));
     article.append(element('p',`Contest ballots: ${n(c.ballots)} · Contest registered voters: ${n(c.registered)} · Contest precincts: ${n(c.precincts_reported)} / ${n(c.precincts_total)}`));
     if(c.ballots!=null&&c.registered!=null&&c.registered>0)article.append(element('p',`Contest participation (ballots / contest registered): ${(100*c.ballots/c.registered).toFixed(2)}%`));
    }
    reports.append(article);
   }
   offset+=data.reports.length;more.hidden=data.reports.length<20;
   status.textContent=offset?`${offset} report${offset===1?'':'s'} shown. ${history.checked?'Includes earlier snapshots.':'Latest snapshot for each reporting scope.'}`:'No photo/PDF reports yet. Check structured turnout below; missing vote counts are not zero.';
  }catch(error){if(request===generation)status.textContent=`Could not load reports: ${error instanceof Error?error.message:'Please try again.'}`;}
 }
 async function choose(){
  const request=++generation;
  more.hidden=true;
  titles.clear();
  if(select.value){const {data}=await getSupabase().rpc('get_election',{p_id:select.value});
   if(request!==generation)return;
   for(const c of data?.contests??[])titles.set(c.id,[c.office,c.district,c.seat].filter(Boolean).join(' · '));
   for(const q of data?.ballot_questions??[])titles.set(q.id,q.title);
  }
  await load();
 }
 document.querySelector('#result-form')!.addEventListener('submit',event=>{event.preventDefault();void choose();});
 select.addEventListener('change',()=>void choose());
 history.addEventListener('change',()=>void choose());
 more.addEventListener('click',()=>void load(true));
 try{
  const db=getSupabase();await db.auth.getSession();
  const {data,error}=await db.rpc('search_elections',{p_query:'',p_limit:100});if(error)throw error;
  for(const e of data??[]){const option=element('option',`${e.election_date} — ${e.name}`);option.value=e.id;select.append(option);}
  const id=new URL(location.href).searchParams.get('id');
  if(id&&/^[a-f0-9-]{36}$/i.test(id)){
   if(!Array.from(select.options).some(o=>o.value===id)){
    const {data}=await db.rpc('get_election',{p_id:id});if(data?.status==='ok'){const option=element('option',data.election.name);option.value=id;select.append(option);}
   }
   select.value=id;
  }else{const example=(data??[]).find((e:{election_date:string})=>e.election_date==='2026-11-03');if(example)select.value=example.id;}
  await choose();
 }catch{status.textContent='Could not load elections. Please try again.';}
}

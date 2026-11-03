import {getSupabase} from '../lib/supabase';
import {observationSummary,observationSource,type OfficeholderObservation} from '../lib/officeholder-observations';
export async function loadOfficeholderObservations(personId?:string,organizationId?:string){
 const root=document.querySelector<HTMLElement>('[data-officeholder-observations]');if(!root)return;
 const list=root.querySelector<HTMLElement>('[data-observation-list]')!,status=root.querySelector<HTMLElement>('[data-observation-status]')!,form=root.querySelector<HTMLFormElement>('form')!,next=root.querySelector<HTMLButtonElement>('[data-observation-next]')!,download=root.querySelector<HTMLButtonElement>('[data-observation-export]')!;
 let offset=0,page:unknown=null,requestId=0;
 const load=async()=>{const id=++requestId,requestedOffset=offset;try{
 const asof=(form.elements.namedItem('as_of') as HTMLInputElement).value,history=(form.elements.namedItem('history') as HTMLInputElement).checked;
 const api=getSupabase(),args={p_person_id:personId??null,p_organization_id:organizationId??null,p_as_of:asof||null,p_history:history,p_offset:requestedOffset,p_limit:50};
 const {data,error}=await api.rpc('read_officeholder_observations',args);if(error)throw error;if(id!==requestId)return;
 // A correction may move all latest revisions to another owner. Probe permitted
 // history before hiding its only discovery control; no private existence signal.
 let hasHistory=Boolean(data.total);
 if(!data.total&&!asof&&!history){const prior=await api.rpc('read_officeholder_observations',{...args,p_history:true,p_limit:1,p_offset:0});if(prior.error)throw prior.error;if(id!==requestId)return;hasHistory=Boolean(prior.data.total);}
 form.hidden=false;download.hidden=false;
 page={...data,parent:{person_id:personId??null,organization_id:organizationId??null},export_scope:'Only this filtered page of observations; not complete service history. No term boundaries inferred.'};
 root.hidden=!hasHistory&&!asof&&!history;
 list.replaceChildren(...data.rows.map((r:OfficeholderObservation)=>{const li=document.createElement('li'),p=document.createElement('p'),hash=document.createElement('p');p.textContent=observationSummary(r);li.append(p);const source=observationSource(r.payload.source_url);if(source){const a=document.createElement('a');a.href=source;a.textContent='Source';a.rel='noopener noreferrer';li.append(a);}hash.textContent='Document SHA-256: '+r.payload.document_sha256;li.append(hash);if(r.person_slug){const person=document.createElement('a');person.href='/people/view/?id='+encodeURIComponent((r.payload as any).person_id);person.textContent='Reviewed person profile';li.append(person);}const org=document.createElement('a');org.href='/orgs/'+encodeURIComponent(r.organization_slug)+'/';org.textContent='Recorded organization';li.append(org);return li;}));
 status.textContent=`${requestedOffset+1}–${requestedOffset+data.rows.length} of ${data.total} matching observations. Retrieval dates are not verification dates.`;if(!data.rows.length)status.textContent=hasHistory?'No current observations on this profile. Include superseded observations to inspect published history.':'No observations match this filter. This does not establish absence from office.';
 next.hidden=requestedOffset+data.rows.length>=data.total;download.disabled=!data.rows.length;
 }catch{if(id!==requestId)return;status.textContent='Could not refresh observations. Published evidence remains visible; reload to retry.';root.hidden=false;}};
 form.onsubmit=e=>{e.preventDefault();offset=0;void load();};next.onclick=()=>{offset+=50;void load();};
 download.onclick=()=>{if(!page)return;const url=URL.createObjectURL(new Blob([JSON.stringify(page,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='officeholder-observations-page.json';a.click();URL.revokeObjectURL(url);};
 await load();
}

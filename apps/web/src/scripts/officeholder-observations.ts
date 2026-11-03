import {getSupabase} from '../lib/supabase';
import {observationSummary,type OfficeholderObservation} from '../lib/officeholder-observations';
export async function loadOfficeholderObservations(personId?:string,organizationId?:string){
 const root=document.querySelector<HTMLElement>('[data-officeholder-observations]');if(!root)return;
 const list=root.querySelector<HTMLElement>('[data-observation-list]')!,status=root.querySelector<HTMLElement>('[data-observation-status]')!,form=root.querySelector<HTMLFormElement>('form')!,next=root.querySelector<HTMLButtonElement>('[data-observation-next]')!,download=root.querySelector<HTMLButtonElement>('[data-observation-export]')!;
 let offset=0,page:unknown=null;
 const load=async()=>{try{
 const asof=(form.elements.namedItem('as_of') as HTMLInputElement).value,history=(form.elements.namedItem('history') as HTMLInputElement).checked;
 const {data,error}=await getSupabase().rpc('read_officeholder_observations',{p_person_id:personId??null,p_organization_id:organizationId??null,p_as_of:asof||null,p_history:history,p_offset:offset,p_limit:50});if(error)throw error;
 form.hidden=false;download.hidden=false;
 page={...data,parent:{person_id:personId??null,organization_id:organizationId??null},export_scope:'Only this filtered page of observations; not complete service history. No term boundaries inferred.'};
 root.hidden=!data.total&&!asof&&!history;list.replaceChildren(...data.rows.map((r:OfficeholderObservation)=>{const li=document.createElement('li'),p=document.createElement('p'),a=document.createElement('a'),hash=document.createElement('p');p.textContent=observationSummary(r);a.href=r.payload.source_url;a.textContent='Source';a.rel='noopener noreferrer';hash.textContent='Document SHA-256: '+r.payload.document_sha256;li.append(p,a,hash);if(r.person_slug){const person=document.createElement('a');person.href='/people/view/?id='+encodeURIComponent((r.payload as any).person_id);person.textContent='Reviewed person profile';li.append(person);}const org=document.createElement('a');org.href='/orgs/'+encodeURIComponent(r.organization_slug)+'/';org.textContent='Recorded organization';li.append(org);return li;}));
 status.textContent=`${offset+1}–${offset+data.rows.length} of ${data.total} matching observations. Retrieval dates are not verification dates.`;if(!data.rows.length)status.textContent='No observations match this filter. This does not establish absence from office.';
 next.hidden=offset+data.rows.length>=data.total;download.disabled=!data.rows.length;
 }catch{status.textContent='Could not refresh observations. Published evidence remains visible; reload to retry.';root.hidden=false;}};
 form.onsubmit=e=>{e.preventDefault();offset=0;void load();};next.onclick=()=>{offset+=50;void load();};
 download.onclick=()=>{if(!page)return;const url=URL.createObjectURL(new Blob([JSON.stringify(page,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='officeholder-observations-page.json';a.click();URL.revokeObjectURL(url);};
 await load();
}

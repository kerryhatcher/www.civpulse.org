import {legislationAnchor} from '../lib/legislation-details';
import {getSupabase} from '../lib/supabase';
import {legislativeCard} from './legislation';
import type {LegislativeRow} from '../lib/legislation';
export async function readDetailPage(url:string):Promise<LegislativeRow[]> {
  if(!/^\/directory-data\/legislation\/details-[a-z0-9_-]+\.json$/.test(url))throw new Error('Invalid published detail URL');
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Published records unavailable (${response.status})`);
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.length>25||rows.some(row=>row.visibility!=='public'))throw new Error('Invalid published detail page');
  return rows;
}
export async function initPublicLegislationDetail() {
  const root=document.querySelector<HTMLElement>('[data-public-legislation-detail]');if(!root)return;
  // A signed-in caller keeps the existing live, permission-checked detail flow.
  const {data:{session},error}=await getSupabase().auth.getSession();
  if(!error && session && root.dataset.liveViewer) {location.replace(root.dataset.liveViewer+'#'+encodeURIComponent(legislationAnchor(location.hash).slice(1)));return;}
  for(const section of root.querySelectorAll<HTMLElement>('[data-static-legislation-section]')) {
    const button=section.querySelector<HTMLButtonElement>('[data-section-more]');if(!button)continue;
    const list=section.querySelector<HTMLElement>('[data-section-results]')!,status=section.querySelector<HTMLElement>('[data-section-status]')!;
    const pages=JSON.parse(section.dataset.pages??'{}') as Record<number,string>;
    const omit=JSON.parse(section.dataset.omit??'[]') as string[];
    let offset=list.childElementCount;button.hidden=false;
    button.onclick=async()=>{
      button.disabled=true;status.textContent='Loading published records…';
      try {
        const url=pages[offset];if(!url)throw new Error('Missing published detail page');
        const rows=await readDetailPage(url);
        if(rows.length!==Math.min(25,Number(section.dataset.total)-offset))throw new Error('Incomplete published detail page');
        list.append(...rows.map(row=>legislativeCard(section.dataset.table!,row,'h3',omit)));
        offset+=rows.length;button.hidden=offset>=Number(section.dataset.total);status.textContent='';button.textContent='Load more';
      }catch {status.textContent='Could not load published records. Try again.';button.textContent='Try again';}
      finally{button.disabled=false;}
    };
  }
}

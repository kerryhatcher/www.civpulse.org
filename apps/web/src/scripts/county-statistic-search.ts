import {getSupabase} from '../lib/supabase';
import {formatStatistic,type StatisticRecord} from '../lib/county-statistics';
export function initStatisticSearch():void{
 const form=document.querySelector<HTMLFormElement>('[data-statistic-search]'),list=document.querySelector<HTMLElement>('[data-statistic-results]'),status=document.querySelector<HTMLElement>('[data-statistic-status]'),previous=document.querySelector<HTMLButtonElement>('[data-statistic-previous]'),next=document.querySelector<HTMLButtonElement>('[data-statistic-next]');
 if(!form||!list||!status||!previous||!next)return;
 const ui={form,list,status,previous,next};let offset=0,query='',county='',revision=0;const size=25;
 async function load(){const version=++revision;ui.previous.disabled=ui.next.disabled=true;ui.status.textContent='Loading statistics…';
  try{const {data,error}=await getSupabase().rpc('search_county_statistics',{p_query:query,p_county_fips:county||null,p_limit:size,p_offset:offset});if(error)throw error;if(version!==revision)return;
   const payload=data as {results:StatisticRecord[];total_count:number};ui.list.replaceChildren();
   for(const row of payload.results){const article=document.createElement('article');article.className='org-card';const title=document.createElement('h2'),a=document.createElement('a');a.href=row.county_fips==='13000'?'/counties/':`/counties/${row.county_slug}/#demographics`;a.textContent=`${row.county_name}${row.county_fips==='13000'?'':' County'} · ${row.label}`;title.append(a);
    const value=document.createElement('p');value.textContent=`${formatStatistic(row)} · ${row.period}`;const source=document.createElement('a');source.href=row.source_url;source.textContent=`${row.publisher} · ${row.source_title}`;article.append(title,value,source);ui.list.append(article);}
   ui.status.textContent=payload.total_count?`Showing ${offset+1}–${offset+payload.results.length} of ${payload.total_count} statistics.`:'No statistics match your search.';ui.previous.disabled=offset===0;ui.next.disabled=offset+size>=payload.total_count;
  }catch{if(version===revision)ui.status.textContent='Statistics could not be loaded. Try searching again.';}
 }
 form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(ui.form);query=String(data.get('query')??'');county=String(data.get('county')??'');offset=0;void load();});previous.addEventListener('click',()=>{offset=Math.max(0,offset-size);void load();});next.addEventListener('click',()=>{offset+=size;void load();});void load();
}

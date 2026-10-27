import {getPublicLegislationDetails} from './legislation-detail-build-data';
import {detailTables,type DetailTable} from './legislation-details';
export async function loadLegislationDetailAssets() {
  const details=await getPublicLegislationDetails();
  const assets:{path:string;body:string}[]=[];
  async function add(key:string,value:unknown) {
    const body=JSON.stringify(value);
    const bytes=new TextEncoder().encode(body);
    if(bytes.length>20*1024*1024)throw new Error('Legislation detail asset exceeds safe static size');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const path=`legislation/details-${key}-${hash}.json`;
    assets.push({path,body});return `/directory-data/${path}`;
  }
  const indexes={} as Record<DetailTable,string>;
  for(const table of detailTables) indexes[table]=await add(`index-${table}`,[...details.values()].filter(detail=>detail.table===table).map(detail=>detail.row.id).sort());
  const pages=new Map<string,import('./legislation-details').LegislationDetail>();
  for(const [key,detail] of details) {
    const sections=[];
    for(const section of detail.sections) {
      const chunks:Record<number,string>={};
      for(let offset=25;offset<section.rows.length;offset+=25) chunks[offset]=await add(`${detail.row.id}-${section.table}-${offset}`,section.rows.slice(offset,offset+25));
      sections.push({...section,rows:section.rows.slice(0,25),pages:chunks});
    }
    pages.set(key,{...detail,sections});
  }
  return {assets,indexes,pages};
}
let snapshot:ReturnType<typeof loadLegislationDetailAssets>|undefined;let refreshAfter=0;
export function getLegislationDetailAssets(){
  if(import.meta.env.DEV && Date.now()>=refreshAfter){snapshot=undefined;refreshAfter=Date.now()+30000;}
  return snapshot??=loadLegislationDetailAssets();
}

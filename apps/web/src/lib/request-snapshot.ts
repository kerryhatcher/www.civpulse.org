import {englishStopWords} from './english-stopwords';
import type {RequestDetail,RequestRecord} from './records-requests';
import {searchDirectory} from './directories';
import {webHref} from './public-records';
export type PublicRequestDetail=Pick<RequestDetail,'organizations'|'updates'|'fees'|'links'> & {
 request:RequestRecord & {visibility:'public'};
 files:Pick<RequestDetail['files'][number],'id'|'file_name'|'size_bytes'>[];
};
export type DirectoryRequest=RequestRecord & {target_name:string|null;source_name:string|null};
export interface RequestDirectory {version:1;requests:DirectoryRequest[];organizations:{id:string;name:string}[]}
export function publicRequestDetail(detail:RequestDetail):PublicRequestDetail {
 if(detail.status!=='ok'||detail.can_manage!==false||detail.request?.visibility!=='public'||detail.owner_id!==undefined||detail.transfers!==undefined)throw new Error('Non-public or privileged request export');
 const r=detail.request;
 const fields=['id','title','description','stage','outcome','visibility','request_type','target_organization_id','source_organization_id','submitted_on','next_follow_up_on','reference_number','updated_at'] as const;
 const request=Object.fromEntries(fields.map(key=>[key,r[key]])) as PublicRequestDetail['request'];
 if(detail.files.some(file=>file.is_private!==false))throw new Error('Private file in public request export');
 return {
  request,
  organizations:detail.organizations.map(o=>({id:o.id,name:o.name,slug:o.slug})),
  updates:detail.updates.map(u=>({id:u.id,occurred_on:u.occurred_on,kind:u.kind,body:u.body})),
  fees:detail.fees.map(f=>({id:f.id,kind:f.kind,amount:f.amount,occurred_on:f.occurred_on,note:f.note})),
  links:detail.links.flatMap(l=>{const url=webHref(l.url);return url?[{id:l.id,title:l.title,url}]:[];}),
  // File IDs/names/sizes are publishable; paths and signed URLs are resolved only
  // after a fresh access check on Download. No owner/transfer/file-private data.
  files:detail.files.map(f=>({id:f.id,file_name:f.file_name,size_bytes:f.size_bytes})),
 };
}
export function requestDirectoryRow(detail:PublicRequestDetail):DirectoryRequest {
 const r=detail.request;
 return {...r,target_name:detail.organizations.find(o=>o.id===r.target_organization_id)?.name??null,source_name:detail.organizations.find(o=>o.id===r.source_organization_id)?.name??null};
}
export function browsePublicRequests(rows:DirectoryRequest[],query='',stage='',organization='',offset=0) {
 const matched=searchDirectory(rows.map(record=>({record,search:`${record.title} ${record.description}`})),query,{literalFallback:false,stopWords:englishStopWords})
  .filter(row=>(!stage||row.stage===stage)&&(!organization||[row.target_organization_id,row.source_organization_id].includes(organization)));
 matched.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));
 return {rows:matched.slice(offset,offset+25),total:matched.length};
}
export function requestFeeTotals(fees:PublicRequestDetail['fees']) {
 return Object.fromEntries(['estimated','billed','paid'].map(kind=>[kind,fees.filter(f=>f.kind===kind).reduce((sum,f)=>sum+Math.round(Number(f.amount)*100),0)/100])) as Record<'estimated'|'billed'|'paid',number>;
}
export const requestAnchor=(hash:string)=>['timeline','fees','files'].map(id=>'#'+id).find(anchor=>anchor===hash)??'';

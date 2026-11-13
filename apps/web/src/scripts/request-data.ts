import type {SupabaseClient} from '@supabase/supabase-js';
import type {RequestDetail} from '../lib/records-requests';
import {REQUEST_BUCKET} from '../lib/records-requests';
import type {RequestDirectory} from '../lib/request-snapshot';
const assets=new Map<string,Promise<unknown>>();
async function asset(url:string,kind:'directory'|'index') {
 if(!/^\/directory-data\/requests-(directory|index)-[a-f0-9]{64}\.json$/.test(url)||!url.startsWith('/directory-data/requests-'+kind+'-'))throw new Error('Invalid published request asset');
 let promise=assets.get(url);if(!promise){promise=(async()=>{const response=await fetch(url);if(!response.ok)throw new Error('Published requests unavailable. Reload to try again.');return response.json();})();assets.set(url,promise);promise.catch(()=>{if(assets.get(url)===promise)assets.delete(url);});}return promise;
}
async function signedIn(client:SupabaseClient) {const {data:{session},error}=await client.auth.getSession();if(error)throw error;return !!session;}
export async function readPublicRequestDirectory(client:SupabaseClient,url:string|undefined):Promise<RequestDirectory|null> {
 if(await signedIn(client))return null;if(!url)throw new Error('Missing published request directory');
 const data=await asset(url,'directory') as RequestDirectory;
 if(data?.version!==1||!Array.isArray(data.requests)||!Array.isArray(data.organizations)||data.requests.some(r=>r.visibility!=='public'))throw new Error('Invalid published request directory');return data;
}
export async function publicRequestTarget(client:SupabaseClient,url:string|undefined,id:string,live=false):Promise<string|null> {
 if(await signedIn(client)||live)return null;if(!url)throw new Error('Missing published request index');
 const ids=await asset(url,'index');if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)))throw new Error('Invalid published request index');
 return ids.includes(id.toLowerCase())?`/records/requests/${id.toLowerCase()}/`:null;
}
/** File paths never enter static assets. Re-read the authorized file list before
 * requesting the same short-lived Storage signature used by the live viewer. */
export async function requestFileDownload(client:SupabaseClient,requestId:string,fileId:string,origin:string) {
 if(![requestId,fileId].every(id=>/^[a-f0-9-]{36}$/i.test(id)))throw new Error('Invalid request file');
 await signedIn(client);
 const {data,error}=await client.rpc('get_records_request',{p_id:requestId});if(error)throw error;
 const detail=data as RequestDetail;
 const file=detail?.status==='ok'?detail.files.find(file=>file.id===fileId):undefined;
 if(!file||file.is_private&&!detail.can_manage||!file.storage_path.startsWith(requestId+'/'))throw new Error('This file is unavailable or access is no longer permitted.');
 const result=await client.storage.from(REQUEST_BUCKET).createSignedUrl(file.storage_path,60,{download:file.file_name});if(result.error)throw result.error;
 const base=new URL(origin),url=new URL(result.data.signedUrl,base);
 if(url.origin!==base.origin||!url.pathname.startsWith(`/storage/v1/object/sign/${REQUEST_BUCKET}/`))throw new Error('Invalid download URL');
 return {url:url.href,name:file.file_name};
}

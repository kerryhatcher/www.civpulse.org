import {getPublicRequests} from './request-build-data';
import {fetchOrganizations} from './organizations';
import {requestDirectoryRow,type RequestDirectory} from './request-snapshot';
async function loadAssets() {
 const [details,organizations]=await Promise.all([getPublicRequests(),fetchOrganizations()]);
 const directory:RequestDirectory={version:1,requests:details.map(requestDirectoryRow),organizations:organizations.map(o=>({id:o.id,name:o.name}))};
 const assets:{path:string;body:string}[]=[];
 async function add(kind:string,value:unknown) {
  const body=JSON.stringify(value),bytes=new TextEncoder().encode(body);
  if(bytes.length>20*1024*1024)throw new Error('Public request asset exceeds safe static size');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const path=`requests-${kind}-${hash}.json`;assets.push({path,body});return `/directory-data/${path}`;
 }
 return {assets,details:new Map(details.map(detail=>[detail.request.id,detail])),directoryUrl:await add('directory',directory),indexUrl:await add('index',details.map(d=>d.request.id).sort())};
}
let assets:ReturnType<typeof loadAssets>|undefined;let refreshAfter=0;
export function getRequestAssets(){if(import.meta.env.DEV&&Date.now()>=refreshAfter){assets=undefined;refreshAfter=Date.now()+30000;}return assets??=loadAssets();}

import {getBuildSupabase} from './supabase-build';
import type {OfficeholderObservation} from './officeholder-observations';
let snapshot:Promise<OfficeholderObservation[]>|undefined;
export async function publicOfficeholderObservations(personId?:string,organizationId?:string){
 const load=async()=>{const api=getBuildSupabase();if(!api)return [];const rows:OfficeholderObservation[]=[];let expected:number|undefined;
 for(let offset=0;;offset+=100){const {data,error}=await api.rpc('export_public_officeholder_observations',{p_offset:offset,p_limit:100});if(error)throw error;
 if(expected===undefined)expected=data.total;if(data.total!==expected||!Array.isArray(data.rows)||data.rows.length!==Math.min(100,expected!-offset))throw Error('Incomplete/changing officeholder observation export');
 rows.push(...data.rows);if(rows.length===expected)break;}
 return rows;};
 // Production builds share in-flight reads. Dev refreshes on each request.
 const rows=await (import.meta.env.DEV?load():(snapshot??=load()));
 return rows.filter(r=>(!personId||(r.payload as any).person_id===personId)&&(!organizationId||(r.payload as any).organization_id===organizationId))
 .sort((a,b)=>(b.payload.as_of??'').localeCompare(a.payload.as_of??'')||a.id.localeCompare(b.id)).slice(0,50);
}

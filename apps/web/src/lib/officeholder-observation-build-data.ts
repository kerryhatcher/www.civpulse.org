import {getBuildSupabase} from './supabase-build';
import {observationMatches,type OfficeholderObservation} from './officeholder-observations';
let snapshot:Promise<OfficeholderObservation[]>|undefined;
export async function collectOfficeholderObservations(api:NonNullable<ReturnType<typeof getBuildSupabase>>){const rows:OfficeholderObservation[]=[];let expected:number|undefined,token:string|undefined;
 for(let offset=0;;offset+=100){const {data,error}=await api.rpc('export_public_officeholder_observations',{p_offset:offset,p_limit:100});if(error)throw error;
 if(expected===undefined){expected=data.total;token=data.snapshot;}if(typeof token!=='string'||data.snapshot!==token)throw Error('Changing officeholder observation snapshot');if(data.total!==expected||!Array.isArray(data.rows)||data.rows.length!==Math.min(100,expected!-offset))throw Error('Incomplete/changing officeholder observation export');
 rows.push(...data.rows);if(rows.length===expected)break;}
 return rows;
}
export async function publicOfficeholderObservations(personId?:string,organizationId?:string){
 const load=async()=>{const api=getBuildSupabase();return api?collectOfficeholderObservations(api):[];};
 // Production builds share in-flight reads. Dev refreshes on each request.
 const rows=await (import.meta.env.DEV?load():(snapshot??=load()));
 return rows.filter(r=>observationMatches(r,personId,organizationId))
 .sort((a,b)=>(b.payload.as_of??'').localeCompare(a.payload.as_of??'')||a.id.localeCompare(b.id)).slice(0,50);
}

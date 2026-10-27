import type {SupabaseClient} from '@supabase/supabase-js';

export const isStatementTimeout = (error: {code?:string;message:string}|null) =>
  error?.code === '57014' && /statement timeout/i.test(error.message);

/** Only stable, public build reads; never retry authorization failures or writes. */
export async function readBuildRpc(client:SupabaseClient, name:'export_public_legislation_page'|'export_public_profile_rows', args:Record<string,unknown>) {
  for(let attempt=0;;attempt++) {
    const result=await client.rpc(name,args);
    if(!isStatementTimeout(result.error)||attempt>=2) return result;
    console.warn(`Public build read retry: ${name}, offset ${args.p_offset ?? 0}, statement timeout (${attempt+1}/2)`);
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
}

/** A heavy 500-row profile projection can be split without raising its timeout.
 * Keep the same ordered range, caller and RPC gates. Short pages still signal EOF. */
export async function readPublicProfileBuildPage(client:SupabaseClient, section:string, offset:number) {
  const result=await client.rpc('export_public_profile_rows',{p_section:section,p_offset:offset,p_limit:500});
  if(!isStatementTimeout(result.error)) return result;
  console.warn(`Public profile build: ${section}, offset ${offset}, splitting timed-out 500-row page into 100-row reads`);
  const rows:unknown[]=[];
  for(let part=0;part<500;part+=100) {
    const page=await readBuildRpc(client,'export_public_profile_rows',{p_section:section,p_offset:offset+part,p_limit:100});
    if(page.error) return page;
    if(!Array.isArray(page.data)||page.data.length>100) throw new Error(`Invalid public profile export (${section})`);
    rows.push(...page.data);
    if(page.data.length<100) break;
  }
  return {data:rows,error:null};
}

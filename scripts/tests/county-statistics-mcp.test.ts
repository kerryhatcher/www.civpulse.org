import {test,expect} from 'bun:test';
import {Client} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {InMemoryTransport} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
import {buildServer} from '../../apps/mcp/src/tools';
import {createClient} from '../../apps/web/node_modules/@supabase/supabase-js';
const enabled=process.env.COUNTY_STATISTICS_MCP_INTEGRATION==='1';
test.skipIf(!enabled)('both MCP catalogs discover and search official statistics; compact admin saves reject stale data',async()=>{
 const env=await Bun.file('apps/web/.env.local').text();
 const read=(key:string)=>env.match(new RegExp(`^${key}=["']?([^"'\\n]+)`,'m'))?.[1];
 const url=read('PUBLIC_SUPABASE_URL')!,key=read('PUBLIC_SUPABASE_ANON_KEY')!;
 if(!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Integration requires loopback database');
 const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error}=await admin.auth.signInWithPassword({email:'test@civpulse.org',password:'civicpulse-test-123',options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'}});if(error)throw error;
 for(const catalog of ['legacy','compact'] as const){
  const server=buildServer(anon,{id:crypto.randomUUID()}, {},undefined,catalog),client=new Client({name:'county-statistics-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
  try{await server.connect(a);await client.connect(b);
   const tools=(await client.listTools()).tools;expect(tools.length).toBeLessThanOrEqual(128);
   const c=await client.callTool({name:'search_site',arguments:{type:'county_statistic_catalog'}});expect(c.isError).not.toBe(true);const data=JSON.parse((c.content as any)[0].text);expect(data.county_geographies).toHaveLength(160);expect(data.county_statistic_indicators).toHaveLength(59);
   const r=await client.callTool({name:'search_site',arguments:{type:'county_statistic',query:'Bibb household income'}});expect(r.isError).not.toBe(true);const payload=JSON.parse((r.content as any)[0].text);expect(payload.total_count).toBe(1);expect(payload.results[0].value).toBe(51234);expect(payload.results[0].source_url).toContain('census.gov');
   if(catalog==='compact'){const filtered=await client.callTool({name:'search_county_statistics',arguments:{county_fips:'13121',topic:'age',limit:25}});expect(JSON.parse((filtered.content as any)[0].text).results).toHaveLength(18);
    const rejected=await client.callTool({name:'save_county_statistic_source',arguments:{id:'unauthorized',publisher:'Census',title:'Source',source_url:'https://example.test/',retrieved_on:'2026-11-01',sha256:'a'.repeat(64)}});expect(rejected.isError).toBe(true);}
  }finally{await client.close();await server.close();}
 }
 const server=buildServer(admin,auth.user!,{},undefined,'compact'),client=new Client({name:'county-statistic-admin-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{await server.connect(a);await client.connect(b);const {data:row,error}=await admin.from('county_statistics').select('*').eq('county_fips','13021').eq('indicator_code','PST045225').single();if(error)throw error;
  const {updated_at,...values}=row;const args={...values,expected_updated_at:updated_at};
  const saved=await client.callTool({name:'save_county_statistic',arguments:args});expect(saved.isError).not.toBe(true);
  const stale=await client.callTool({name:'save_county_statistic',arguments:args});expect(stale.isError).toBe(true);expect((stale.content as any)[0].text).toContain('changed');
 }finally{await client.close();await server.close();await admin.auth.signOut();}
},60000);

import {expect,test} from 'bun:test';
import {SQL} from 'bun';
import {createClient} from '../../apps/mcp/node_modules/@supabase/supabase-js';
import {Client} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import {handleRequest} from '../../apps/mcp/src/index';
import {fixture} from './fixtures/structured-turnout';

test.skipIf(process.env.ELECTION_RESULTS_INTEGRATION!=='1')('structured turnout through real Auth/MCP: atomic full import, concurrency, corrections and public readback',async()=>{
 const env=await Bun.file('apps/web/.env.local').text();const anon=/^PUBLIC_SUPABASE_ANON_KEY=["']?([^"'\n]+)/m.exec(env)![1];
 const url='http://127.0.0.1:54321';const db=new SQL('postgres://postgres:postgres@127.0.0.1:54322/postgres');
 const api=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await api.auth.signInWithPassword({email:'test@civpulse.org',password:'civicpulse-test-123',options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'}});if(login.error)throw login.error;
 const token=login.data.session!.access_token;const issuer=JSON.parse(atob(token.split('.')[1])).iss;
 const client=new Client({name:'structured-turnout-qa',version:'1'});
 await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:8789/mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`}},fetch:(input,init)=>handleRequest(new Request(input,init),{SUPABASE_URL:url,SUPABASE_ANON_KEY:anon,AUTHORIZATION_SERVER:issuer,MCP_RESOURCE_URL:'http://localhost:8789/mcp'})}));
 const call=async(operation:any)=>{const r:any=await client.callTool({name:'manage_election_results',arguments:{operation}});if(r.isError)throw new Error(r.content[0].text);return JSON.parse(r.content[0].text);};
 const id=crypto.randomUUID();
 try{
  await db`insert into public.elections(id,slug,name,election_date) values (${id},${`qa-${id}`},'Synthetic structured turnout integration','2026-11-03')`;
  const data=process.env.TURNOUT_PREPARED_JSON?await Bun.file(process.env.TURNOUT_PREPARED_JSON).json():fixture(id);data.election_id=id;
  const args=(d:any,previous:string|null=null,dry=true)=>{const document=JSON.stringify(d);return {action:'import_turnout',document,sha256:new Bun.CryptoHasher('sha256').update(document).digest('hex'),expected_report_id:previous,dry_run:dry};};
  expect((await call(args(data))).status).toBe('validated');
  expect((await call({action:'read_turnout',election_id:id})).status).toBe('empty');
  const duplicates=await Promise.all([call(args(data,null,false)),call(args(data,null,false))]);expect(duplicates.map(r=>r.status).sort()).toEqual(['duplicate','saved']);
  const report=duplicates[0].report_id;expect(duplicates[1].report_id).toBe(report);
  const rows:any[]=[];for(let offset=0;offset<636;offset+=100)rows.push(...(await call({action:'read_turnout',election_id:id,report_id:report,offset})).rows);
  expect(rows).toHaveLength(636);expect(new Set(rows.map(r=>r.county_fips)).size).toBe(159);
  const next=structuredClone(data);next.captured_at='2026-10-27T00:20:37Z';for(const t of next.tables){t.as_of=null;t.as_of_label='';}
  // Synthetic fixture has unknown source times: correction order uses collection time.
  if(!process.env.TURNOUT_PREPARED_JSON){next.tables[0].rows[0].measures.accepted.value=99;
   const races=await Promise.allSettled([call(args(next,report,false)),call(args({...next,capture_run_id:crypto.randomUUID(),captured_at:'2026-10-27T00:21:37Z',tables:next.tables.map((t:any,i:number)=>i? t:{...t,rows:t.rows.slice(1)})},report,false))]);
   expect(races.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(races.filter(r=>r.status==='rejected')).toHaveLength(1);
  }
  const publicApi=createClient(url,anon,{auth:{persistSession:false}});
  const read=await publicApi.rpc('get_structured_turnout',{p_election_id:id,p_report_id:report});expect(read.error).toBeNull();expect(read.data.total).toBe(636);expect(read.data.report.created_by).toBeUndefined();
  expect((await publicApi.rpc('import_structured_turnout',{p_document:JSON.stringify(data),p_sha256:'a'.repeat(64)})).error).not.toBeNull();
 }finally{
  await db`delete from public.structured_turnout_reports where election_id=${id}`;await db`delete from public.elections where id=${id}`;
  await client.close();await api.auth.signOut();await db.close();
 }
},60000);

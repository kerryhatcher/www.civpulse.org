import {expect,test} from 'bun:test';
import {SQL} from 'bun';
import {createClient} from '../../apps/mcp/node_modules/@supabase/supabase-js';
import {Client} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import {handleRequest} from '../../apps/mcp/src/index';
const enabled=process.env.ELECTION_RESULTS_INTEGRATION==='1';
test.skipIf(!enabled)('real MCP, Auth, Storage, concurrent duplicates and April photo replay',async()=>{
 const env=await Bun.file('apps/web/.env.local').text();const anon=/^PUBLIC_SUPABASE_ANON_KEY=["']?([^"'\n]+)/m.exec(env)![1];
 const url='http://127.0.0.1:54321';const sql=new SQL('postgres://postgres:postgres@127.0.0.1:54322/postgres');
 const api=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await api.auth.signInWithPassword({email:'test@civpulse.org',password:'civicpulse-test-123',options:{captchaToken:'XXXX.DUMMY.TOKEN.XXXX'}});if(login.error)throw login.error;
 const token=login.data.session!.access_token;const issuer=JSON.parse(atob(token.split('.')[1])).iss;
 const client=new Client({name:'election-results-qa',version:'1'});
 await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:8789/mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`}},fetch:(input,init)=>handleRequest(new Request(input,init),{SUPABASE_URL:url,SUPABASE_ANON_KEY:anon,AUTHORIZATION_SERVER:issuer,MCP_RESOURCE_URL:'http://localhost:8789/mcp'})}));
 const call=async(operation:any)=>{const r:any=await client.callTool({name:'manage_election_results',arguments:{operation}});if(r.isError)throw new Error(r.content[0].text);return JSON.parse(r.content[0].text);};
 const id=crypto.randomUUID();let contest='',people:string[]=[];const paths:string[]=[];
 try{
  await sql`insert into public.elections(id,slug,name,election_date) values (${id},${`result-qa-${id}`},'QA April source replay','2026-04-14')`;
  contest=(await sql`insert into public.contests(election_id,office) values (${id},'County Commissioner') returning id`)[0].id;
  for(const name of ['Andrea C. Cooke','Edward C. Foster']){const p=crypto.randomUUID();await sql`insert into public.people(id,slug,full_name) values (${p},${`qa-${p}`},${name})`;await sql`insert into public.contest_candidates(contest_id,person_id) values (${contest},${p})`;people.push(p);}
  const imageRoot=process.env.ELECTION_PHOTO_ROOT;
  const bytes=imageRoot?new Uint8Array(await Bun.file(`${imageRoot}/8-Photo-8.jpg`).arrayBuffer()):new TextEncoder().encode(`%PDF-1.7\nSynthetic QA source ${id}\nApril 14 2026 300 ballots`);
  const upload={action:'upload',mime_type:imageRoot?'image/jpeg':'application/pdf',base64:Buffer.from(bytes).toString('base64')};
  const first=await call(upload);paths.push(first.path);expect((await call(upload)).duplicate).toBe(true);
  const view=await call({action:'view',path:first.path});const fetched=await fetch(view.signedUrl);expect(fetched.ok).toBe(true);expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(bytes);
  const args={action:'import',election_id:id,scope:{county:'Bibb',unit_type:'county',unit:'all',counting_group:'all',ballot_style:'all'},observed_at:'2026-04-14T19:27:28-04:00',snapshot:{election_date:'2026-04-14',status:'unofficial',turnout:{ballots:300,voters:300,registered:17944,precincts_reported:6,precincts_total:31},contests:[{contest_id:contest,choices:[{person_id:people[0],label:'Andrea C. Cooke',votes:203},{person_id:people[1],label:'Edward C. Foster',votes:97}],total_votes:300,ballots:300,registered:10298,precincts_reported:6,precincts_total:6}]},sources:[{path:first.path,locator:'Photo 8, page 1',transcription:'April 14, 2026 7:27:28 PM; ballots 300; Cooke 203; Foster 97.'}]};
  expect((await call(args)).status).toBe('validated');expect((await call({action:'read',election_id:id})).reports).toHaveLength(0);
  const results=await Promise.all([call({...args,dry_run:false}),call({...args,dry_run:false})]);expect(results.map(r=>r.status).sort()).toEqual(['duplicate','saved']);
  expect(results[0].report_id).toBe(results[1].report_id);
  if(imageRoot){const second=await call({action:'upload',mime_type:'image/jpeg',base64:Buffer.from(await Bun.file(`${imageRoot}/9-Photo-9.jpg`).arrayBuffer()).toString('base64')});paths.push(second.path);expect(second.path).not.toBe(first.path);expect((await call({...args,sources:[{...args.sources[0],path:second.path,locator:'Photo 9, same report'}],dry_run:false})).status).toBe('duplicate');}
  const changed=structuredClone(args);changed.observed_at='2026-04-14T20:00:00-04:00';changed.snapshot.turnout.ballots=301;
  const revision=await call({...changed,dry_run:false,expected_report_id:results[0].report_id});expect(revision.status).toBe('saved');
  expect((await call({action:'read',election_id:id})).reports).toHaveLength(1);expect((await call({action:'read',election_id:id,history:true})).reports).toHaveLength(2);
  const anonymous=createClient(url,anon,{auth:{persistSession:false}});
  const publicResult=await anonymous.rpc('get_election_results',{p_election_id:id});expect(publicResult.error).toBeNull();expect(publicResult.data.reports[0].sources).toBeNull();
  expect((await anonymous.storage.from('election-evidence').download(first.path)).error).not.toBeNull();
 }finally{
  await sql`delete from public.election_result_reports where election_id=${id}`;await sql`delete from public.elections where id=${id}`;
  for(const p of people)await sql`delete from public.people where id=${p}`;
  // Content-addressed originals may be shared with another local test; retain them.
  await client.close();await api.auth.signOut();await sql.close();
 }
},60000);

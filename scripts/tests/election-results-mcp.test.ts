import {expect,test} from 'bun:test';
import {registerElectionResultTools} from '../../apps/mcp/src/election-result-tools';
function setup(admin=true){let handler:any,schema:any;const calls:any[]=[];registerElectionResultTools({registerTool(_n:string,s:any,h:any){schema=s;handler=h;}} as never,{rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:name==='is_admin'?admin:{status:'validated'},error:null};}} as never);return {calls,schema,call:(operation:any)=>handler(schema.inputSchema.parse({operation}))};}
const id='10000000-0000-4000-8000-000000000001';
const operation={action:'import',election_id:id,scope:{county:'Bibb',unit_type:'county',unit:'all',counting_group:'all',ballot_style:'all'},observed_at:'2026-04-14T19:27:28-04:00',snapshot:{election_date:'2026-04-14',status:'unofficial',turnout:{ballots:300},contests:[]},sources:[{path:'a'.repeat(64)+'.jpg',locator:'page 1',transcription:'300 ballots'}]};
test('MCP import defaults to dry run and forwards explicit predecessor',async()=>{const s=setup();await s.call(operation);expect(s.calls.at(-1)[1]).toMatchObject({p_dry_run:true,p_expected_report_id:null});await s.call({...operation,expected_report_id:id,dry_run:false});expect(s.calls.at(-1)[1]).toMatchObject({p_dry_run:false,p_expected_report_id:id});});
test('all evidence/report operations enforce admin and discriminate required inputs',async()=>{const s=setup(false);for(const o of [operation,{action:'read',election_id:id},{action:'view',path:'a'.repeat(64)+'.jpg'},{action:'upload',base64:'/9j/',mime_type:'image/jpeg'}])expect((await s.call(o)).isError).toBe(true);expect(s.calls.every(c=>c[0]==='is_admin')).toBe(true);expect(()=>s.call({action:'import'})).toThrow();expect(()=>s.call({...operation,snapshot:{...operation.snapshot,turnout:{ballots:-1}}})).toThrow();});
test('read pages and history are forwarded',async()=>{const s=setup();await s.call({action:'read',election_id:id,history:true,offset:50,limit:20});expect(s.calls.at(-1)).toEqual(['get_election_results',{p_election_id:id,p_history:true,p_offset:50,p_limit:20}]);});

test('structured JSON import and read share the admin tool without widening photo uploads',async()=>{
 const {fixture}=await import('./fixtures/structured-turnout');
 const doc=JSON.stringify(fixture(id));const sha=new Bun.CryptoHasher('sha256').update(doc).digest('hex');
 const s=setup();await s.call({action:'import_turnout',document:doc,sha256:sha});
 expect(s.calls.at(-1)).toEqual(['import_structured_turnout',{p_document:doc,p_sha256:sha,p_expected_report_id:null,p_dry_run:true}]);
 expect((await s.call({action:'import_turnout',document:doc,sha256:'b'.repeat(64)})).isError).toBe(true);
 await s.call({action:'read_turnout',election_id:id});expect(s.calls.at(-1)[0]).toBe('get_structured_turnout');
 expect((await setup(false).call({action:'import_turnout',document:doc,sha256:sha})).isError).toBe(true);
 expect(()=>s.call({action:'upload',mime_type:'application/json',base64:'e30='})).toThrow();
});

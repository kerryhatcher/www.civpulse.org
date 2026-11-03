import {expect,test} from 'bun:test';import {buildServer} from '../../apps/mcp/src/tools';
import {Client} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {InMemoryTransport} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
const id='00000000-0000-4000-8000-000000000001';
test('compact cited-outcome tool validates citations, retains conflict results and enforces admin guard',async()=>{
 for(const admin of [true,false]){
  const calls:any[]=[];const api:any={rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:name==='is_admin'?admin:{status:'conflict',current_observation_id:id},error:null};}};
  const server=buildServer(api,{id},{},undefined,'compact'),client=new Client({name:'outcomes-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
  try{
   await server.connect(a);await client.connect(b);
   const tools=(await client.listTools()).tools;expect(tools).toHaveLength(75);const tool=tools.find(t=>t.name==='set_meeting_vote_outcome')!;expect(tool.annotations).toMatchObject({readOnlyHint:false,idempotentHint:true});
   const input={vote_id:id,outcome:'passed',source_url:'https://example.test/minutes.pdf',document_sha256:'a'.repeat(64),locator:'Page 3',supersedes_id:id,correction_reason:'Correct motion cited'};
   const result:any=await client.callTool({name:'set_meeting_vote_outcome',arguments:input});
   expect(Boolean(result.isError)).toBe(!admin);
   if(admin){expect(JSON.parse(result.content[0].text).status).toBe('conflict');expect(calls.at(-1)).toEqual(['set_meeting_vote_outcome',{p_vote_id:id,p_outcome:'passed',p_source_url:input.source_url,p_document_sha256:input.document_sha256,p_locator:input.locator,p_supersedes_id:id,p_correction_reason:input.correction_reason}]);}
   else expect(calls).toEqual([['is_admin',undefined]]);
   calls.length=0;
   for(const invalid of [{...input,source_url:'http://example.test'},{...input,document_sha256:'bad'},{...input,locator:' \t '},{...input,outcome:'guessed'}, {vote_id:id,outcome:'passed'}])expect((await client.callTool({name:'set_meeting_vote_outcome',arguments:invalid})).isError).toBe(true);
   expect(calls).toHaveLength(0);
  }finally{await client.close();await server.close();}
 }
 const legacy=buildServer({} as any,{id}),client=new Client({name:'compat-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{await legacy.connect(a);await client.connect(b);const tools=(await client.listTools()).tools;expect(tools).toHaveLength(128);expect(tools.some(t=>t.name==='set_meeting_vote_outcome')).toBe(false);}finally{await client.close();await legacy.close();}
});

import {expect,test} from 'bun:test';
import {buildServer} from '../../apps/mcp/src/tools';
import {Client} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {InMemoryTransport} from '../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
const id='00000000-0000-4000-8000-000000000001';
test('service-fee MCP wrappers preserve read filters, write mapping and admin guard',async()=>{
 for(const admin of [true,false]){
 const calls:any[]=[];const api:any={rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:name==='is_admin'?admin:{status:'ok'},error:null};}};
 const server=buildServer(api,{id},{},undefined,'compact'),client=new Client({name:'service-fee-wrappers',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{await server.connect(a);await client.connect(b);
 expect((await client.callTool({name:'browse_service_fees',arguments:{recipient_kind:'person',query:'exact',history:true,offset:100,limit:25}})).isError).not.toBe(true);
 expect(calls.at(-1)).toEqual(['browse_service_fees',{p_organization_id:null,p_year:null,p_query:'exact',p_recipient_kind:'person',p_recipient_id:null,p_observation_id:null,p_history:true,p_offset:100,p_limit:25}]);
 const input={version:1,provider:'synthetic',report:{source_key:'report'},rows:[{source_key:'row'}]};calls.length=0;
 expect(Boolean((await client.callTool({name:'accept_service_fee_report',arguments:input})).isError)).toBe(!admin);
 if(admin)expect(calls.at(-1)).toEqual(['accept_service_fee_report',{p_version:1,p_provider:'synthetic',p_report:input.report,p_rows:input.rows,p_dry_run:true}]);else expect(calls).toEqual([['is_admin',undefined]]);
 calls.length=0;expect((await client.callTool({name:'browse_service_fees',arguments:{recipient_kind:'guessed'}})).isError).toBe(true);expect(calls).toHaveLength(0);
 }finally{await client.close();await server.close();}
 }
});

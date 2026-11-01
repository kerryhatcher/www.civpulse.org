import { expect, test } from 'bun:test';
import { registerSchoolFinanceTools } from '../../apps/mcp/src/school-finance-tools';
function setup(admin=true) {
 const tools=new Map<string,any>(),calls:any[]=[];
 registerSchoolFinanceTools({registerTool(name:string,schema:any,handler:any){tools.set(name,{schema,handler})}} as never,{rpc:async(name:string,args:any)=>{calls.push([name,args]);return{data:name==='is_admin'?admin:{status:'staging'},error:null}}} as never);
 return{calls,run:async(name:string,input:any)=>{const t=tools.get(name);return t.handler(t.schema.inputSchema.parse(input));},tools};
}
test('finance MCP projections forward filters and exact staged payloads',async()=>{
 const s=setup();await s.run('school_finances',{operation:{action:'browse',dataset:'payroll',query:'teacher'}});
 expect(s.calls.at(-1)).toEqual(['browse_school_finances',{p_dataset:'payroll',p_year:null,p_query:'teacher',p_offset:0,p_limit:50,p_sort:'amount',p_person_id:null}]);
 const payload={release_id:'10000000-0000-4000-8000-000000000001',rows:[{amount:'3688.1800000000003'}]};
 await s.run('school_finances',{operation:{action:'append',payload}});expect(s.calls.at(-1)).toEqual(['manage_school_finances',{p_action:'append',p_payload:payload}]);
 expect(s.tools.get('school_finances').schema.annotations.readOnlyHint).toBe(false);
});
test('finance mutations enforce admin; read remains available to ordinary callers',async()=>{
 const s=setup(false);const result=await s.run('school_finances',{operation:{action:'publish',payload:{}}});expect(result.isError).toBe(true);expect(s.calls).toEqual([['is_admin',undefined]]);
 await s.run('school_finances',{operation:{action:'browse'}});expect(s.calls.at(-1)[0]).toBe('browse_school_finances');
 expect(()=>s.tools.get('school_finances').schema.inputSchema.parse({operation:{action:'browse',limit:501}})).toThrow();
});

test('new school-finance operations are discoverable only in v2 without exceeding compatibility capacity',async()=>{
 const {buildServer}=await import('../../apps/mcp/src/tools');
 const {Client}=await import('../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
 const {InMemoryTransport}=await import('../../apps/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js');
 for(const catalog of ['legacy','compact'] as const){
  const server=buildServer({} as never,{id:crypto.randomUUID()},{},undefined,catalog),client=new Client({name:'finance-test',version:'1'});
  const[a,b]=InMemoryTransport.createLinkedPair();
  try{await server.connect(a);await client.connect(b);const tools=(await client.listTools()).tools;expect(tools.length).toBeLessThanOrEqual(128);expect(tools.some(t=>t.name==='school_finances')).toBe(catalog==='compact');}finally{await client.close();await server.close()}
 }
});

import { expect, test } from "bun:test";
import {
  registerLegislativeTools,
  legislativeInputSchema,
} from "../../apps/mcp/src/legislative-tools";

test("legislative tools forward filters and require admin for normalized imports", async () => {
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const schemas = new Map<string, any>();
  const calls: any[] = [];
  let admin = false;
  const client = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      return {
        data: name === "is_admin" ? admin : { rows: [], total: 0 },
        error: null,
      };
    },
  };
  registerLegislativeTools(
    {
      registerTool: (name: string, schema: unknown, handler: any) => {
        expect(handlers.has(name)).toBe(false);
        handlers.set(name, handler);
        schemas.set(name, schema);
      },
    } as never,
    client as never,
  );
  const id = "00000000-0000-4000-8000-000000000001";
  const input = schemas
    .get("browse_legislation")
    .inputSchema.parse({ table: "bills", id, bill_id: id, query: "HB 1" });
  await handlers.get("browse_legislation")!(input);
  expect(calls.at(-1)).toEqual({
    name: "browse_legislation",
    args: {
      p_table: "bills",
      p_id: id,
      p_filters: {},
      p_query: "HB 1",
      p_limit: 25,
      p_offset: 0,
      p_bill_id: id,
      p_person_id: null,
      p_vote_id: null,
    },
  });
  const result = await handlers.get("import_legislation")!({ records: [] });
  expect(result.isError).toBe(true);
  expect(calls.at(-1).name).toBe("is_admin");
  expect(() =>
    legislativeInputSchema("legislative_vote_choices").parse({
      vote_id: id,
      office_term_id: id,
      choice: "guessed",
      source_choice: "Unknown",
    }),
  ).toThrow();
  expect(schemas.get("import_legislation").annotations.idempotentHint).toBe(
    true,
  );
});

test('legislative bundles enforce admin access and stop at a resumable batch boundary', async () => {
 const handlers=new Map<string,(input:any)=>Promise<any>>();const schemas=new Map<string,any>();
 let admin=true;let failAt=2;const batches:any[][]=[];
 registerLegislativeTools({registerTool:(name:string,schema:any,handler:any)=>{handlers.set(name,handler);schemas.set(name,schema);}} as never,
  {rpc:async(name:string,args:any)=>{if(name==='is_admin')return {data:admin,error:null};const batch=args.p_records;batches.push(batch);return batches.length===failAt?{data:null,error:{message:'Source identity conflict'}}:{data:batch.map((r:any)=>({table:r.table,id:r.data.id})),error:null};}} as never);
 const records=Array.from({length:250},(_,n)=>({table:'bill_actions',data:{source_system:'qa',source_id:String(n)}}));
 const parse=(input:any)=>schemas.get('import_legislation').inputSchema.parse({mode:'batched',...input});
 const handler=handlers.get('import_legislation')!;
 const deniedHandlers=new Map<string,(input:any)=>Promise<any>>();
 registerLegislativeTools({registerTool:(name:string,_schema:any,fn:any)=>deniedHandlers.set(name,fn)} as never,{rpc:async()=>({data:false,error:null})} as never);
 expect((await deniedHandlers.get('import_legislation')!(parse({records}))).isError).toBe(true);expect(batches).toHaveLength(0);
 const partial=JSON.parse((await handler(parse({records}))).content[0].text);
 expect(partial).toMatchObject({status:'partial',imported_count:100,next_offset:100,total:250});
 expect(batches.map(b=>b.length)).toEqual([100,100]);
 failAt=-1;batches.length=0;
 const complete=JSON.parse((await handler(parse({records,start_offset:100}))).content[0].text);
 expect(complete).toMatchObject({status:'complete',imported_count:150,next_offset:250,total:250});
 expect(batches.map(b=>b.length)).toEqual([100,50]);expect(batches[0][0].data.source_id).toBe('100');
 batches.length=0;
 expect((await handler(parse({records,start_offset:251}))).isError).toBe(true);expect(batches).toHaveLength(0);
 expect((await handler(parse({records:[{table:'bills',data:{source_system:'qa',source_id:'large',summary:'x'.repeat(2_000_000)}}]}))).isError).toBe(true);
 expect(batches).toHaveLength(0);
 expect(()=>parse({records:Array.from({length:1001},()=>records[0])})).toThrow();
 expect(()=>parse({records:[{table:'admins',data:{}}]})).toThrow();
 expect(schemas.get('import_legislation').annotations.idempotentHint).toBe(true);
});

test('legislative imports retain atomic defaults and reject implicit multi-batch writes', async () => {
 const handlers=new Map<string,any>();const schemas=new Map<string,any>();const calls:any[]=[];
 registerLegislativeTools({registerTool:(name:string,schema:any,handler:any)=>{handlers.set(name,handler);schemas.set(name,schema);}} as never,
 {rpc:async(name:string,args:any)=>{if(name==='is_admin')return {data:true,error:null};calls.push(args);return {data:{original_response:true},error:null};}} as never);
 const parse=(input:any)=>schemas.get('import_legislation').inputSchema.parse(input);
 const run=handlers.get('import_legislation');const row={table:'bills',data:{source_system:'qa',source_id:'one'}};
 expect(JSON.parse((await run(parse({records:[row]}))).content[0].text)).toEqual({original_response:true});
 expect(calls).toHaveLength(1);
 expect((await run(parse({records:Array(101).fill(row)}))).isError).toBe(true);
 expect((await run(parse({records:[row],start_offset:1}))).isError).toBe(true);
 expect(calls).toHaveLength(1);
});

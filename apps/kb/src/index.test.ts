import {afterEach,expect,spyOn,test} from 'bun:test';
import {handle,type RuntimeEnv} from './index';

const meeting='00000000-0000-4000-8000-000000000001';
const attachment='00000000-0000-4000-8000-000000000002';
const id='00000000-0000-4000-8000-000000000003';
const key=`documents/${id}/${'a'.repeat(64)}.txt`;
const record={id,title:'Test agenda',file_name:'test.txt',object_key:key,mime_type:'text/plain',size_bytes:4,
  source_url:'https://example.test/agenda',document_kind:'agenda',text_origin:'official',status:'published',published_at:null,meetings:[]};
const published: string[]=[]; const deleted: string[]=[]; const calls:string[]=[];
let admin=true;let ready=true;let stale=false;let allowed=true;let lostFinish=false;let finalizing=false;let storageRedirect=false;
let fetchMock:ReturnType<typeof spyOn>|undefined;
afterEach(()=>{fetchMock?.mockRestore();published.length=0;deleted.length=0;calls.length=0;admin=true;ready=true;stale=false;allowed=true;lostFinish=false;finalizing=false;storageRedirect=false;});
function env(overrides:Partial<RuntimeEnv>={}):RuntimeEnv {
  return {
    SUPABASE_URL:'https://db.example.test',SUPABASE_ANON_KEY:'public-test-key',
    PUBLIC_DOCUMENT_ORIGIN:'https://kb.civpulse.org',ALLOWED_ORIGINS:'https://www.civpulse.org',
    PUBLICATION_ENABLED:'true',SEARCH_ENABLED:'true',
    PUBLICATION_MEETING_IDS:meeting,
    DOCUMENTS:{put:async(k:string)=>{published.push(k);},delete:async(k:string)=>{deleted.push(k);}},
    SEARCH_LIMITER:{limit:async()=>({success:allowed})},
    SEARCH:{search:async()=>({search_query:'test',chunks:[
      {id:'a',type:'text',score:1,text:'Passage from a meeting',item:{key}},
      {id:'b',type:'text',score:0.9,text:'Another passage',item:{key}},
      {id:'c',type:'text',score:0.9,text:'Untrusted index metadata',item:{key:'https://evil.example/secret'}},
    ]})},...overrides,
  } as RuntimeEnv;
}
function mock(){fetchMock=spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=String(input);calls.push(url);
  if(url.endsWith('/auth/v1/user'))return Response.json({id:meeting});
  if(url.endsWith('/is_admin'))return Response.json(admin);
  if(url.endsWith('/get_meeting'))return Response.json({status:'ok',event:{visibility:ready?'public':'private'},calendar:{visibility:'public'},
    attachments:[{id:attachment,file_name:'test.txt',storage_path:`${meeting}/${attachment}.txt`,mime_type:'text/plain',size_bytes:4}]});
  if(url.includes('/storage/')){expect(init?.redirect).toBe('manual');return storageRedirect?new Response(null,{status:302,headers:{Location:'https://untrusted.example/file'}}):new Response('test');}
  if(url.endsWith('/prepare_public_document'))return Response.json({...record,status:'pending',claim:attachment});
  if(url.endsWith('/finish_public_document')){finalizing=true;if(lostFinish)throw new Error('Connection interrupted');return Response.json(record);}
  if(url.endsWith('/get_public_document')){
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    return Response.json(stale?null:record);
  }
  if(url.endsWith('/withdraw_public_document'))return Response.json({...record,status:'withdrawn'});
  throw new Error(`Unexpected endpoint ${url}`);
});}
function publication(patch:Record<string,unknown>={}){return new Request('https://kb-api.civpulse.org/publish',{
  method:'POST',headers:{Authorization:'Bearer test-user','Content-Type':'application/json'},
  body:JSON.stringify({meeting_id:meeting,attachment_id:attachment,title:'Test agenda',source_url:'https://example.test/agenda',
    document_kind:'agenda',text_origin:'official',confirm_public:true,...patch}),
});}
test('publication is disabled by default and never writes R2',async()=>{
  mock();const response=await handle(publication(),env({PUBLICATION_ENABLED:'false'}));
  expect(response.status).toBe(503);expect(published).toHaveLength(0);
});
test('anonymous and non-admin callers cannot publish',async()=>{
  mock();expect((await handle(new Request('https://kb-api.civpulse.org/publish',{method:'POST'}),env())).status).toBe(401);
  admin=false;expect((await handle(publication(),env())).status).toBe(403);expect(published).toHaveLength(0);
});
test('explicit confirmation and a credential-free HTTPS source are required',async()=>{
  const credentialSource=new URL('https://example.test');credentialSource.username='fixture-user';credentialSource.password='fixture-password';
  mock();for(const patch of [{confirm_public:false},{source_url:'http://example.test'},{source_url:credentialSource.href}]){
    expect((await handle(publication(patch),env())).status).toBe(400);
  }expect(published).toHaveLength(0);
});
test('hidden meetings cannot be copied to the archive',async()=>{
  mock();ready=false;expect((await handle(publication(),env())).status).toBe(400);
  expect(calls.some(c=>c.includes('/storage/'))).toBe(false);expect(published).toHaveLength(0);
});
test('publication is limited to explicitly configured pilot meetings',async()=>{
  mock();const response=await handle(publication(),env({PUBLICATION_MEETING_IDS:''}));
  expect(response.status).toBe(403);expect(published).toHaveLength(0);
  expect(calls.some(c=>c.endsWith('/get_meeting')||c.includes('/storage/'))).toBe(false);
});
test('publishes verified source bytes, then commits the catalog',async()=>{
  mock();const response=await handle(publication(),env());
  expect(response.status).toBe(201);expect(await response.json()).toMatchObject({id,url:`https://kb.civpulse.org/${key}`});
  expect(published).toEqual([key]);expect(finalizing).toBe(true);
});
test('source redirects are rejected without forwarding the caller credential',async()=>{
  mock();storageRedirect=true;
  expect((await handle(publication(),env())).status).toBe(502);
  expect(published).toHaveLength(0);expect(calls.some(c=>c.startsWith('https://untrusted.example'))).toBe(false);
});
test('an interrupted finalization never deletes a possibly committed object',async()=>{
  mock();lostFinish=true;expect((await handle(publication(),env())).status).toBe(503);
  expect(published).toEqual([key]);expect(deleted).toHaveLength(0);
});
test('search groups passages by document and rejects arbitrary index keys',async()=>{
  mock();const response=await handle(new Request('https://kb-api.civpulse.org/search?q=budget'),env());
  const data=await response.json();expect(data.results).toHaveLength(1);expect(data.results[0].passages).toHaveLength(2);
  expect(JSON.stringify(data)).not.toContain('Untrusted');
});
test('stale/withdrawn search passages never leave the API',async()=>{
  mock();stale=true;const response=await handle(new Request('https://kb-api.civpulse.org/search?q=budget'),env());
  expect((await response.json()).results).toHaveLength(0);
});
test('search is rate limited and query length is bounded',async()=>{
  mock();allowed=false;const response=await handle(new Request('https://kb-api.civpulse.org/search?q=budget'),env());
  expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('60');
  expect((await handle(new Request(`https://kb-api.civpulse.org/search?q=${'a'.repeat(501)}`),env())).status).toBe(400);
});
test('withdrawal updates the catalog before removing its R2 object',async()=>{
  mock();expect((await handle(new Request(`https://kb-api.civpulse.org/documents/${id}/withdraw`,{method:'POST',headers:{Authorization:'Bearer test-user'}}),env())).status).toBe(200);
  expect(calls.at(-1)).toEndWith('/withdraw_public_document');expect(deleted).toEqual([key]);
});
test('untrusted browser origins cannot make archive requests',async()=>{
  mock();const request=new Request('https://kb-api.civpulse.org/status',{headers:{Origin:'https://evil.example'}});
  expect((await handle(request,env())).status).toBe(403);expect(calls).toHaveLength(0);
  const trusted=await handle(new Request('https://kb-api.civpulse.org/status',{headers:{Origin:'https://www.civpulse.org'}}),env());
  expect(trusted.status).toBe(200);expect(trusted.headers.get('Access-Control-Allow-Origin')).toBe('https://www.civpulse.org');
});

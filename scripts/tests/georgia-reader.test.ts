import {expect,test} from 'bun:test';
import {handleSourceRequest,parseSourceRequest} from '../../apps/georgia-source/src/index';
import {readGeorgiaSourceViaReader,readGeorgiaSource} from '../../apps/mcp/src/georgia-source';

const input={resource:'vote' as const,vote_id:21003,member_id:4942,limit:1,offset:0};
test('public source reader validates resource parameters before fetching',async()=>{
 let calls=0;const fetcher=(async()=>{calls++;throw Error('unexpected');}) as typeof fetch;
 for(const path of ['/?url=https://example.test','/other?resource=sessions','/?resource=bad','/?resource=vote','/?resource=votes&session_id=1','/?resource=vote&vote_id=-1','/?resource=vote&vote_id=1&limit=101','/?resource=sessions&limit=1&limit=2','/?resource=sessions&offset=1e3']){
  expect((await handleSourceRequest(new Request('https://reader.test'+path),fetcher)).status).toBe(400);
 }
 expect((await handleSourceRequest(new Request('https://reader.test/?resource=sessions',{method:'POST'}),fetcher)).status).toBe(405);
 expect(calls).toBe(0);
 expect(parseSourceRequest(new URL('https://reader.test/?resource=sessions'))).toMatchObject({resource:'sessions',limit:25,offset:0});
});
test('reader preserves provenance and corrected attendance without forwarding caller credentials',async()=>{
 const requests:{url:string;options:RequestInit}[]=[];
 const fetcher=(async(url:string,options:RequestInit)=>{requests.push({url,options});return Response.json(url.includes('authentication/token')?'upstream-token':{session:{id:1031},legislation:[],votes:[{member:{id:4942},memberVoted:0}]});}) as typeof fetch;
 const r=await handleSourceRequest(new Request('https://reader.test/?resource=vote&vote_id=21003&member_id=4942&limit=1',{headers:{Authorization:'Bearer civic-user-token'}}),fetcher);
 expect(r.status).toBe(200);const data=await r.json();expect(data.attendance).toBe(true);expect(data.source_url).toBe('https://www.legis.ga.gov/api/Vote/detail/21003');expect(data.rows[0].source_choice).toBe('Yea');
 expect(requests).toHaveLength(2);expect(requests[0].options.headers).toBeUndefined();expect(requests[1].options.headers).toEqual({Authorization:'Bearer upstream-token'});expect(JSON.stringify(data)).not.toContain('upstream-token');expect(JSON.stringify(requests)).not.toContain('civic-user-token');
});
test('hosted reader transport forwards only source parameters and validates its response',async()=>{
 let called:URL|undefined;
 const data={source_system:'legis.ga.gov',source_url:'https://www.legis.ga.gov/api/Vote/detail/21003',rows:[],total:0,attendance:true};
 const fetcher=(async(url:URL,init:RequestInit)=>{called=url;expect(init.headers).toBeUndefined();expect(init.redirect).toBe('manual');return Response.json(data);}) as typeof fetch;
 expect(await readGeorgiaSourceViaReader(input,'https://reader.test/',fetcher)).toEqual(data);expect(called?.searchParams.get('vote_id')).toBe('21003');expect(called?.searchParams.get('member_id')).toBe('4942');
 await expect(readGeorgiaSourceViaReader(input,'http://reader.test/',fetcher)).rejects.toThrow('configuration');
 await expect(readGeorgiaSourceViaReader(input,'https://reader.test/?token=secret',fetcher)).rejects.toThrow('configuration');
 await expect(readGeorgiaSourceViaReader(input,'https://reader.test/',(async()=>Response.json({rows:[],total:0})) as typeof fetch)).rejects.toThrow('Invalid Georgia');
 await expect(readGeorgiaSourceViaReader(input,'https://reader.test/',(async()=>Response.json({error:'unavailable'},{status:502})) as typeof fetch)).rejects.toThrow('HTTP 502');
 await expect(readGeorgiaSourceViaReader(input,'https://reader.test/',(async()=>new Response('unavailable',{status:502})) as typeof fetch)).rejects.toThrow('HTTP 502');
 await expect(readGeorgiaSourceViaReader(input,'https://reader.test/',(async()=>new Response('invalid json')) as typeof fetch)).rejects.toThrow('Invalid Georgia source reader response');
});
test('redirects are rejected without forwarding tokens; timeout messages identify the stage',async()=>{
 let calls=0;const redirect=(async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://example.test'}});}) as typeof fetch;
 await expect(readGeorgiaSource(input,redirect)).rejects.toThrow('HTTP 302');expect(calls).toBe(1);
 const timeout=(async()=>{throw new DOMException('secret URL','TimeoutError');}) as typeof fetch;
 await expect(readGeorgiaSource(input,timeout)).rejects.toThrow('Georgia handshake request timed out');
 let n=0;const dataTimeout=(async()=>{if(!n++)return Response.json('token');throw new DOMException('secret token','TimeoutError');}) as typeof fetch;
 await expect(readGeorgiaSource(input,dataTimeout)).rejects.toThrow('Georgia data request timed out');
 const response=await handleSourceRequest(new Request('https://reader.test/?resource=vote&vote_id=21003'),timeout);expect(response.status).toBe(502);expect(JSON.stringify(await response.json())).not.toContain('secret');
 const invalid=(async()=>new Response('secret upstream content')) as typeof fetch;
 await expect(readGeorgiaSource(input,invalid)).rejects.toThrow('Invalid Georgia handshake response');
});

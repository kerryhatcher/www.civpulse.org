import {expect,test} from 'bun:test';
import {fetchSosResults,prepareSosResults,itemBatches,refreshSosResults} from '../sos-results';
const url='https://results.sos.ga.gov/cdn/results/Georgia/export-Example.json';
const source=()=>({electionDate:'2026-02-17',electionName:'Example',createdAt:'2026-02-25T19:20:28Z',results:{id:'ga',name:'Georgia',reportingStatuses:[],ballotItems:[{id:'race',name:'Race',ballotOptions:[{id:'choice',voteCount:0,precinctResults:null}],extra:'preserved'}]},localResults:[]});
test('feed preserves zero, missing fields and source identities, rejects wrong election and duplicates',()=>{
 const feed=source(),result=prepareSosResults(JSON.stringify(feed),'2026-02-17');
 expect(result.items[0].data).toEqual(feed.results.ballotItems[0]);
 expect(result.jurisdictions[0]).toMatchObject({id:'ga',item_count:1});
 expect([...itemBatches(result.items)]).toHaveLength(1);
 expect(()=>prepareSosResults(JSON.stringify(feed),'2026-11-03')).toThrow('identity');
 feed.results.ballotItems.push(feed.results.ballotItems[0]);
 expect(()=>prepareSosResults(JSON.stringify(feed),'2026-02-17')).toThrow('duplicate');
});
test('fetch allowlist, redirect refusal, upstream failure and download cap',async()=>{
 await expect(fetchSosResults('https://example.com/feed')).rejects.toThrow('Only Georgia');
 const fetcher=(async(_:any,options:any)=>{expect(options.redirect).toBe('error');return new Response('unavailable',{status:404});}) as typeof fetch;
 await expect(fetchSosResults(url,fetcher)).rejects.toThrow('HTTP 404');
 await expect(fetchSosResults(url,(async()=>new Response('',{headers:{'content-length':String(257*1024*1024)}})) as typeof fetch)).rejects.toThrow('256 MiB');
});
test('blank source, validation-only and unchanged refreshes never write; failed staging never publishes',async()=>{
 const calls:string[]=[];
 let blank=true,unchanged=false,fail=false;
 const document=JSON.stringify(source()),sha=prepareSosResults(document,'2026-02-17').sha256;
 const api=async(path:string)=>{calls.push(path);if(path.startsWith('elections?'))return [{election_date:'2026-02-17',results_json_url:blank?null:url}];if(path==='rpc/get_sos_results')return {snapshot_id:'old',source_sha256:unchanged?sha:'old'};if(path==='rpc/begin_sos_results')return 'new';if(path==='rpc/stage_sos_results'&&fail)throw Error('network');return 'new';};
 const fetcher=(async()=>new Response(document)) as typeof fetch;
 expect((await refreshSosResults(api,'id',true,fetcher)).status).toBe('awaiting_url');
 blank=false;expect((await refreshSosResults(api,'id',false,fetcher)).status).toBe('validated');expect(calls.some(x=>x.startsWith('rpc/'))).toBe(false);
 unchanged=true;expect((await refreshSosResults(api,'id',true,fetcher)).status).toBe('unchanged');expect(calls).not.toContain('rpc/begin_sos_results');
 unchanged=false;fail=true;await expect(refreshSosResults(api,'id',true,fetcher)).rejects.toThrow('network');expect(calls).not.toContain('rpc/publish_sos_results');
});

import {expect,test} from 'bun:test';
import {browseStaticBills,browseStaticSessions,directoryRow,legislativeSearch} from '../../apps/web/src/lib/legislation-directory';
import {readLegislationDirectory,readStaticBills} from '../../apps/web/src/scripts/legislation-directory-data';
import type {LegislationDirectory} from '../../apps/web/src/lib/legislation-directory';
const rows=Array.from({length:55},(_,i)=>({id:`id-${i}`,term_id:i<30?'ga':'us',visibility:'public',title:`Bill ${String(i).padStart(2,'0')}`,identifier:`HB ${i}`,introduced_on:`2025-02-${String(i%28+1).padStart(2,'0')}`,summary:i%2?'School funding':'Road improvements',jurisdiction:i<30?'state':'federal',state_name:i<30?'Georgia':null,labels:{term_id:'2025 Regular',session_id:'Special session',body_id:'Georgia House'}}));
test('full-dataset filters, context and substring search, four sorts and pagination',()=>{
 expect(browseStaticBills(rows).total).toBe(55);
 const first=browseStaticBills(rows),second=browseStaticBills(rows,{offset:25}),last=browseStaticBills(rows,{offset:50});
 expect(new Set([...first.rows,...second.rows,...last.rows].map(row=>row.id)).size).toBe(55);
 expect(last.rows.length).toBe(5);
 expect(browseStaticBills(rows,{jurisdiction:'state',state:'Georgia',term:'ga'}).total).toBe(30);
 expect(browseStaticBills(rows,{jurisdiction:'federal',state:'Georgia'}).total).toBe(0);
 expect(browseStaticBills(rows,{term:'missing'}).total).toBe(0);
 expect(browseStaticBills(rows,{query:'school funding'}).total).toBe(27);
 expect(browseStaticBills(rows,{query:'special SESSION'}).total).toBe(55);
 expect(browseStaticBills(rows,{query:'HB 1'}).total).toBe(11);
 expect(browseStaticBills(rows,{sort:'oldest'}).rows[0].introduced_on).toBe('2025-02-01');
 expect(browseStaticBills(rows,{sort:'newest'}).rows[0].introduced_on).toBe('2025-02-28');
 expect(browseStaticBills(rows,{sort:'title_asc'}).rows[0].title).toBe('Bill 00');
 expect(browseStaticBills(rows,{sort:'title_desc'}).rows[0].title).toBe('Bill 54');
 expect(browseStaticSessions(rows,'school','ga').total).toBe(15);
 expect(()=>directoryRow({...rows[0],visibility:'private'})).toThrow('Non-public');
 expect(()=>directoryRow({...rows[0],visibility:'unlisted'})).toThrow('Non-public');
 expect(directoryRow({...rows[0],source_payload:'secret import bookkeeping'})).not.toHaveProperty('source_payload');
});
test('SQL wildcard and literal regexp characters, escapes, length and hostile input',()=>{
 expect(legislativeSearch('H_ % 1')('HB test 1')).toBe(true);
 expect(legislativeSearch('a.b')('axb')).toBe(false);
 expect(legislativeSearch('100\\%')('100% complete')).toBe(true);
 expect(legislativeSearch('100\\%')('1000 complete')).toBe(false);
 expect(()=>legislativeSearch('x'.repeat(501))).toThrow('500');
 expect(()=>legislativeSearch('x\\')).toThrow('backslash');
 expect(legislativeSearch('%a'.repeat(240)+'b')('a'.repeat(4000))).toBe(false);
});
test('anonymous snapshots cache, scope downloads, retry failures and retain signed-in gate',async()=>{
 const before=globalThis.fetch;const urls:string[]=[];let signedIn=false,fail=false,authError=false;
 const client={auth:{getSession:async()=>({data:{session:signedIn?{}:null},error:authError?Error('session failed'):null})}} as unknown as Parameters<typeof readLegislationDirectory>[1];
 const directory:LegislationDirectory={version:1,terms:[{id:'ga',jurisdiction:'state',state_name:'Georgia'},{id:'us',jurisdiction:'federal'}],sessions:[],initial:browseStaticBills(rows),bills:[{term:'ga',count:30,url:'/directory-data/legislation/ga-test.json'},{term:'us',count:25,url:'/directory-data/legislation/us-test.json'}]};
 globalThis.fetch=(async(url)=>{urls.push(String(url));return fail?new Response('',{status:503}):Response.json(String(url).includes('manifest')?directory:rows.filter(row=>row.term_id===(String(url).includes('ga-')?'ga':'us')));}) as typeof fetch;
 try {
  signedIn=true;expect(await readLegislationDirectory(undefined,client)).toBeNull();expect(urls).toHaveLength(0);
  signedIn=false;await expect(readLegislationDirectory(undefined,client)).rejects.toThrow('Missing');
  fail=true;await expect(readLegislationDirectory('/directory-data/legislation/manifest-test.json',client)).rejects.toThrow('503');
  fail=false;const data=(await readLegislationDirectory('/directory-data/legislation/manifest-test.json',client))!;
  await readLegislationDirectory('/directory-data/legislation/manifest-test.json',client);expect(urls).toHaveLength(2);
  expect(await readStaticBills(data,{})).toEqual(directory.initial);expect(urls).toHaveLength(2);
  expect((await readStaticBills(data,{state:'Georgia'})).total).toBe(30);expect(urls).toHaveLength(3);
  expect(urls.at(-1)).toContain('ga-test');
  expect((await readStaticBills(data,{offset:50})).rows).toHaveLength(5);expect(urls).toHaveLength(4);
  authError=true;await expect(readLegislationDirectory('/directory-data/legislation/manifest-test.json',client)).rejects.toThrow('session failed');
  authError=false;await expect(readLegislationDirectory('https://evil.example/manifest.json',client)).rejects.toThrow('URL');
 }finally {globalThis.fetch=before;}
});

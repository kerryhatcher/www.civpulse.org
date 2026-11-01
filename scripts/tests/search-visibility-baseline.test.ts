import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {captureInventory,checkedUrl,sitemapLocations} from '../search-visibility-baseline.mjs';
const root='https://www.civpulse.org';
test('recursive inventory deduplicates URLs, preserves sources, flags policy mismatches and refuses overwrite',async()=>{
 const out=await mkdtemp(join(tmpdir(),'visibility-test-')),calls:string[]=[];
 const data:Record<string,string>={
  [root+'/sitemap-index.xml']:`<sitemapindex><sitemap><loc>${root}/a.xml</loc></sitemap><sitemap><loc>${root}/b.xml</loc></sitemap></sitemapindex>`,
  [root+'/a.xml']:`<urlset><url><loc>${root}/</loc></url><url><loc>${root}/people/public/</loc></url></urlset>`,
  [root+'/b.xml']:`<urlset><url><loc>${root}/people/public/</loc></url><url><loc>${root}/account/</loc></url></urlset>`,
 };
 try{
  const result=await captureInventory({out,transport:async(url:string)=>{calls.push(url);return new Response(data[url]);}});
  expect(calls).toHaveLength(3);expect(result.unique_url_count).toBe(3);expect(result.current_code_noindex_mismatches).toEqual([root+'/account/']);
  const csv=new TextDecoder().decode(Bun.gunzipSync(await Bun.file(join(out,'expected-public-urls.csv.gz')).bytes()));
  expect(csv.split('\n').filter(Boolean)).toHaveLength(4);expect(csv).toContain(root+'/a.xml '+root+'/b.xml');
  expect(new Bun.CryptoHasher('sha256').update(csv).digest('hex')).toBe(result.inventory_csv_sha256);
  await expect(captureInventory({out,transport:async()=>{throw Error('Must not fetch');}})).rejects.toThrow('Refusing to overwrite');
 }finally{await rm(out,{recursive:true,force:true});}
});
test('capture rejects non-sitemaps and off-origin, query, credential or fragment URLs',()=>{
 expect(()=>sitemapLocations('<html>Blocked</html>')).toThrow();
 expect(sitemapLocations('<urlset><url><loc>https://www.civpulse.org/a&amp;b/</loc></url></urlset>')).toEqual([root+'/a&b/']);
 for(const value of ['https://example.test/','https://secret@www.civpulse.org/','https://www.civpulse.org/maps/view/?id=PRIVATE','https://www.civpulse.org/#private'])expect(()=>checkedUrl(value)).toThrow();
});
test('dated production artifact is exact, distinct from local corpus, and has no private viewer URLs',async()=>{
 const dir='docs/measurement/2026-11-01',summary=await Bun.file(dir+'/inventory-summary.json').json();
 const csv=new TextDecoder().decode(Bun.gunzipSync(await Bun.file(dir+'/'+summary.inventory_file).bytes()));
 expect(new Bun.CryptoHasher('sha256').update(csv).digest('hex')).toBe(summary.inventory_csv_sha256);
 expect(csv.split('\n').filter(Boolean)).toHaveLength(summary.unique_url_count+1);
 expect(summary.unique_url_count).toBe(Object.values(summary.category_counts).reduce((a:any,b:any)=>a+b,0));
 expect(csv).not.toMatch(/\/view\/\?id=|[?&](token|access_token)=/);
 expect(summary.local_comparison.scope).toContain('Non-production');
 const trials=await Bun.file(dir+'/web-retrieval-trials.json').json();expect(trials).toHaveLength(6);for(const id of ['P1','P2','P3']){const rows=trials.filter((r:any)=>r.prompt_id===id);expect(rows).toHaveLength(2);expect(rows[0].exact_prompt).toBe(rows[1].exact_prompt);expect(rows[0].surface).toContain('not an AI answer');}
});

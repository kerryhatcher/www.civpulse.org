#!/usr/bin/env bun
/** Read-only production sitemap inventory. Never submits sitemaps or requests indexing. */
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sax from 'sax';
import {shouldNoIndex} from '../apps/web/src/lib/indexing-policy.mjs';
export const origin='https://www.civpulse.org';
function parseSitemap(xml){
 const parser=sax.parser(true,{xmlns:true,strictEntities:true}),stack=[],locations=[];
 let root,location;
 parser.onerror=error=>{throw error;};
 parser.onopentag=tag=>{
  if(!stack.length){
   if(root||!['sitemapindex','urlset'].includes(tag.local))throw Error('Expected a sitemap index or URL set root');
   root=tag.local;
  }
  if(location!==undefined)throw Error('Expected text inside sitemap loc');
  stack.push(tag.local);
  if(stack.length===3&&stack[1]===(root==='urlset'?'url':'sitemap')&&tag.local==='loc')location='';
 };
 parser.ontext=parser.oncdata=text=>{if(location!==undefined)location+=text;};
 parser.onclosetag=()=>{if(location!==undefined){locations.push(location.trim());location=undefined;}stack.pop();};
 parser.write(xml).close();
 if(!root)throw Error('Expected a sitemap index or URL set root');
 return {root,locations};
}
export function sitemapLocations(xml){return parseSitemap(xml).locations;}
export function checkedUrl(value){const u=new URL(value);if(u.origin!==origin||u.username||u.password||u.hash||u.search)throw Error('Expected a queryless production URL: '+value);return u.href;}
export const csvCell=value=>'"'+String(value).replaceAll('"','""')+'"';
export function urlCategory(value){const p=new URL(value).pathname;if(p.startsWith('/records/'))return p.split('/').slice(1,3).join('/');if(p.startsWith('/counties/'))return 'counties';return p.split('/')[1]||'home';}
export async function captureInventory({out,transport=fetch,local}={}){
 if(!out)throw Error('Pass a new --out directory');await mkdir(out,{recursive:true});
 if(await Bun.file(resolve(out,'inventory-summary.json')).exists())throw Error('Refusing to overwrite a dated capture; choose a new directory');
 const observedAt=new Date().toISOString(),pending=[origin+'/sitemap-index.xml'],seen=new Set(),urlSources=new Map(),documents=[];
 while(pending.length){const url=checkedUrl(pending.shift());if(seen.has(url))continue;if(seen.size>=100)throw Error('Too many sitemap documents');seen.add(url);
  const response=await transport(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Sitemap ${url}: HTTP ${response.status}`);checkedUrl(response.url||url);const xml=await response.text();
  const parsed=parseSitemap(xml),locations=parsed.locations.map(checkedUrl),isIndex=parsed.root==='sitemapindex';
  documents.push({url,status:response.status,observed_at:new Date().toISOString(),sha256:new Bun.CryptoHasher('sha256').update(xml).digest('hex'),bytes:Buffer.byteLength(xml),kind:isIndex?'index':'urlset',entries:locations.length});
  if(isIndex)pending.push(...locations);else for(const item of locations){const sources=urlSources.get(item)??new Set();sources.add(url);urlSources.set(item,sources);}
 }
 const urls=[...urlSources.keys()].sort(),counts={};for(const u of urls)counts[urlCategory(u)]=(counts[urlCategory(u)]??0)+1;
 const policyMismatches=urls.filter(u=>shouldNoIndex(new URL(u).pathname));
 const summary={schema_version:1,observed_at:observedAt,origin,inventory_semantics:'Production sitemap-listed canonical candidates, not proof of indexing or exhaustive database/public content.',documents,unique_url_count:urls.length,category_counts:counts,current_code_noindex_mismatches:policyMismatches,local_comparison:null};
 const csv=['url,category,sitemap_source,current_code_indexable',...urls.map(u=>[u,urlCategory(u),[...urlSources.get(u)].sort().join(' '),!shouldNoIndex(new URL(u).pathname)].map(csvCell).join(','))].join('\n')+'\n';
 summary.inventory_file='expected-public-urls.csv.gz'; summary.inventory_csv_sha256=new Bun.CryptoHasher('sha256').update(csv).digest('hex');
 await Bun.write(resolve(out,'expected-public-urls.csv.gz'),Bun.gzipSync(new TextEncoder().encode(csv)));
 if(local){const index=await Bun.file(resolve(local,'sitemap-index.xml')).text(),localSet=new Set();for(const location of sitemapLocations(index)){const path=new URL(location).pathname.replace(/^\//,'');for(const u of sitemapLocations(await Bun.file(resolve(local,path)).text()))localSet.add(u);}
  const onlyProduction=urls.filter(u=>!localSet.has(u)),onlyLocal=[...localSet].filter(u=>!urlSources.has(u)).sort();summary.local_comparison={scope:'Non-production isolated local build; different database/content corpus. This is not a deployment diff or missing-page count.',local_url_count:localSet.size,production_only_count:onlyProduction.length,local_only_count:onlyLocal.length};
  await Bun.write(resolve(out,'local-comparison.json'),JSON.stringify({...summary.local_comparison,local_only_urls:onlyLocal},null,2)+'\n');
 }
 await Bun.write(resolve(out,'inventory-summary.json'),JSON.stringify(summary,null,2)+'\n');return summary;
}
export function captureArguments(args){
 const options={};
 for(let i=0;i<args.length;i++){
  const flag=args[i];
  if(!['--out','--local'].includes(flag))throw Error('Unknown argument: '+flag);
  const value=args[++i];
  if(!value||value.startsWith('--'))throw Error(flag+' requires a directory');
  const key=flag.slice(2);if(key in options)throw Error('Duplicate argument: '+flag);options[key]=value;
 }
 if(!options.out)throw Error('Usage: bun run scripts/search-visibility-baseline.mjs --out NEW_DIRECTORY [--local apps/web/dist]');
 return options;
}
if(import.meta.main)console.log(await captureInventory(captureArguments(process.argv.slice(2))));

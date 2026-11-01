import { expect, test } from 'bun:test';
import { buildProfileSectionAssets } from '../../apps/web/src/lib/profile-section-assets';
import { emptyProfileSections, groupProfileVotes, type PublicProfileSections } from '../../apps/web/src/lib/profile-sections';
import { loadPublicProfileSnapshot, readProfileVoteGroups } from '../../apps/web/src/lib/profile-section-data';

type Assets=Awaited<ReturnType<typeof buildProfileSectionAssets>>;
const read=(assets:Assets,url:string)=>{
  const asset=assets.files.get(url.replace('/profile-data/',''));
  if(!asset)throw Error(`Missing asset ${url}`);
  return JSON.parse(asset.body);
};
function expanded(assets:Assets,profile:PublicProfileSections){
  const {legislativeResourcesUrl,...value}=profile;
  return {...value,legislation:{...(legislativeResourcesUrl?read(assets,legislativeResourcesUrl):{}),...value.legislation}};
}
const references=()=>({
  legislative_terms:[{id:'term',name:'Published term',description:'Source context '.repeat(180)}],
  legislative_sessions:[{id:'session',term_id:'term',name:'Published session'}],
  legislative_bodies:[{id:'body',name:'Published body'}],
});
const withReferences=(id:string,shared=references()):PublicProfileSections=>({...emptyProfileSections(),
  legislation:{...shared,bill_sponsorships:[{id:`sponsor-${id}`,office_term_id:`office-${id}`}]},
});

async function assertResolved(assets:Assets){
  for(const [path,asset] of assets.files){
    expect(asset.path).toBe(path);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(asset.body));
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    expect(path).toBe(`assets/${hash}.json`);
    const data=JSON.parse(asset.body);
    for(const url of [data.legislativeResourcesUrl,data.legislativeVotesUrl,...Object.values(data.legislativePages??{})]){
      if(url)expect(assets.files.has(String(url).replace('/profile-data/',''))).toBe(true);
    }
  }
  for(const asset of assets.owners.values())expect(assets.files.get(asset.path)).toBe(asset);
}

test('identical empty/nonempty bodies share content URLs without losing owners or publishing nonowners',async()=>{
  const same=withReferences('same');
  const sections={people:new Map([['a',same],['b',{...same}],['hidden',{...emptyProfileSections(),articles:[{title:'private-marker'}] as any}]]),organizations:new Map<string,PublicProfileSections>()};
  const assets=await buildProfileSectionAssets(sections,[{id:'a'},{id:'b'},{id:'empty-a'},{id:'empty-b'}],[{id:'empty-org'}]);
  expect(assets.owners.size).toBe(5);
  expect(assets.owners.get('people/empty-a')).toBe(assets.owners.get('organizations/empty-org'));
  expect(assets.owners.get('people/a')).toBe(assets.owners.get('people/b'));
  expect(assets.files.size).toBe(2); // Empty body and one inline identical nonempty body.
  expect(JSON.parse(assets.owners.get('people/a')!.body).legislativeResourcesUrl).toBeUndefined();
  expect([...assets.files.values()].map(asset=>asset.body).join('')).not.toContain('private-marker');
  expect(assets.owners.has('people/hidden')).toBe(false);
  await assertResolved(assets);
});

test('measured shared references hydrate equivalently, retain fixed table order and leave source profiles untouched',async()=>{
  const shared=references(),a=withReferences('a',shared),b=withReferences('b',shared);
  const before=JSON.stringify([a,b]);
  const sections={people:new Map([['a',a],['b',b]]),organizations:new Map<string,PublicProfileSections>()};
  const assets=await buildProfileSectionAssets(sections,[{id:'a'},{id:'b'}],[]);
  for(const [id,source] of [['a',a],['b',b]] as const){
    const raw=JSON.parse(assets.owners.get(`people/${id}`)!.body);
    expect(raw.legislativeResourcesUrl).toBeTruthy();
    expect(Object.keys(raw.legislation)).toEqual(['bill_sponsorships']);
    expect(expanded(assets,raw)).toEqual(source);
    expect(Object.keys(expanded(assets,raw).legislation)).toEqual(['legislative_terms','legislative_sessions','legislative_bodies','bill_sponsorships']);
  }
  expect(JSON.stringify([a,b])).toBe(before);
  const reversed=await buildProfileSectionAssets(sections,[{id:'b'},{id:'a'}],[]);
  expect([...assets.files.keys()].sort()).toEqual([...reversed.files.keys()].sort());
  for(const key of assets.owners.keys())expect(assets.owners.get(key)!.path).toBe(reversed.owners.get(key)!.path);
  const solo=await buildProfileSectionAssets(sections,[{id:'a'}],[]);
  expect(JSON.parse(solo.owners.get('people/a')!.body).legislativeResourcesUrl).toBeUndefined();
  const small={legislative_terms:[],legislative_sessions:[],legislative_bodies:[]};
  const tiny=await buildProfileSectionAssets({people:new Map([['a',withReferences('a',small)],['b',withReferences('b',small)]]),organizations:new Map()},[{id:'a'},{id:'b'}],[]);
  expect([...tiny.owners.values()].every(asset=>!asset.body.includes('legislativeResourcesUrl'))).toBe(true);
  await assertResolved(assets);
});

test('reference savings count distinct emitted primaries rather than repeated owners',async()=>{
  const shared=references();shared.legislative_terms[0].description='x'.repeat(5000);
  const same=withReferences('same',shared);
  const owners=Array.from({length:100},(_,i)=>({id:String(i)}));
  const identical=await buildProfileSectionAssets({people:new Map(owners.map(({id})=>[id,{...same}])),organizations:new Map()},owners,[]);
  expect(identical.files.size).toBe(1);
  expect([...identical.files.values()][0].body).toBe(JSON.stringify(same));
  expect([...identical.owners.values()].every(asset=>!asset.body.includes('legislativeResourcesUrl'))).toBe(true);
  const votes={...same,legislativeVotes:[{id:'choice',vote_id:'vote',term_id:'term',session_id:'session',body_id:'body',bills:[]}]};
  const duplicateVotes=await buildProfileSectionAssets({people:new Map([['a',votes],['b',{...votes}]]),organizations:new Map()},[{id:'a'},{id:'b'}],[]);
  expect(duplicateVotes.owners.get('people/a')).toBe(duplicateVotes.owners.get('people/b'));
  expect(JSON.parse(duplicateVotes.owners.get('people/a')!.body).legislativeResourcesUrl).toBeUndefined();
  const a=withReferences('a',shared),b=withReferences('b',shared);
  const distinct=await buildProfileSectionAssets({people:new Map([['a',a],['b',b]]),organizations:new Map()},[{id:'a'},{id:'b'}],[]);
  expect(distinct.files.size).toBe(3);
  const actualBytes=[...distinct.files.values()].reduce((sum,asset)=>sum+new TextEncoder().encode(asset.body).length,0);
  const inlineBytes=[a,b].reduce((sum,profile)=>sum+new TextEncoder().encode(JSON.stringify(profile)).length,0);
  expect(inlineBytes-actualBytes).toBeGreaterThan(1024);
  for(const source of [a,b])expect(expanded(distinct,JSON.parse(distinct.owners.get(`people/${source===a?'a':'b'}`)!.body))).toEqual(source);
});

test('all emitted vote pages/filter files resolve and preserve pagination/filtering; signed-in profiles skip every asset',async()=>{
  const shared=references(),source=withReferences('votes',shared);
  source.legislativeVotes=Array.from({length:45},(_,i)=>({id:`choice-${i}`,vote_id:`vote-${i}`,term_id:'term',session_id:'session',body_id:'body',category:i%2?'passage':'amendment',occurred_on:'2026-01-01',bills:[{id:`bill-${i}`,identifier:`HB ${i}`,title:`Bill ${i}`}]}));
  const assets=await buildProfileSectionAssets({people:new Map([['a',source],['b',withReferences('b',shared)]]),organizations:new Map()},[{id:'a'},{id:'b'}],[]);
  await assertResolved(assets);
  const url=`/profile-data/${assets.owners.get('people/a')!.path}`;
  const oldFetch=globalThis.fetch,urls:string[]=[];
  let signedIn=false,missing=false;
  const client={auth:{getSession:async()=>({data:{session:signedIn?{}:null}})}} as unknown as NonNullable<Parameters<typeof loadPublicProfileSnapshot>[1]>;
  globalThis.fetch=(async(input)=>{const path=String(input);urls.push(path);return missing?new Response('missing',{status:404}):Response.json(read(assets,path));}) as typeof fetch;
  try{
    const profile=(await loadPublicProfileSnapshot(url,client))!;
    expect(profile.legislation).toEqual(source.legislation);
    for(const args of [{p_limit:20},{p_limit:20,p_offset:20},{p_limit:20,p_offset:40},{p_limit:20,p_category:'passage'},{p_limit:20,p_category:'amendment'}]){
      expect(await readProfileVoteGroups(profile,args)).toEqual(groupProfileVotes(source,args));
    }
    const filterUrl=JSON.parse(assets.owners.get('people/a')!.body).legislativeVotesUrl;
    expect(urls.filter(path=>path===filterUrl)).toHaveLength(1);
    signedIn=true;const count=urls.length;expect(await loadPublicProfileSnapshot(url,client)).toBe(null);expect(urls).toHaveLength(count);
    signedIn=false;missing=true;await expect(loadPublicProfileSnapshot(url,client)).rejects.toThrow('HTTP 404');
  }finally{globalThis.fetch=oldFetch;}
});

test('a missing shared reference fails closed and can be retried without retaining a failed file read',async()=>{
  const shared=references();shared.legislative_terms[0].description+=' Required reference failure fixture.';
  const assets=await buildProfileSectionAssets({people:new Map([['a',withReferences('a',shared)],['b',withReferences('b',shared)]]),organizations:new Map()},[{id:'a'},{id:'b'}],[]);
  const url=`/profile-data/${assets.owners.get('people/a')!.path}`;
  const referenceUrl=JSON.parse(assets.owners.get('people/a')!.body).legislativeResourcesUrl;
  const client={auth:{getSession:async()=>({data:{session:null}})}} as unknown as NonNullable<Parameters<typeof loadPublicProfileSnapshot>[1]>;
  const oldFetch=globalThis.fetch;let missing=true;
  globalThis.fetch=(async(input)=>missing&&String(input)===referenceUrl?new Response('missing',{status:404}):Response.json(read(assets,String(input)))) as typeof fetch;
  try{
    await expect(loadPublicProfileSnapshot(url,client)).rejects.toThrow('HTTP 404');
    missing=false;expect((await loadPublicProfileSnapshot(url,client))!.legislation).toEqual(withReferences('a',shared).legislation);
  }finally{globalThis.fetch=oldFetch;}
});

const baseline=process.env.PROFILE_ASSET_BASELINE_DIR;
test.skipIf(!baseline)('all built owner payloads remain equivalent and every published profile reference resolves',async()=>{
  const current='apps/web/dist';let owners=0;
  async function normalize(root:string,url:string){
    const data=await Bun.file(`${root}${url}`).json();
    const {legislativeResourcesUrl,...profile}=data;
    if(legislativeResourcesUrl)profile.legislation={...await Bun.file(`${root}${legislativeResourcesUrl}`).json(),...profile.legislation};
    if(profile.legislativePages)for(const [offset,page] of Object.entries(profile.legislativePages))profile.legislativePages[offset]=await Bun.file(`${root}${page}`).json();
    if(profile.legislativeVotesUrl)profile.legislativeVotesUrl=await Bun.file(`${root}${profile.legislativeVotesUrl}`).json();
    return profile;
  }
  for(const directory of ['people','orgs'])for await(const file of new Bun.Glob('**/index.html').scan({cwd:`${baseline}/${directory}`})){
    const oldHtml=await Bun.file(`${baseline}/${directory}/${file}`).text(),html=await Bun.file(`${current}/${directory}/${file}`).text();
    const oldUrl=oldHtml.match(/data-profile-snapshot="([^"]+)"/)?.[1],url=html.match(/data-profile-snapshot="([^"]+)"/)?.[1];
    if(!oldUrl){expect(url).toBeUndefined();continue;}
    expect(url,`${directory}/${file}`).toBeTruthy();expect(oldUrl).toBeTruthy();
    const before=await normalize(baseline!,oldUrl!),after=await normalize(current,url!);
    expect(after,`${directory}/${file}`).toEqual(before);
    expect(Object.keys(after.legislation)).toEqual(Object.keys(before.legislation));owners++;
  }
  for await(const file of new Bun.Glob('**/*.json').scan({cwd:`${current}/profile-data`})){
    const data=await Bun.file(`${current}/profile-data/${file}`).json();
    for(const url of [data.legislativeResourcesUrl,data.legislativeVotesUrl,...Object.values(data.legislativePages??{})])if(url)expect(await Bun.file(`${current}${url}`).exists()).toBe(true);
  }
  expect(owners).toBeGreaterThan(100);
});

import {expect,test} from 'bun:test';
import {loadPublicProfileSnapshot,readProfileVoteGroups} from '../../apps/web/src/lib/profile-section-data';
import {emptyProfileSections} from '../../apps/web/src/lib/profile-sections';

test('only anonymous public profile pages read snapshots; UUID and signed-in views retain live gates',async()=>{
 const fetchBefore=globalThis.fetch;let fetches=0,signedIn=false;
 const client={auth:{getSession:async()=>({data:{session:signedIn?{}:null}})}} as unknown as NonNullable<Parameters<typeof loadPublicProfileSnapshot>[1]>;
 globalThis.fetch=(async()=>{fetches++;return Response.json(emptyProfileSections());}) as typeof fetch;
 try{
  expect(await loadPublicProfileSnapshot(undefined,client)).toBe(null);expect(fetches).toBe(0);
  expect(await loadPublicProfileSnapshot('/profile-data/public.json',client)).toMatchObject({articles:[],votes:[]});expect(fetches).toBe(1);
  signedIn=true;expect(await loadPublicProfileSnapshot('/profile-data/public.json',client)).toBe(null);expect(fetches).toBe(1);
  signedIn=false;globalThis.fetch=(async()=>new Response('missing',{status:404})) as typeof fetch;
  await expect(loadPublicProfileSnapshot('/profile-data/missing.json',client)).rejects.toThrow('HTTP 404');
 }finally{globalThis.fetch=fetchBefore;}
});

test('unfiltered vote pages stay small and full choices download only on filtering, once',async()=>{
 const fetchBefore=globalThis.fetch;const urls:string[]=[];
 const profile=emptyProfileSections();
 profile.legislativeInitial={total:21,rows:[{id:'initial'}]};
 profile.legislativePages={'20':'/profile-data/test-page.json'};
 profile.legislativeVotesUrl='/profile-data/test-filter.json';
 globalThis.fetch=(async(url)=>{urls.push(String(url));return Response.json(String(url).includes('test-page')?{total:21,rows:[{id:'next'}]}:[{id:'choice',vote_id:'vote',category:'passage',occurred_on:'2026-01-01',bills:[]}]);}) as typeof fetch;
 try{
  expect((await readProfileVoteGroups(profile,{p_limit:20})).rows[0].id).toBe('initial');expect(urls).toEqual([]);
  expect((await readProfileVoteGroups(profile,{p_offset:20,p_limit:20})).rows[0].id).toBe('next');expect(urls).toEqual(['/profile-data/test-page.json']);
  expect((await readProfileVoteGroups(profile,{p_category:'passage',p_limit:20})).total).toBe(1);
  expect((await readProfileVoteGroups(profile,{p_category:'amendment',p_limit:20})).total).toBe(0);
  expect(urls).toEqual(['/profile-data/test-page.json','/profile-data/test-filter.json']);
 }finally{globalThis.fetch=fetchBefore;}
});

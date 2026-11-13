import {expect,test} from 'bun:test';
import {loadPublicDirectorySnapshot} from '../../apps/web/src/scripts/directory-data';

test('signed-in readers keep live gates; anonymous reads cache static assets, fail visibly and retry',async()=>{
 const before=globalThis.fetch;let fetches=0,signedIn=false,fail=false,authError=false;
 const client={auth:{getSession:async()=>({data:{session:signedIn?{}:null},error:authError?new Error('auth failed'):null})}} as unknown as Parameters<typeof loadPublicDirectorySnapshot>[1];
 globalThis.fetch=(async()=>{fetches++;return fail?new Response('missing',{status:404}):Response.json([]);}) as typeof fetch;
 try{
  signedIn=true;expect(await loadPublicDirectorySnapshot('/directory-data/test.json',client)).toBe(null);expect(fetches).toBe(0);
  signedIn=false;expect(await loadPublicDirectorySnapshot('/directory-data/test.json',client)).toEqual([]);
  await loadPublicDirectorySnapshot('/directory-data/test.json',client);expect(fetches).toBe(1);
  fail=true;await expect(loadPublicDirectorySnapshot('/directory-data/missing.json',client)).rejects.toThrow('404');
  fail=false;expect(await loadPublicDirectorySnapshot('/directory-data/missing.json',client)).toEqual([]);expect(fetches).toBe(3);
  authError=true;await expect(loadPublicDirectorySnapshot('/directory-data/test.json',client)).rejects.toThrow('auth failed');expect(fetches).toBe(3);
 }finally{globalThis.fetch=before;}
});

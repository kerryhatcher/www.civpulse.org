import { afterEach, expect, test } from 'bun:test';
import { mergeDocumentMatches, searchDocuments } from '../../apps/web/src/lib/document-search';
import type { PublicDocument } from '../../apps/web/src/lib/documents';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const doc=(id:string)=>({id,title:id} as PublicDocument);
function mock(catalog: PublicDocument[], contents: unknown, calls: string[], catalogStatus=200, contentStatus=200) {
  globalThis.fetch=(async (input: RequestInfo | URL)=>{
    const url=String(input); calls.push(url);
    return url.includes('/documents?') ? Response.json({documents:catalog},{status:catalogStatus})
      : Response.json({results:contents},{status:contentStatus});
  }) as typeof fetch;
}
test('one query includes title-only and content-only documents and retains passages for overlapping matches',async()=>{
  const calls:string[]=[];mock([doc('title'),doc('both')],[{document:doc('both'),passages:['matching text']},{document:doc('content'),passages:['other text']}],calls);
  const page=await searchDocuments('https://example.org','school budget');
  const rows=mergeDocumentMatches([],page.rows);
  expect(rows.map(row=>row.document.id)).toEqual(['title','both','content']);
  expect(rows[1].passages).toEqual(['matching text']);
  expect(calls.length).toBe(2);expect(calls.every(url=>new URL(url).searchParams.get('q')==='school budget')).toBe(true);
});
test('catalog pagination advances by raw catalog count and never repeats content searches or documents',async()=>{
  const calls:string[]=[];mock(Array.from({length:20},(_,i)=>doc(String(i))),[{document:doc('20'),passages:['keep this']}],calls);
  const first=await searchDocuments('https://example.org','meeting');
  expect(first.hasMore).toBe(true);expect(first.nextOffset).toBe(20);
  mock([doc('20'),doc('21')],[],calls);
  const next=await searchDocuments('https://example.org','meeting',first.nextOffset,true);
  const rows=mergeDocumentMatches(mergeDocumentMatches([],first.rows),next.rows);
  expect(rows.length).toBe(22);expect(rows[20].passages).toEqual(['keep this']);
  expect(next.hasMore).toBe(false);expect(calls.length).toBe(3);expect(calls[2]).toContain('offset=20');
});
test('empty query browses without an AI search request',async()=>{
  const calls:string[]=[];mock([doc('all')],[],calls);
  expect((await searchDocuments('https://example.org','')).rows.length).toBe(1);expect(calls.length).toBe(1);
});
test('content failure keeps catalog results and explains partial coverage',async()=>{
  mock([doc('available')],[],[],200,503);
  const page=await searchDocuments('https://example.org','budget');
  expect(page.rows[0].document.id).toBe('available');expect(page.warning).toContain('Content search is temporarily unavailable');
});
test('catalog failure keeps content matches with an explicit notice',async()=>{
  mock([],[{document:doc('available'),passages:['text']}],[],503);
  const page=await searchDocuments('https://example.org','budget');
  expect(page.rows[0].document.id).toBe('available');expect(page.warning).toContain('Title and filename search is temporarily unavailable');expect(page.hasMore).toBe(false);
});
test('both services failing reports failure instead of a misleading empty state',async()=>{
  mock([],[],[],503,503);
  await expect(searchDocuments('https://example.org','budget')).rejects.toThrow('Please try again later');
});

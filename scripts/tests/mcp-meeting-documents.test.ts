import { describe, expect, test, spyOn } from 'bun:test';
import { buildServer } from '../../apps/mcp/src/tools';
import { decodeMeetingDocument, MAX_DOCUMENT_BYTES, registerMeetingTools } from '../../apps/mcp/src/meeting-tools';

test('MCP meeting video writes validate URLs, preserve omitted fields and allow clearing',async()=>{
  const registrations=new Map<string,{schema:any;handler:any}>();
  const server=buildServer({} as never,{id:'00000000-0000-4000-8000-000000000002'});
  const register=spyOn(Object.getPrototypeOf(server),'registerTool').mockImplementation((name,config,handler)=>{
    registrations.set(name,{schema:config.inputSchema,handler});return {} as never;
  });
  let patch:Record<string,unknown>={};
  try{
    buildServer({rpc:async()=>({data:true,error:null}),from:()=>({update:(value:Record<string,unknown>)=>{
      patch=value;return {eq:()=>({select:()=>({single:async()=>({data:{id:'00000000-0000-4000-8000-000000000001'},error:null})})})};
    }})} as never,{id:'00000000-0000-4000-8000-000000000002'});
    const tool=registrations.get('update_event')!;
    const id='00000000-0000-4000-8000-000000000001';
    const url='https://vimeo.com/76979871/abc123';
    expect(tool.schema.safeParse({id,meeting_video_url:url}).success).toBe(true);
    for(const value of ['javascript:alert(1)','http://example.test/video',('https://' + 'user:pass@' + 'youtube.com/watch?v=wjYeLMR-3tE')])
      expect(tool.schema.safeParse({id,meeting_video_url:value}).success).toBe(false);
    await tool.handler({id,meeting_video_url:url});expect(patch).toEqual({meeting_video_url:url});
    await tool.handler({id,meeting_notes:'Notes'});expect(patch).toEqual({meeting_notes:'Notes'});
    await tool.handler({id,meeting_video_url:null});expect(patch).toEqual({meeting_video_url:null});
  }finally{register.mockRestore();}
});

describe('MCP meeting document validation', () => {
  test('preserves document bytes and derives MIME type from the supported extension', () => {
    const text = 'Automated transcript — verify against the recording.\n';
    const decoded = decodeMeetingDocument('meeting.TXT', Buffer.from(text).toString('base64'));
    expect(new TextDecoder().decode(decoded.bytes)).toBe(text);
    expect(decoded.contentType).toBe('text/plain');
    expect(decoded.extension).toBe('txt');
    expect(decodeMeetingDocument('minutes.pdf', btoa('%PDF-1.7\n')).contentType).toBe('application/pdf');
  });
  test('rejects paths, controls and executable document extensions', () => {
    for (const name of ['../minutes.txt', 'a/b.pdf', 'a\\b.txt', 'a\n.txt', 'a\0.txt', ' notes.txt', 'a.html', 'a.svg', 'a.exe', 'a'.repeat(256) + '.txt']) {
      expect(() => decodeMeetingDocument(name, btoa('data'))).toThrow();
    }
  });
  test('rejects malformed base64 and data URLs instead of silently altering bytes', () => {
    for (const value of ['', 'a', '====', 'a===', '=abc', 'YWJj\n', 'YW!j', 'data:text/plain;base64,YWJj']) {
      expect(() => decodeMeetingDocument('notes.txt', value)).toThrow();
    }
  });
  test('enforces the decoded size even when the encoded length is within its limit', () => {
    const exact = Buffer.alloc(MAX_DOCUMENT_BYTES, 65).toString('base64');
    expect(decodeMeetingDocument('notes.txt', exact).bytes.length).toBe(MAX_DOCUMENT_BYTES);
    const tooLarge = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 65).toString('base64');
    expect(tooLarge.length).toBe(exact.length);
    expect(() => decodeMeetingDocument('notes.txt', tooLarge)).toThrow('Document size');
  });
});

describe('upload failure recovery', () => {
  async function upload(recovery: 'missing' | 'committed' | 'unavailable') {
    const handlers = new Map();
    let removed = false;
    let row: Record<string, unknown>;
    const client = {
      rpc: async (name: string) => ({ data: name === 'is_admin' ? true : { status: 'ok' }, error: null }),
      storage: { from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => { removed = true; return { error: null }; },
      }) },
      from: () => ({
        insert: (input: Record<string, unknown>) => {
          row = input;
          return { select: () => ({ single: async () => ({ data: null, error: { message: 'Interrupted insert response' } }) }) };
        },
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: recovery === 'committed' ? row : null,
          error: recovery === 'unavailable' ? { message: 'Unavailable' } : null,
        }) }) }),
      }),
    };
    registerMeetingTools({ registerTool: (name, _schema, handler) => handlers.set(name, handler) } as never, client as never);
    const result = await handlers.get('upload_meeting_attachment')({
      meeting_id: '00000000-0000-4000-8000-000000000001', file_name: 'notes.txt', data_base64: btoa('Notes'),
    });
    return { result, removed };
  }
  test('preserves an object after an interrupted insert and an immediate empty read', async () => {
    const { result, removed } = await upload('missing');
    expect(result.isError).toBe(true);
    expect(removed).toBe(false);
    expect(result.content[0].text).toContain('outcome uncertain');
  });
  test('recovers a committed insert without deleting the attachment', async () => {
    const { result, removed } = await upload('committed');
    expect(result.isError).toBeUndefined();
    expect(removed).toBe(false);
  });
  test('preserves the object when the insert outcome cannot be established', async () => {
    const { result, removed } = await upload('unavailable');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('outcome uncertain');
    expect(removed).toBe(false);
  });
});

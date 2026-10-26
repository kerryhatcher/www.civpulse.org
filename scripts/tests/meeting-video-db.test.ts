import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.MEETINGS_TEST_DATABASE_URL)('meeting videos migrate, enforce constraints and inherit visibility',async()=>{
  const sql=new SQL(process.env.MEETINGS_TEST_DATABASE_URL!);const rollback=new Error('rollback videos');
  try{await sql.begin(async tx=>{
    const suffix=crypto.randomUUID(),admin=crypto.randomUUID(),user=crypto.randomUUID();
    await tx`insert into auth.users(id,email) values(${admin},${`video-admin-${suffix}@example.test`}),(${user},${`video-user-${suffix}@example.test`})`;
    await tx`insert into public.admins(user_id) values(${admin})`;
    const [org]=await tx`insert into public.organizations(name,slug) values('Video QA',${`video-${suffix}`}) returning id`;
    const [calendar]=await tx`insert into public.calendars(name,slug,organization_id) values('Video QA',${`video-${suffix}`},${org.id}) returning id`;
    const description='Meeting recording: https://www.youtube.com/watch?v=wjYeLMR-3tE\nShared continuous stream.';
    const ids:string[]=[];
    for(const visibility of ['public','private']){
      const [event]=await tx`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility,description)
        values(${calendar.id},'Video QA','2026-02-19 23:30Z',true,${visibility},${description}) returning id`;
      ids.push(event.id);
    }
    await tx.unsafe(await Bun.file('supabase/migrations/20261122000003_meeting_video_url.sql').text());
    expect((await tx`select meeting_video_url,description from public.events where id=${ids[0]}`)[0]).toMatchObject({meeting_video_url:'https://www.youtube.com/watch?v=wjYeLMR-3tE',description});
    const read=async(id=ids[0])=>(await tx`select public.get_meeting(${id}::uuid) result`)[0].result;
    await tx.unsafe('set local role anon');
    expect((await read()).event.meeting_video_url).toContain('wjYeLMR-3tE');
    expect((await read(ids[1])).status).toBe('private');
    await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${user},true)`;
    expect((await read(ids[1])).status).toBe('private');
    expect(await tx`update public.events set meeting_video_url='https://vimeo.com/76979871' where id=${ids[0]} returning id`).toHaveLength(0);
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    expect((await read(ids[1])).event.meeting_video_url).toContain('wjYeLMR-3tE');
    await tx`update public.events set meeting_video_url='https://vimeo.com/76979871' where id=${ids[0]}`;
    expect((await read()).event.meeting_video_url).toBe('https://vimeo.com/76979871');
    const invalid=async(query:()=>Promise<unknown>)=>{
      await tx.unsafe('savepoint invalid_video');
      let rejected=false;try{await query();}catch{rejected=true;}
      await tx.unsafe('rollback to savepoint invalid_video');expect(rejected).toBe(true);
    };
    for(const bad of ['javascript:alert(1)','http://example.test/video','https://example.test/a b','https://example.test/'+ 'x'.repeat(2048)])
      await invalid(()=>tx`update public.events set meeting_video_url=${bad} where id=${ids[0]}`);
    await invalid(()=>tx`update public.events set is_meeting=false where id=${ids[0]}`);
    await tx`update public.events set meeting_video_url=null where id=${ids[0]}`;
    expect((await read()).event.meeting_video_url).toBeNull();
    await tx.unsafe('reset role');
    await tx`update public.calendars set visibility='private' where id=${calendar.id}`;
    await tx.unsafe('set local role anon');await tx`select set_config('request.jwt.claim.sub','',true)`;
    expect((await read()).status).toBe('private');
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
});

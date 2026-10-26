import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.MEETINGS_TEST_DATABASE_URL)('optional video offsets preserve zero, null and meeting visibility',async()=>{
  const sql=new SQL(process.env.MEETINGS_TEST_DATABASE_URL!);const rollback=new Error('rollback video starts');
  try{await sql.begin(async tx=>{
    if(!(await tx`select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='meeting_video_url'`).length)
      await tx.unsafe(await Bun.file('supabase/migrations/20261122000003_meeting_video_url.sql').text());
    await tx.unsafe(await Bun.file('supabase/migrations/20261122000004_meeting_video_start_seconds.sql').text());
    const suffix=crypto.randomUUID(),admin=crypto.randomUUID(),user=crypto.randomUUID();
    await tx`insert into auth.users(id,email) values(${admin},${`start-admin-${suffix}@example.test`}),(${user},${`start-user-${suffix}@example.test`})`;
    await tx`insert into public.admins(user_id) values(${admin})`;
    const [org]=await tx`insert into public.organizations(name,slug) values('Start QA',${`start-${suffix}`}) returning id`;
    const [calendar]=await tx`insert into public.calendars(name,slug,organization_id) values('Start QA',${`start-${suffix}`},${org.id}) returning id`;
    const [event]=await tx`insert into public.events(calendar_id,title,starts_at,is_meeting,meeting_video_url)
      values(${calendar.id},'Start QA','2026-02-19 23:30Z',true,'https://www.youtube.com/watch?v=wjYeLMR-3tE') returning id`;
    const read=async()=>(await tx`select public.get_meeting(${event.id}::uuid) result`)[0].result;
    expect((await read()).event.meeting_video_start_seconds).toBeNull();
    await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    await tx`update public.events set meeting_video_start_seconds=9491 where id=${event.id}`;
    expect((await read()).event.meeting_video_start_seconds).toBe(9491);
    await tx.unsafe('set local role anon');await tx`select set_config('request.jwt.claim.sub','',true)`;
    expect((await read()).event.meeting_video_start_seconds).toBe(9491);
    await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${user},true)`;
    expect(await tx`update public.events set meeting_video_start_seconds=10 where id=${event.id} returning id`).toHaveLength(0);
    await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    await tx`update public.events set meeting_video_start_seconds=0 where id=${event.id}`;
    expect((await read()).event.meeting_video_start_seconds).toBe(0);
    await tx`update public.events set meeting_video_start_seconds=null where id=${event.id}`;
    expect((await read()).event.meeting_video_start_seconds).toBeNull();
    await tx.unsafe('savepoint bad_offset');
    let rejected=false;try{await tx`update public.events set meeting_video_start_seconds=-1 where id=${event.id}`;}catch{rejected=true;}
    await tx.unsafe('rollback to savepoint bad_offset');expect(rejected).toBe(true);
    await tx`update public.events set visibility='private',meeting_video_start_seconds=9491 where id=${event.id}`;
    await tx.unsafe('set local role anon');await tx`select set_config('request.jwt.claim.sub','',true)`;
    expect((await read()).status).toBe('private');
    await tx.unsafe('set local role authenticated');await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
    expect((await read()).event.meeting_video_start_seconds).toBe(9491);
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
});

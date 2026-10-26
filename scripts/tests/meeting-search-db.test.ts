import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.MEETINGS_TEST_DATABASE_URL)('site search finds meeting text, reflects edits and preserves discovery privacy',async()=>{
  const sql=new SQL(process.env.MEETINGS_TEST_DATABASE_URL!);
  const rollback=new Error('rollback search fixtures');
  try {await sql.begin(async tx=>{
    await tx.unsafe(await Bun.file('supabase/migrations/20261122000002_search_meeting_content.sql').text());
    const suffix=crypto.randomUUID(), admin=crypto.randomUUID(),user=crypto.randomUUID();
    await tx`insert into auth.users(id,email) values(${admin},${`admin-${suffix}@example.test`}),(${user},${`user-${suffix}@example.test`})`;
    await tx`insert into public.admins(user_id) values(${admin})`;
    const [org]=await tx`insert into public.organizations(name,slug) values('Search QA',${`search-${suffix}`}) returning id`;
    const [calendar]=await tx`insert into public.calendars(name,slug,organization_id) values('Search QA',${`search-${suffix}`},${org.id}) returning id`;
    const ids:string[]=[];
    for(const visibility of ['public','unlisted','private']){
      const [event]=await tx`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility,meeting_notes,meeting_transcript)
        values(${calendar.id},'Board Meeting','2026-02-19 23:30Z',true,${visibility},'FSS-2 amendment approved. qznotemarker','qztranscriptmarker: repairs to classrooms') returning id`;
      ids.push(event.id);
      await tx`insert into public.meeting_votes(meeting_id,subject,description,outcome)
        values(${event.id},'qzmotionmarker - Budget amendment','qzdetailmarker construction contracts','passed'),
          (${event.id},'qzmotionmarker - Second motion','Also matching','passed')`;
    }
    const search=async(q:string,type:string|null='event')=>tx`select * from public.search_site(${q},${type},100,0)`;
    const role=async(name:'anon'|'authenticated',id='')=>{
      await tx.unsafe(`set local role ${name}`);await tx`select set_config('request.jwt.claim.sub',${id},true)`;
    };
    await role('anon');
    for(const q of ['FSS-2','qznotemarker','qztranscriptmarker','qzmotionmarker','qzdetailmarker','repair classroom']){
      const result=await search(q);
      expect(result).toHaveLength(1);expect(result[0].id).toBe(ids[0]);
      expect(result[0].url).toBe(`/calendar/view/?id=${ids[0]}`);
    }
    expect((await search('FSS-2',null)).map(r=>r.id)).toContain(ids[0]);
    expect(await search('qzmotionmarker','person')).toHaveLength(0);
    await role('authenticated',user);expect(await search('qzmotionmarker')).toHaveLength(1);
    await role('authenticated',admin);expect(await search('qzmotionmarker')).toHaveLength(3);
    await tx.unsafe('reset role');
    await tx`update public.calendars set visibility='private' where id=${calendar.id}`;
    await role('anon');expect(await search('qznotemarker')).toHaveLength(0);
    await role('authenticated',user);expect(await search('qzdetailmarker')).toHaveLength(0);
    await role('authenticated',admin);expect(await search('qztranscriptmarker')).toHaveLength(3);
    await tx.unsafe('reset role');
    await tx`update public.calendars set visibility='unlisted' where id=${calendar.id}`;
    await role('anon');expect(await search('qznotemarker')).toHaveLength(0);
    await tx.unsafe('reset role');
    await tx`update public.calendars set visibility='public' where id=${calendar.id}`;
    await tx`delete from public.meeting_votes where meeting_id=${ids[0]}`;
    await tx`update public.events set meeting_notes='qzupdatedmarker' where id=${ids[0]}`;
    await role('anon');
    expect(await search('qzmotionmarker')).toHaveLength(0);
    expect(await search('qznotemarker')).toHaveLength(0);
    expect(await search('qzupdatedmarker')).toHaveLength(1);
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
});

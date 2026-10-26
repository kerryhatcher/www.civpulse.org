import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.MEETINGS_TEST_DATABASE_URL)('profile voting history privacy, paging and live edits',async()=>{
  const sql=new SQL(process.env.MEETINGS_TEST_DATABASE_URL!);
  const rollback=new Error('rollback');
  try {await sql.begin(async tx=>{
    const migration=await Bun.file('supabase/migrations/20261122000001_person_voting_records.sql').text();
    if (!(await tx`select to_regprocedure('public.get_person_votes(uuid,integer,integer)') as fn`)[0].fn) await tx.unsafe(migration);
    const admin=crypto.randomUUID(), user=crypto.randomUUID(), suffix=crypto.randomUUID();
    await tx`insert into auth.users(id,email) values(${admin},${`admin-${suffix}@example.test`}),(${user},${`user-${suffix}@example.test`})`;
    await tx`insert into public.admins(user_id) values(${admin})`;
    const [person]=await tx`insert into public.people(full_name,slug,kind) values('Voting Test',${`votes-${suffix}`},'elected_official') returning id`;
    const [org]=await tx`insert into public.organizations(name,slug) values('Voting Test',${`votes-${suffix}`}) returning id`;
    const [calendar]=await tx`insert into public.calendars(name,slug,organization_id) values('Voting Test',${`votes-${suffix}`},${org.id}) returning id`;
    const meetingIds:string[]=[];
    for (const visibility of ['public','unlisted','private']) {
      const [event]=await tx`insert into public.events(calendar_id,title,starts_at,is_meeting,visibility)
        values(${calendar.id},${visibility},'2026-02-19 23:30Z',true,${visibility}) returning id`;
      meetingIds.push(event.id);
      await tx`insert into public.meeting_attendance(meeting_id,person_id,status) values(${event.id},${person.id},'present')`;
      for (let position=0;position<(visibility==='public'?25:1);position++) {
        const [vote]=await tx`insert into public.meeting_votes(meeting_id,subject,position,outcome,description)
          values(${event.id},${`Motion ${position}`},${position},'passed','Motion details') returning id`;
        await tx`insert into public.meeting_vote_choices(vote_id,meeting_id,person_id,choice) values(${vote.id},${event.id},${person.id},'yes')`;
      }
    }
    const read=async(offset=0,limit=50)=>tx`select * from public.get_person_votes(${person.id}::uuid,${offset},${limit})`;
    const role=async(name:'anon'|'authenticated',id='')=>{
      await tx.unsafe(`set local role ${name}`);
      await tx`select set_config('request.jwt.claim.sub',${id},true)`;
    };
    await role('anon');
    expect(await read()).toHaveLength(25);
    expect((await read(0,21)).map(r=>r.subject)).toEqual(Array.from({length:21},(_,i)=>`Motion ${i}`));
    expect((await read(20,21)).map(r=>r.subject)).toEqual(Array.from({length:5},(_,i)=>`Motion ${i+20}`));
    expect(await read(-1,0)).toHaveLength(1);
    expect((await read())[0]).toMatchObject({choice:'yes',description:'Motion details',meeting_title:'public',organization_name:'Voting Test'});
    await role('authenticated',user);
    expect(await read()).toHaveLength(25);
    await role('authenticated',admin);
    expect(await read()).toHaveLength(27);
    await tx.unsafe('reset role');
    await tx`update public.calendars set visibility='private' where id=${calendar.id}`;
    await role('anon'); expect(await read()).toHaveLength(0);
    await role('authenticated',user); expect(await read()).toHaveLength(0);
    await role('authenticated',admin); expect(await read()).toHaveLength(27);
    await tx.unsafe('reset role');
    await tx`update public.calendars set visibility='unlisted' where id=${calendar.id}`;
    await role('anon'); expect(await read()).toHaveLength(0);
    await tx.unsafe('reset role');
    await tx`update public.calendars set visibility='public' where id=${calendar.id}`;
    await tx`update public.people set visibility='private' where id=${person.id}`;
    await role('anon'); expect(await read()).toHaveLength(0);
    await role('authenticated',user); expect(await read()).toHaveLength(0);
    await role('authenticated',admin); expect(await read()).toHaveLength(27);
    await tx.unsafe('reset role');
    await tx`update public.people set visibility='unlisted' where id=${person.id}`;
    await tx`update public.meeting_vote_choices set choice='abstain' where person_id=${person.id}`;
    await role('anon'); expect((await read())[0].choice).toBe('abstain');
    expect((await tx`select count(*)::int n from public.get_person_votes(${crypto.randomUUID()}::uuid)`)[0].n).toBe(0);
    await tx.unsafe('reset role');
    await tx`delete from public.meeting_votes where meeting_id=${meetingIds[0]}`;
    await role('anon'); expect(await read()).toHaveLength(0);
    throw rollback;
  });} catch(error){if(error!==rollback)throw error;}finally{await sql.close();}
});

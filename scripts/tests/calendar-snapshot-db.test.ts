import {expect,test} from 'bun:test';
import {SQL} from 'bun';

test.skipIf(!process.env.CALENDAR_TEST_DATABASE_URL)('public meeting export pages all records and matches gated reads without hidden parents or participants',async()=>{
 const db=new SQL(process.env.CALENDAR_TEST_DATABASE_URL!);const rollback=new Error('rollback calendar export fixtures');
 try {
  await db.begin(async tx=>{
   const tag=`static-calendar-${crypto.randomUUID()}`;
   const [org]=await tx`insert into organizations(slug,name) values(${tag},'Calendar export QA') returning id`;
   const calendars:Record<string,string>={};
   for(const visibility of ['public','unlisted','private']) {
    const [calendar]=await tx`insert into calendars(organization_id,slug,name,visibility) values(${org.id},${`${tag}-${visibility}`},${visibility},${visibility}) returning id`;
    calendars[visibility]=calendar.id;
   }
   const people:Record<string,string>={};
   for(const visibility of ['public','unlisted','private']) {
    const [person]=await tx`insert into people(slug,full_name,kind,visibility) values(${`${tag}-${visibility}`},${`${visibility} member`},'other',${visibility}) returning id`;
    people[visibility]=person.id;
   }
   const rows=await tx`insert into events(calendar_id,title,starts_at,is_meeting,meeting_notes,meeting_transcript)
    select ${calendars.public}::uuid,${tag}||n,'2026-10-31 18:00Z'::timestamptz,true,'Public minutes','Public transcript' from generate_series(1,205) n returning id`;
   const meetingId=rows[0].id;
   await tx`update events set meeting_video_url='https://www.youtube.com/watch?v=wjYeLMR-3tE',meeting_video_start_seconds=0 where id=${meetingId}`;
   for(const visibility of ['unlisted','private']) {
    await tx`insert into events(calendar_id,title,starts_at,is_meeting,visibility) values(${calendars.public},${`Hidden event ${visibility}`},'2026-10-31 18:00Z',true,${visibility})`;
    await tx`insert into events(calendar_id,title,starts_at,is_meeting) values(${calendars[visibility]},${`Hidden calendar ${visibility}`},'2026-10-31 18:00Z',true)`;
   }
   for(const id of Object.values(people)) await tx`insert into meeting_attendance(meeting_id,person_id,status) values(${meetingId},${id},'present')`;
   const [vote]=await tx`insert into meeting_votes(meeting_id,subject,outcome) values(${meetingId},'Public motion','passed') returning id`;
   for(const id of Object.values(people)) await tx`insert into meeting_vote_choices(vote_id,meeting_id,person_id,choice) values(${vote.id},${meetingId},${id},'yes')`;
   await tx`insert into meeting_attachments(meeting_id,file_name,storage_path,mime_type,size_bytes) values(${meetingId},'public.txt',${`${meetingId}/public.txt`},'text/plain',6)`;
   await tx.unsafe('set local role anon');
   const all:any[]=[];
   for(let offset=0;;offset+=100) {
    const page=await tx`select payload from public.export_public_calendar_meetings(${offset},100) payload`;
    all.push(...page.map(row=>row.payload));if(page.length<100) break;
   }
   const fixture=all.filter(row=>rows.some(event=>event.id===row.id));
   expect(fixture).toHaveLength(205);expect(new Set(fixture.map(row=>row.id)).size).toBe(205);
   expect(all.some(row=>row.meeting.event.title.startsWith('Hidden'))).toBe(false);
   const snapshot=fixture.find(row=>row.id===meetingId).meeting;
   const live=(await tx`select get_meeting(${meetingId}) payload`)[0].payload;
   expect(snapshot.attendance).toEqual(live.attendance);expect(snapshot.votes).toEqual(live.votes);expect(snapshot.attachments).toEqual(live.attachments);
   expect(snapshot.attendance.map(row=>row.person_id)).toEqual([people.public]);expect(snapshot.votes[0].choices).toHaveLength(1);
   expect(snapshot.event.meeting_transcript).toBe('Public transcript');expect(snapshot.event.meeting_video_start_seconds).toBe(0);expect(snapshot.event.meeting_video_url).toContain('wjYeLMR-3tE');expect(snapshot.event).not.toHaveProperty('created_at');
   expect(JSON.stringify(snapshot)).not.toContain(people.private);expect(JSON.stringify(snapshot)).not.toContain(people.unlisted);expect(JSON.stringify(snapshot)).not.toContain('signedUrl');
   expect((await tx`select has_function_privilege('authenticated','public.export_public_calendar_meetings(integer,integer)','execute') allowed`)[0].allowed).toBe(false);
   expect((await tx`select has_function_privilege('anon','public.export_public_calendar_meetings(integer,integer)','execute') allowed`)[0].allowed).toBe(true);
   throw rollback;
  });
 }catch(error){if(error!==rollback)throw error;}finally{await db.close();}
},20000);

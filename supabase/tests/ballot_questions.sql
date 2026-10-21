-- Run with psql against local Supabase; all fixtures roll back.
\set ON_ERROR_STOP on
begin;
insert into public.elections(id,slug,name,election_date,visibility) values
 ('73000000-0000-0000-0000-000000000001','ballot-test-public','Ballot Test Public','2026-11-03','public'),
 ('73000000-0000-0000-0000-000000000002','ballot-test-private','Ballot Test Private','2026-11-03','private'),
 ('73000000-0000-0000-0000-000000000003','ballot-test-unlisted','Ballot Test Unlisted','2026-11-03','unlisted');
insert into public.ballot_questions(election_id,title,question_text,position)
select id,'Question 2','Shall this test question be approved?',2 from public.elections where slug like 'ballot-test-%';
insert into public.ballot_questions(election_id,title,question_text,choices,position)
values ('73000000-0000-0000-0000-000000000001','Question 1','Full wording with a line break.
Second paragraph.',array['For','Against'],1);
set local role anon;
do $$
declare detail jsonb;
begin
 detail := public.get_election('73000000-0000-0000-0000-000000000001');
 assert detail->>'status'='ok', 'public question-only election loads';
 assert jsonb_array_length(detail->'ballot_questions')=2, 'all public questions returned';
 assert detail->'ballot_questions'->0->>'title'='Question 1', 'question order';
 assert detail->'ballot_questions'->0->'choices'='["For","Against"]'::jsonb, 'custom choices';
 assert detail->'ballot_questions'->1->'choices'='["Yes","No"]'::jsonb, 'default choices';
 assert detail->'contests'='[]'::jsonb, 'no fabricated races';
 detail := public.get_election('73000000-0000-0000-0000-000000000002');
 assert detail='{"status":"private"}'::jsonb, 'private questions do not leak';
 assert public.get_election('73000000-0000-0000-0000-000000000003')->>'status'='ok', 'unlisted question viewable by UUID';
 begin perform * from public.ballot_questions; raise exception 'anon table read allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.ballot_questions(election_id,title,question_text) values ('73000000-0000-0000-0000-000000000001','Bad','Bad'); raise exception 'anon insert allowed'; exception when insufficient_privilege then null; end;
 begin update public.ballot_questions set title='Bad'; raise exception 'anon update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.ballot_questions; raise exception 'anon delete allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','74000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$
declare affected int;
begin
 assert not exists(select 1 from public.ballot_questions), 'nonadmin direct read denied';
 assert jsonb_array_length(public.get_election('73000000-0000-0000-0000-000000000002')->'ballot_questions')=1, 'signed-in private view';
 begin insert into public.ballot_questions(election_id,title,question_text) values ('73000000-0000-0000-0000-000000000001','Bad','Bad'); raise exception 'nonadmin insert allowed'; exception when insufficient_privilege then null; end;
 update public.ballot_questions set title='Bad'; get diagnostics affected = row_count; assert affected=0, 'nonadmin update denied';
 delete from public.ballot_questions; get diagnostics affected = row_count; assert affected=0, 'nonadmin delete denied';
end $$;
reset role;
-- Use the existing local test admin; never create hosted test accounts.
select set_config('request.jwt.claim.sub',(select user_id::text from public.admins limit 1),true);
set local role authenticated;
do $$
declare question_id uuid;
begin
 assert public.is_admin(), 'seed local admin before running';
 insert into public.ballot_questions(election_id,title,question_text,source_url)
 values ('73000000-0000-0000-0000-000000000001','Admin question','Admin wording','https://example.gov/ballot') returning id into question_id;
 assert exists(select 1 from public.ballot_questions where id=question_id), 'admin read/insert';
 update public.ballot_questions set question_text='Updated wording' where id=question_id;
 assert (select question_text='Updated wording' from public.ballot_questions where id=question_id), 'admin update';
 begin update public.ballot_questions set choices=array['Only'] where id=question_id; raise exception 'invalid choices allowed'; exception when check_violation then null; end;
 begin update public.ballot_questions set question_text=' ' where id=question_id; raise exception 'blank wording allowed'; exception when check_violation then null; end;
 begin update public.ballot_questions set source_url='javascript:alert(1)' where id=question_id; raise exception 'unsafe URL allowed'; exception when check_violation then null; end;
 delete from public.ballot_questions where id=question_id;
 assert not exists(select 1 from public.ballot_questions where id=question_id), 'admin delete';
end $$;
reset role;
delete from public.elections where id='73000000-0000-0000-0000-000000000001';
do $$ begin assert not exists(select 1 from public.ballot_questions where election_id='73000000-0000-0000-0000-000000000001'), 'election cascade'; end $$;
rollback;

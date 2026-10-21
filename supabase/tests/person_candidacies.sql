-- Run with psql against a migrated local Supabase database; fixtures roll back.
\set ON_ERROR_STOP on
begin;
insert into public.people (id,slug,full_name) values
 ('71000000-0000-0000-0000-000000000001','candidacy-test','Candidacy Test');
insert into public.people (id,slug,full_name,visibility) values
 ('71000000-0000-0000-0000-000000000002','candidacy-private-test','Private Test','private');
insert into public.elections (id,slug,name,election_date,visibility)
select ('71000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 'candidacy-test-'||i, 'Candidacy Test '||i,
 (now() at time zone 'America/New_York')::date + offset_days,
 visibility
from (values (10,-1,'public'),(11,0,'public'),(12,10,'public'),
 (13,20,'public'),(14,30,'private'),(15,40,'unlisted'),(16,50,'public'),
 (17,60,'public'),(18,70,'public'),(19,80,'public')) as t(i,offset_days,visibility);
insert into public.contests(id,election_id,office)
select id,id,name from public.elections where slug like 'candidacy-test-%';
insert into public.contest_candidates(contest_id,person_id,status,is_write_in)
select id,'71000000-0000-0000-0000-000000000001',
 case when slug='candidacy-test-13' then 'withdrawn'
      when slug='candidacy-test-16' then 'pending'
      when slug='candidacy-test-17' then 'runoff'
      when slug='candidacy-test-18' then 'won'
      when slug='candidacy-test-19' then 'lost'
      else 'running' end,
 slug='candidacy-test-11'
from public.elections where slug like 'candidacy-test-%';
insert into public.contest_candidates(contest_id,person_id)
 values ('71000000-0000-0000-0000-000000000011','71000000-0000-0000-0000-000000000002');
set local role anon;
do $$
declare ids text[];
begin
 assert (select count(*)=8 from public.get_person_candidacies('71000000-0000-0000-0000-000000000001')), 'anon sees public elections only';
 assert (select count(*)=4 from public.get_person_candidacies('71000000-0000-0000-0000-000000000001') where is_current), 'today, future, pending, runoff are current';
 assert (select count(*)=4 from public.get_person_candidacies('71000000-0000-0000-0000-000000000001') where not is_current), 'past date, withdrawn, won and lost are past';
 select array_agg(election_slug) into ids from public.get_person_candidacies('71000000-0000-0000-0000-000000000001');
 assert ids[1]='candidacy-test-11' and ids[2]='candidacy-test-12', 'current elections are soonest first';
 assert ids[5]='candidacy-test-19' and ids[8]='candidacy-test-10', 'past candidacies newest first';
 assert (select is_write_in from public.get_person_candidacies('71000000-0000-0000-0000-000000000001') where election_slug='candidacy-test-11'), 'write-in flag preserved';
 assert not exists(select 1 from public.get_person_candidacies('71000000-0000-0000-0000-000000000002')), 'private person cannot leak public candidacy';
 assert not exists(select 1 from public.get_person_candidacies('71000000-0000-0000-0000-000000000099')), 'missing person has no candidacies';
end;
$$;
reset role;
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$
begin
 assert (select count(*)=10 from public.get_person_candidacies('71000000-0000-0000-0000-000000000001')), 'signed-in visitor sees hidden elections';
 assert (select count(*)=1 from public.get_person_candidacies('71000000-0000-0000-0000-000000000002')), 'signed-in visitor sees private person candidacy';
end;
$$;
reset role;
update public.people set visibility='unlisted' where id='71000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
 assert (select count(*)=8 from public.get_person_candidacies('71000000-0000-0000-0000-000000000001')), 'unlisted person is viewable by UUID without exposing hidden elections';
end;
$$;
rollback;

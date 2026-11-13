-- Immutable, scoped snapshots. Originals are private; no additive import operation.
create table public.election_result_reports (
 id uuid primary key default gen_random_uuid(),
 election_id uuid not null references public.elections(id),
 scope jsonb not null,
 observed_at timestamptz not null,
 snapshot jsonb not null,
 sources jsonb not null,
 supersedes uuid unique references public.election_result_reports(id),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(election_id, scope, observed_at)
);
create index election_result_reports_election_idx on public.election_result_reports(election_id, created_at);
alter table public.election_result_reports enable row level security;
revoke all on public.election_result_reports from anon, authenticated;
grant select on public.election_result_reports to authenticated;
create policy "Admins inspect original election reports" on public.election_result_reports
 for select to authenticated using (public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('election-evidence','election-evidence',false,10485760,array['image/jpeg','image/png','application/pdf']);
create policy "Admins read election evidence" on storage.objects for select to authenticated
 using (bucket_id='election-evidence' and public.is_admin());
create policy "Admins add immutable election evidence" on storage.objects for insert to authenticated
 with check (bucket_id='election-evidence' and public.is_admin() and name ~ '^[a-f0-9]{64}\.(jpg|png|pdf)$');

-- Validate counts at the database boundary too, including direct RPC callers.
create function public.election_result_count(p_value jsonb) returns bigint
language plpgsql immutable set search_path = '' as $$
begin
 if p_value is null or p_value='null'::jsonb then return null; end if;
 if jsonb_typeof(p_value)<>'number' or p_value::text !~ '^[0-9]{1,10}$' or (p_value::text)::bigint>2147483647 then
  raise exception 'Counts must be nonnegative integers or null';
 end if;
 return (p_value::text)::bigint;
end; $$;
revoke all on function public.election_result_count(jsonb) from public, anon, authenticated;

create function public.import_election_result(
 p_election_id uuid, p_scope jsonb, p_observed_at timestamptz, p_snapshot jsonb,
 p_sources jsonb, p_expected_report_id uuid default null, p_dry_run boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 e public.elections; previous public.election_result_reports; existing public.election_result_reports;
 r jsonb; c jsonb; s jsonb; k text; total bigint; result_id uuid; v_contest_id uuid; question_id uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_dry_run is null then raise exception 'dry_run is required'; end if;
 select * into e from public.elections where id=p_election_id for update;
 if e.id is null then raise exception 'Election not found'; end if;
 if p_scope is null or jsonb_typeof(p_scope)<>'object' or not (p_scope ?& array['county','unit_type','unit','counting_group','ballot_style'])
 or p_scope - array['county','unit_type','unit','counting_group','ballot_style'] <> '{}'::jsonb then raise exception 'Invalid report scope'; end if;
 for k in select jsonb_object_keys(p_scope) loop
  if jsonb_typeof(p_scope->k)<>'string' or length(btrim(p_scope->>k)) not between 1 and 200 or p_scope->>k<>btrim(p_scope->>k) then raise exception 'Invalid scope field %',k; end if;
 end loop;
 if p_scope->>'unit_type' not in ('county','precinct','tabulator') or p_scope->>'counting_group' not in ('all','election_day','advance','absentee_mail','provisional') then raise exception 'Invalid unit or counting group'; end if;
 if p_scope->>'unit_type'='county' and p_scope->>'unit'<>'all' then raise exception 'County unit must be all'; end if;
 if p_observed_at is null or not isfinite(p_observed_at) or p_observed_at>now()+interval '5 minutes' then raise exception 'Invalid report timestamp'; end if;
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>1048576
 or not(p_snapshot ?& array['election_date','status','turnout','contests'])
 or p_snapshot - array['election_date','status','turnout','contests','note'] <> '{}'::jsonb then raise exception 'Invalid snapshot'; end if;
 if (p_snapshot->>'election_date')::date is distinct from e.election_date then raise exception 'Printed election date does not match election'; end if;
 if p_snapshot->>'status' is null or p_snapshot->>'status' not in ('unofficial','official','certified') then raise exception 'Explicit result status required'; end if;
 if jsonb_typeof(p_snapshot->'turnout') is distinct from 'object' or jsonb_typeof(p_snapshot->'contests') is distinct from 'array'
 or jsonb_array_length(p_snapshot->'contests')>100 then raise exception 'Invalid turnout or contests'; end if;
 if (p_snapshot->'turnout') - array['ballots','voters','registered','precincts_reported','precincts_total'] <> '{}'::jsonb then raise exception 'Unknown turnout field'; end if;
 for k in select jsonb_object_keys(p_snapshot->'turnout') loop perform public.election_result_count(p_snapshot->'turnout'->k); end loop;
 if public.election_result_count(p_snapshot->'turnout'->'precincts_reported')>public.election_result_count(p_snapshot->'turnout'->'precincts_total') then raise exception 'Reporting exceeds total precincts'; end if;
 if jsonb_array_length(p_snapshot->'contests')>0 and e.election_date>(now() at time zone 'America/New_York')::date then raise exception 'Cannot publish vote results before election day; turnout-only reports are allowed'; end if;
 if (select count(*)<>count(distinct coalesce(x->>'contest_id',x->>'question_id')) from jsonb_array_elements(p_snapshot->'contests') x) then raise exception 'Duplicate contest'; end if;
 for r in select value from jsonb_array_elements(p_snapshot->'contests') loop
  v_contest_id:=(r->>'contest_id')::uuid; question_id:=(r->>'question_id')::uuid;
  if (v_contest_id is null)=(question_id is null) then raise exception 'Exactly one contest or question is required'; end if;
  if r - array['contest_id','question_id','choices','total_votes','unresolved_write_ins','ballots','registered','precincts_reported','precincts_total','undervotes','overvotes'] <> '{}'::jsonb then raise exception 'Unknown contest field'; end if;
  if v_contest_id is not null and not exists(select 1 from public.contests where id=v_contest_id and election_id=e.id) then raise exception 'Contest belongs to another election'; end if;
  if question_id is not null and not exists(select 1 from public.ballot_questions where id=question_id and election_id=e.id) then raise exception 'Question belongs to another election'; end if;
  foreach k in array array['total_votes','unresolved_write_ins','ballots','registered','precincts_reported','precincts_total','undervotes','overvotes'] loop perform public.election_result_count(r->k); end loop;
  if public.election_result_count(r->'precincts_reported')>public.election_result_count(r->'precincts_total') then raise exception 'Contest reporting exceeds precinct total'; end if;
  if jsonb_typeof(r->'choices') is distinct from 'array' or jsonb_array_length(r->'choices') not between 1 and 100 then raise exception 'Choices required'; end if;
  if (select count(*)<>count(distinct coalesce(x->>'person_id',x->>'label')) from jsonb_array_elements(r->'choices') x) then raise exception 'Duplicate choice'; end if;
  total:=0;
  for c in select value from jsonb_array_elements(r->'choices') loop
   if c - array['person_id','label','votes'] <> '{}'::jsonb or jsonb_typeof(c->'label') is distinct from 'string' or length(btrim(c->>'label')) not between 1 and 200 then raise exception 'Invalid choice label'; end if;
   if public.election_result_count(c->'votes') is null then raise exception 'Unreadable votes cannot be published'; end if;
   if v_contest_id is not null then
    if c->>'person_id' is null then
     if c->>'label'<>'Write-in' then raise exception 'Resolve candidate UUID or use Write-in'; end if;
    elsif not exists(select 1 from public.contest_candidates where contest_candidates.contest_id=v_contest_id and person_id=(c->>'person_id')::uuid) then raise exception 'Candidate not in contest'; end if;
   else
    if c->>'person_id' is not null or not exists(select 1 from public.ballot_questions where id=question_id and c->>'label'=any(choices)) then raise exception 'Invalid ballot question choice'; end if;
   end if;
   total:=total+public.election_result_count(c->'votes');
  end loop;
  if public.election_result_count(r->'total_votes') is not null and total<>public.election_result_count(r->'total_votes') then raise exception 'Choice sum does not match printed total votes'; end if;
 end loop;
 if p_sources is null or jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources) not between 1 and 20 or octet_length(p_sources::text)>200000 then raise exception '1–20 source references required'; end if;
 for s in select value from jsonb_array_elements(p_sources) loop
  if s - array['path','locator','transcription'] <> '{}'::jsonb or s->>'path' is null or s->>'path' !~ '^[a-f0-9]{64}\.(jpg|png|pdf)$'
  or coalesce(length(btrim(s->>'locator')),0) not between 1 and 2000 or coalesce(length(btrim(s->>'transcription')),0) not between 1 and 10000 then raise exception 'Source path, locator and transcription required'; end if;
  if not exists(select 1 from storage.objects where bucket_id='election-evidence' and name=s->>'path') then raise exception 'Upload original evidence first'; end if;
 end loop;
 select * into existing from public.election_result_reports where election_id=e.id and scope=p_scope and observed_at=p_observed_at;
 if existing.id is not null then
  if existing.snapshot<>p_snapshot then raise exception 'Conflicting transcription for existing report timestamp'; end if;
  return jsonb_build_object('status','duplicate','report_id',existing.id,'dry_run',p_dry_run);
 end if;
 select * into previous from public.election_result_reports a where a.election_id=e.id and a.scope=p_scope
 and not exists(select 1 from public.election_result_reports b where b.supersedes=a.id);
 if previous.id is distinct from p_expected_report_id then raise exception 'Report changed: read current report and reconcile before replacing'; end if;
 if previous.id is not null and p_observed_at<=previous.observed_at then raise exception 'Older reports cannot replace newer reports'; end if;
 if previous.snapshot->>'status'='certified' and p_snapshot->>'status'<>'certified' then raise exception 'Cannot replace certified results with unofficial results'; end if;
 if p_dry_run then return jsonb_build_object('status','validated','supersedes',previous.id,'dry_run',true); end if;
 insert into public.election_result_reports(election_id,scope,observed_at,snapshot,sources,supersedes,created_by)
 values(e.id,p_scope,p_observed_at,p_snapshot,p_sources,previous.id,auth.uid()) returning id into result_id;
 return jsonb_build_object('status','saved','report_id',result_id,'supersedes',previous.id,'dry_run',false);
end; $$;
revoke all on function public.import_election_result(uuid,jsonb,timestamptz,jsonb,jsonb,uuid,boolean) from public,anon;
grant execute on function public.import_election_result(uuid,jsonb,timestamptz,jsonb,jsonb,uuid,boolean) to authenticated;

create function public.get_election_results(p_election_id uuid, p_history boolean default false, p_offset int default 0, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare e public.elections; reports jsonb; admin boolean:=public.is_admin();
begin
 select * into e from public.elections where id=p_election_id;
 if e.id is null or (e.visibility='private' and not admin) then return jsonb_build_object('status','missing','reports','[]'::jsonb); end if;
 select coalesce(jsonb_agg(item order by observed_at desc,id),'[]'::jsonb) into reports from (
  select a.id,a.observed_at,
   jsonb_build_object('id',a.id,'scope',a.scope,'observed_at',a.observed_at,'supersedes',a.supersedes,
    'snapshot',jsonb_set(a.snapshot,'{contests}',coalesce((select jsonb_agg(r) from jsonb_array_elements(a.snapshot->'contests') r
      where admin or not exists(select 1 from jsonb_array_elements(r->'choices') c join public.people p on p.id=(c->>'person_id')::uuid where p.visibility<>'public')), '[]'::jsonb)),
    'sources',case when admin then a.sources else null end) item
  from public.election_result_reports a where a.election_id=e.id and (p_history or not exists(select 1 from public.election_result_reports b where b.supersedes=a.id))
  order by a.observed_at desc,a.id limit least(greatest(coalesce(p_limit,50),1),100) offset greatest(coalesce(p_offset,0),0)
 ) page;
 return jsonb_build_object('status','ok','election',jsonb_build_object('id',e.id,'name',e.name,'election_date',e.election_date),'reports',reports);
end; $$;
revoke all on function public.get_election_results(uuid,boolean,int,int) from public;
grant execute on function public.get_election_results(uuid,boolean,int,int) to anon,authenticated;

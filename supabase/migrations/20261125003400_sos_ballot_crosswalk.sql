-- Equal source times are accepted only for the current known semantic fingerprint.
create or replace function public.publish_sos_results_job(p_job_id uuid,p_lease_id uuid,p_snapshot_id uuid,p_fingerprint text,p_manifest_key text) returns text language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs; f public.sos_automation_feeds; s public.sos_result_snapshots; latest public.sos_result_snapshots; e public.elections; v_revision bigint;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 if j.state<>'importing' or j.snapshot_id is distinct from p_snapshot_id or coalesce(p_fingerprint,'') !~ '^[0-9a-f]{64}$'
 or p_manifest_key is distinct from 'elections/'||j.election_id::text||'/revisions/'||p_snapshot_id::text||'/manifest.json' then raise exception 'Invalid publication'; end if;
 -- Serialize against administrator publication as well as another worker.
 select * into e from public.elections where id=j.election_id for update;
 select * into f from public.sos_automation_feeds where election_id=j.election_id for update;
 select * into s from public.sos_result_snapshots where id=p_snapshot_id for update;
 select * into latest from public.sos_result_snapshots where election_id=j.election_id and published_at is not null order by published_at desc,id desc limit 1;
 if s.election_id is distinct from j.election_id or s.source_url is distinct from f.source_url or e.visibility is distinct from 'public' or e.results_json_url is distinct from s.source_url or e.election_date::text is distinct from s.header->>'electionDate' then raise exception 'Source changed'; end if;
 if s.published_at is not null and s.id is distinct from latest.id then raise exception 'Old snapshot'; end if;
 if s.published_at is not null and f.current_snapshot_id=s.id then
  update public.sos_automation_feeds set etag=j.receipt->>'etag',last_modified=j.receipt->>'last_modified',last_success_at=clock_timestamp(),last_error=null where election_id=j.election_id;
  update public.sos_automation_jobs set state='done',lease_id=null,lease_until=null,updated_at=clock_timestamp() where id=j.id;
  return f.current_revision::text;
 end if;
 if s.published_at is null and latest.id is not null and (
  (s.header->>'createdAt')::timestamptz < (latest.header->>'createdAt')::timestamptz or
  ((s.header->>'createdAt')::timestamptz = (latest.header->>'createdAt')::timestamptz
   and (f.current_snapshot_id is distinct from latest.id or f.fingerprint is distinct from p_fingerprint))
 ) then raise exception 'Stale or conflicting source timestamp'; end if;
 if exists(select 1 from jsonb_array_elements(s.jurisdictions) with ordinality q(data,n)
 where (data->>'item_count')::int <> (select count(*) from public.sos_result_items i where i.snapshot_id=s.id and i.jurisdiction_index=q.n-1)) then raise exception 'Incomplete snapshot'; end if;
 if exists(select 1 from public.sos_result_items i where i.snapshot_id=s.id group by i.jurisdiction_index,i.data->>'id' having count(*)>1) then raise exception 'Duplicate ballot item'; end if;
 if exists(select 1 from public.sos_result_items i cross join lateral jsonb_array_elements(i.data->'ballotOptions') o where i.snapshot_id=s.id group by i.jurisdiction_index,i.item_index,o->>'id' having nullif(o->>'id','') is null or count(*)>1) then raise exception 'Invalid or duplicate ballot option'; end if;
 if s.published_at is null then
  update public.sos_result_snapshots set published_at=clock_timestamp(),supersedes=latest.id where id=s.id;
 end if;
 v_revision:=f.current_revision+1;
 update public.sos_automation_feeds set current_revision=v_revision,current_snapshot_id=s.id,fingerprint=p_fingerprint,etag=j.receipt->>'etag',last_modified=j.receipt->>'last_modified',last_success_at=clock_timestamp(),last_error=null where election_id=j.election_id;
 update public.sos_automation_jobs set state='pointer',revision=v_revision,manifest_key=p_manifest_key,updated_at=clock_timestamp() where id=j.id;
 if f.fingerprint is distinct from p_fingerprint then
  update public.frontend_rebuild_state set needs_rebuild=true,revision=public.frontend_rebuild_state.revision+1,changed_at=clock_timestamp() where id;
 end if;
 return v_revision::text;
end $$;

-- Curated IDs live in Postgres, never in public source-asset manifests.
create table public.sos_ballot_links (
 election_id uuid not null references public.elections(id) on delete cascade,
 jurisdiction_id text not null check (char_length(btrim(jurisdiction_id)) between 1 and 200),
 source_contest_id text not null check (char_length(btrim(source_contest_id)) between 1 and 200),
 contest_id uuid references public.contests(id) on delete cascade,
 question_id uuid references public.ballot_questions(id) on delete cascade,
 choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices)='array'),
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(),
 primary key(election_id,jurisdiction_id,source_contest_id),
 check ((contest_id is null) <> (question_id is null))
);
create unique index sos_ballot_links_contest_unique on public.sos_ballot_links(election_id,jurisdiction_id,contest_id) where contest_id is not null;
create unique index sos_ballot_links_question_unique on public.sos_ballot_links(election_id,jurisdiction_id,question_id) where question_id is not null;
alter table public.sos_ballot_links enable row level security;
revoke all on public.sos_ballot_links from public,anon,authenticated,service_role;

create function public.put_sos_results_mapping(p_election_id uuid,p_jurisdiction_id text,p_source_contest_id text,p_contest_id uuid,p_question_id uuid,p_choices jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c jsonb;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_jurisdiction_id is null or p_jurisdiction_id<>btrim(p_jurisdiction_id) or char_length(p_jurisdiction_id) not between 1 and 200
 or p_source_contest_id is null or p_source_contest_id<>btrim(p_source_contest_id) or char_length(p_source_contest_id) not between 1 and 200
 or (p_contest_id is null)=(p_question_id is null) or jsonb_typeof(p_choices) is distinct from 'array' then raise exception 'Invalid mapping'; end if;
 if jsonb_array_length(p_choices)>200 then raise exception 'Too many choices'; end if;
 if p_contest_id is not null and not exists(select 1 from public.contests where id=p_contest_id and election_id=p_election_id) then raise exception 'Contest belongs to another election'; end if;
 if p_question_id is not null and not exists(select 1 from public.ballot_questions where id=p_question_id and election_id=p_election_id) then raise exception 'Question belongs to another election'; end if;
 if exists(select 1 from jsonb_array_elements(p_choices) x where jsonb_typeof(x) is distinct from 'object' or x - array['source_choice_id','person_id','choice_label'] <> '{}'::jsonb
  or jsonb_typeof(x->'source_choice_id') is distinct from 'string' or coalesce(x->>'source_choice_id','')<>btrim(coalesce(x->>'source_choice_id','')) or char_length(coalesce(x->>'source_choice_id','')) not between 1 and 200)
 or (select count(*)<>count(distinct x->>'source_choice_id') from jsonb_array_elements(p_choices) x) then raise exception 'Invalid or duplicate source choice'; end if;
 for c in select value from jsonb_array_elements(p_choices) loop
  if p_contest_id is not null then
   if jsonb_typeof(c->'person_id') is distinct from 'string' or c->>'choice_label' is not null
   or not exists(select 1 from public.contest_candidates where contest_id=p_contest_id and person_id=(c->>'person_id')::uuid) then raise exception 'Candidate not in contest'; end if;
  else
   if c->>'person_id' is not null or jsonb_typeof(c->'choice_label') is distinct from 'string'
   or not exists(select 1 from public.ballot_questions where id=p_question_id and c->>'choice_label'=any(choices)) then raise exception 'Invalid question choice'; end if;
  end if;
 end loop;
 if (select count(*)<>count(distinct coalesce(x->>'person_id',x->>'choice_label')) from jsonb_array_elements(p_choices) x) then raise exception 'Duplicate target choice'; end if;
 insert into public.sos_ballot_links(election_id,jurisdiction_id,source_contest_id,contest_id,question_id,choices,reviewed_by)
 values(p_election_id,p_jurisdiction_id,p_source_contest_id,p_contest_id,p_question_id,p_choices,auth.uid())
 on conflict(election_id,jurisdiction_id,source_contest_id) do update set contest_id=excluded.contest_id,question_id=excluded.question_id,choices=excluded.choices,reviewed_by=excluded.reviewed_by,reviewed_at=clock_timestamp()
 where (sos_ballot_links.contest_id,sos_ballot_links.question_id,sos_ballot_links.choices) is distinct from (excluded.contest_id,excluded.question_id,excluded.choices);
 if found and exists(select 1 from public.elections where id=p_election_id and visibility='public') then
  update public.frontend_rebuild_state set needs_rebuild=true,revision=revision+1,changed_at=clock_timestamp() where id;
 end if;
end $$;
create function public.delete_sos_results_mapping(p_election_id uuid,p_jurisdiction_id text,p_source_contest_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 delete from public.sos_ballot_links where election_id=p_election_id and jurisdiction_id=p_jurisdiction_id and source_contest_id=p_source_contest_id;
 if found and exists(select 1 from public.elections where id=p_election_id and visibility='public') then
  update public.frontend_rebuild_state set needs_rebuild=true,revision=revision+1,changed_at=clock_timestamp() where id;
 end if;
end $$;
create function public.get_sos_results_mappings(p_election_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.elections; admin boolean:=public.is_admin(); result jsonb;
begin
 select * into e from public.elections where id=p_election_id;
 if e.id is null or (e.visibility='private' and not admin) then return jsonb_build_object('status','missing','mappings','[]'::jsonb); end if;
 select coalesce(jsonb_agg(jsonb_build_object('jurisdiction_id',l.jurisdiction_id,'source_contest_id',l.source_contest_id,'contest_id',l.contest_id,'question_id',l.question_id,'choices',
   coalesce((select jsonb_agg(x order by x->>'source_choice_id') from jsonb_array_elements(l.choices) x
    where case when l.contest_id is not null then exists(select 1 from public.contest_candidates cc join public.people p on p.id=cc.person_id where cc.contest_id=l.contest_id and p.id=(x->>'person_id')::uuid and (admin or p.visibility='public'))
    else exists(select 1 from public.ballot_questions q where q.id=l.question_id and x->>'choice_label'=any(q.choices)) end),'[]'::jsonb)) order by l.jurisdiction_id,l.source_contest_id),'[]'::jsonb)
 into result from public.sos_ballot_links l
 where l.election_id=e.id and (exists(select 1 from public.contests c where c.id=l.contest_id and c.election_id=e.id) or exists(select 1 from public.ballot_questions q where q.id=l.question_id and q.election_id=e.id));
 return jsonb_build_object('status','ok','mappings',result);
end $$;
revoke all on function public.put_sos_results_mapping(uuid,text,text,uuid,uuid,jsonb),public.delete_sos_results_mapping(uuid,text,text),public.get_sos_results_mappings(uuid) from public,anon,authenticated,service_role;
grant execute on function public.put_sos_results_mapping(uuid,text,text,uuid,uuid,jsonb),public.delete_sos_results_mapping(uuid,text,text) to authenticated;
grant execute on function public.get_sos_results_mappings(uuid) to anon,authenticated;

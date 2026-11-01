-- Cited editorial observations never mutate the imported vote or its source key.
create table public.meeting_vote_outcome_observations (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  vote_id uuid not null references public.meeting_votes(id),
  outcome text not null check (outcome in ('passed','failed','tabled','withdrawn')),
  source_url text not null check (length(source_url) <= 2000 and source_url ~ '^https://[^[:space:]]+$'),
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  locator text not null check (length(trim(locator)) between 1 and 2000),
  supersedes_id uuid references public.meeting_vote_outcome_observations(id),
  correction_reason text check (correction_reason is null or length(trim(correction_reason)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null
);
create index meeting_vote_outcomes_latest on public.meeting_vote_outcome_observations(vote_id,sequence desc);
alter table public.meeting_vote_outcome_observations enable row level security;
revoke all on public.meeting_vote_outcome_observations from anon,authenticated;
grant select on public.meeting_vote_outcome_observations to authenticated;
create policy "Admins inspect cited outcome observations" on public.meeting_vote_outcome_observations
  for select to authenticated using ((select public.is_admin()));
-- No client insert/update/delete grants or policies: append through the guarded RPC.
create function public.set_meeting_vote_outcome(p_vote_id uuid,p_outcome text,p_source_url text,
  p_document_sha256 text,p_locator text,p_supersedes_id uuid default null,p_correction_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare original public.meeting_votes; previous public.meeting_vote_outcome_observations;
  observation public.meeting_vote_outcome_observations;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_outcome is null or p_outcome not in ('passed','failed','tabled','withdrawn')
  or p_source_url is null or length(p_source_url)>2000 or p_source_url !~ '^https://[^[:space:]]+$'
  or p_document_sha256 is null or p_document_sha256 !~ '^[a-f0-9]{64}$'
  or coalesce(length(trim(p_locator)),0) not between 1 and 2000
  or (p_correction_reason is not null and length(trim(p_correction_reason)) not between 1 and 2000) then
  raise exception 'Outcome, HTTPS source URL, lowercase document SHA-256 and exact locator required; correction reason must be nonempty' using errcode='22023';
 end if;
 select * into original from public.meeting_votes where id=p_vote_id for update;
 if not found or not exists(select 1 from public.events e where e.id=original.meeting_id and e.is_meeting) then
  raise exception 'Existing meeting vote required' using errcode='22023'; end if;
 select * into previous from public.meeting_vote_outcome_observations where vote_id=p_vote_id order by sequence desc limit 1;
 if previous.id is not null and previous.outcome=p_outcome and previous.source_url=p_source_url
  and previous.document_sha256=p_document_sha256 and previous.locator=p_locator
  and previous.supersedes_id is not distinct from p_supersedes_id
  and previous.correction_reason is not distinct from p_correction_reason then
  return jsonb_build_object('status','unchanged','observation_id',previous.id,'outcome',previous.outcome);
 end if;
 if previous.id is distinct from p_supersedes_id then
  return jsonb_build_object('status','conflict','current_observation_id',previous.id,'outcome',coalesce(previous.outcome,original.outcome),
   'message','Read current evidence; an explicit correction must name the latest observation and explain the change');
 end if;
 if (previous.id is not null or (original.outcome is not null and original.outcome<>p_outcome)) and p_correction_reason is null then
  return jsonb_build_object('status','conflict','current_observation_id',previous.id,'outcome',coalesce(previous.outcome,original.outcome),
   'message','A public correction reason is required; original observations are retained');
 end if;
 insert into public.meeting_vote_outcome_observations(vote_id,outcome,source_url,document_sha256,locator,supersedes_id,correction_reason,created_by)
 values(p_vote_id,p_outcome,p_source_url,p_document_sha256,p_locator,p_supersedes_id,p_correction_reason,auth.uid()) returning * into observation;
 return jsonb_build_object('status','created','observation_id',observation.id,'outcome',observation.outcome);
end $$;
revoke all on function public.set_meeting_vote_outcome(uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.set_meeting_vote_outcome(uuid,text,text,text,text,uuid,text) to authenticated;

create schema if not exists meeting_private;
revoke all on schema meeting_private from public,anon,authenticated;
-- Called only after an established parent/participant gate. Never expose as an RPC.
create function meeting_private.outcome_evidence(p_vote_id uuid,p_original_outcome text) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('outcome',coalesce(latest.outcome,p_original_outcome),'original_outcome',p_original_outcome,
  'outcome_observation',case when latest.id is null then null else to_jsonb(latest)-'created_by'-'sequence'-'vote_id' end,
  'outcome_observations',coalesce((select jsonb_agg(to_jsonb(o)-'created_by'-'sequence'-'vote_id' order by o.sequence)
    from public.meeting_vote_outcome_observations o where o.vote_id=p_vote_id),'[]'::jsonb),
  'original_sources',coalesce((select jsonb_agg(s.payload||jsonb_build_object('provider',s.provider) order by s.provider,s.source_key)
    from public.meeting_record_sources s where s.vote_id=p_vote_id and s.kind='vote'),'[]'::jsonb))
 from (select 1) seed left join lateral (select * from public.meeting_vote_outcome_observations o
  where o.vote_id=p_vote_id order by o.sequence desc limit 1) latest on true;
$$;
revoke all on function meeting_private.outcome_evidence(uuid,text) from public,anon,authenticated;

-- Wrap the latest attachment/source-aware reader, not the obsolete base reader.
alter function public.get_meeting(uuid) rename to get_meeting_without_outcomes;
revoke all on function public.get_meeting_without_outcomes(uuid) from public,anon,authenticated;
create function public.get_meeting(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb;
begin
 base:=public.get_meeting_without_outcomes(p_id);
 if base->>'status'<>'ok' then return base; end if;
 return base||jsonb_build_object('votes',coalesce((select jsonb_agg(v||meeting_private.outcome_evidence((v->>'id')::uuid,v->>'outcome') order by position)
  from jsonb_array_elements(base->'votes') with ordinality t(v,position)),'[]'::jsonb));
end $$;
revoke all on function public.get_meeting(uuid) from public,anon,authenticated;
grant execute on function public.get_meeting(uuid) to anon,authenticated;

alter function public.get_person_meeting_votes(uuid,uuid,date,date,integer,integer) rename to get_person_meeting_votes_without_outcomes;
revoke all on function public.get_person_meeting_votes_without_outcomes(uuid,uuid,date,date,integer,integer) from public,anon,authenticated;
create function public.get_person_meeting_votes(p_person_id uuid,p_organization_id uuid default null,p_from date default null,p_to date default null,p_offset integer default 0,p_limit integer default 21)
returns setof jsonb language sql stable security definer set search_path='' as $$
 select v||meeting_private.outcome_evidence((v->>'vote_id')::uuid,v->>'outcome')
 from public.get_person_meeting_votes_without_outcomes(p_person_id,p_organization_id,p_from,p_to,p_offset,p_limit) with ordinality t(v,position) order by position;
$$;
revoke all on function public.get_person_meeting_votes(uuid,uuid,date,date,integer,integer) from public,anon,authenticated;
grant execute on function public.get_person_meeting_votes(uuid,uuid,date,date,integer,integer) to anon,authenticated;

alter function public.get_person_votes(uuid,integer,integer) rename to get_person_votes_without_outcomes;
revoke all on function public.get_person_votes_without_outcomes(uuid,integer,integer) from public,anon,authenticated;
create function public.get_person_votes(p_person_id uuid,p_offset integer default 0,p_limit integer default 21)
returns setof jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(v)-'ordinality'||meeting_private.outcome_evidence(v.vote_id,v.outcome)
 from public.get_person_votes_without_outcomes(p_person_id,p_offset,p_limit) with ordinality v order by ordinality;
$$;
revoke all on function public.get_person_votes(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.get_person_votes(uuid,integer,integer) to anon,authenticated;

alter function public.export_public_profile_rows(text,integer,integer) rename to export_public_profile_rows_without_outcomes;
revoke all on function public.export_public_profile_rows_without_outcomes(text,integer,integer) from public,anon,authenticated;
create function public.export_public_profile_rows(p_section text,p_offset integer default 0,p_limit integer default 500)
returns table(owner_id uuid,ordinal bigint,data jsonb) language sql stable security definer set search_path='' as $$
 select r.owner_id,r.ordinal,case when p_section='votes' then r.data||meeting_private.outcome_evidence((r.data->>'vote_id')::uuid,r.data->>'outcome') else r.data end
 from public.export_public_profile_rows_without_outcomes(p_section,p_offset,p_limit) r order by r.owner_id,r.ordinal;
$$;
revoke all on function public.export_public_profile_rows(text,integer,integer) from public,anon,authenticated;
grant execute on function public.export_public_profile_rows(text,integer,integer) to anon;

insert into audit.objects(table_name,key_columns,parents) values
 ('meeting_vote_outcome_observations',array['id'],'{"vote_id":"meeting_votes"}');
create trigger record_history after insert on public.meeting_vote_outcome_observations for each row execute function audit.capture();
create trigger frontend_rebuild_required after insert on public.meeting_vote_outcome_observations for each statement execute function frontend_private.mark_frontend_rebuild_required();
notify pgrst,'reload schema';

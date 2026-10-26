-- Source observations extend the existing meeting model, without inferring attendance.
alter table public.meeting_attendance drop constraint meeting_attendance_status_check;
alter table public.meeting_attendance add constraint meeting_attendance_status_check
  check (status in ('present','absent','excused','observed','unknown'));
alter table public.meeting_vote_choices drop constraint meeting_vote_choices_choice_check;
alter table public.meeting_vote_choices add constraint meeting_vote_choices_choice_check
  check (choice in ('yes','no','abstain','recused','unknown'));
create or replace function public.check_meeting_choice() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.choice <> 'unknown' and not exists (
    select 1 from public.meeting_attendance a where a.meeting_id=new.meeting_id
      and a.person_id=new.person_id and a.status in ('present','observed')
  ) then raise exception 'A cast ballot requires present or moment-observed attendance'; end if;
  return new;
end; $$;
create or replace function public.clear_absent_meeting_choices() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status not in ('present','observed') and old.status in ('present','observed') then
    delete from public.meeting_vote_choices where meeting_id=new.meeting_id and person_id=new.person_id and choice<>'unknown';
  end if;
  return new;
end; $$;

create table public.meeting_record_sources (
  meeting_id uuid not null references public.events(id) on delete cascade,
  provider text not null check (length(provider) between 1 and 100),
  source_key text not null check (length(source_key) between 1 and 500),
  kind text not null check (kind in ('attendance','vote','choice')),
  person_id uuid references public.people(id),
  vote_id uuid references public.meeting_votes(id) on delete cascade,
  payload jsonb not null,
  primary key(meeting_id,provider,source_key)
);
alter table public.meeting_record_sources enable row level security;
create policy "Admins read meeting source observations" on public.meeting_record_sources
  for select to authenticated using (public.is_admin());
grant select on public.meeting_record_sources to authenticated;

create function public.import_meeting_records(p_meeting_id uuid, p_provider text,
  p_records jsonb, p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; d jsonb; provenance jsonb; previous public.meeting_record_sources;
  parent public.meeting_record_sources; canonical uuid; person uuid; field text;
  idx integer:=0; made integer:=0; same integer:=0; results jsonb:='[]'; result jsonb;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_provider is null or length(p_provider) not between 1 and 100 then raise exception 'provider: 1–100 characters required'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 100
    or octet_length(p_records::text)>2097152 then raise exception 'records: 1–100 rows, maximum 2 MiB'; end if;
  -- One transaction per meeting; serializes different keys and concurrent replays.
  perform 1 from public.events where id=p_meeting_id and is_meeting for update;
  if not found then raise exception 'meeting_id: existing meeting required'; end if;
  begin
    for r in select value from jsonb_array_elements(p_records) loop
      idx:=idx+1; canonical:=null; person:=null; field:='record';
      if jsonb_typeof(r)<>'object' or exists(select 1 from jsonb_object_keys(r) k where k not in ('source_key','kind','data','provenance')) then
        raise exception 'Only source_key, kind, data and provenance are allowed'; end if;
      field:='source_key';
      if coalesce(length(r->>'source_key'),0) not between 1 and 500 then raise exception '1–500 characters required'; end if;
      field:='provenance'; provenance:=r->'provenance';
      if jsonb_typeof(provenance) is distinct from 'object'
        or coalesce(provenance->>'source_url','') !~ '^https://[^[:space:]]+$'
        or coalesce(provenance->>'document_sha256','') !~ '^[a-f0-9]{64}$'
        or coalesce(length(provenance->>'locator'),0) not between 1 and 2000 then
        raise exception 'HTTPS source_url, document_sha256 and exact item/round locator required'; end if;
      field:='data'; d:=r->'data';
      if jsonb_typeof(d) is distinct from 'object' then raise exception 'Object required'; end if;
      select * into previous from public.meeting_record_sources
        where meeting_id=p_meeting_id and provider=p_provider and source_key=r->>'source_key';
      if found then
        if previous.payload <> r then field:='source_key'; raise exception 'Source snapshot conflict: existing observation is immutable; reconcile explicitly'; end if;
        if previous.kind='attendance' and not exists(select 1 from public.meeting_attendance a where a.meeting_id=p_meeting_id and a.person_id=previous.person_id and a.status=d->>'status')
          or previous.kind='choice' and not exists(select 1 from public.meeting_vote_choices c where c.vote_id=previous.vote_id and c.person_id=previous.person_id and c.choice=d->>'choice')
          or previous.kind='vote' and not exists(select 1 from public.meeting_votes v where v.id=previous.vote_id and v.subject=d->>'subject'
            and v.description is not distinct from d->>'description' and v.outcome is not distinct from d->>'outcome' and v.position=coalesce((d->>'position')::integer,0)) then
          raise exception 'Canonical record changed or removed; reconcile explicitly'; end if;
        same:=same+1; canonical:=previous.vote_id; person:=previous.person_id;
      else
        case r->>'kind'
        when 'attendance' then
          if exists(select 1 from jsonb_object_keys(d) k where k not in ('person_id','status','evidence')) then raise exception 'Unknown attendance field'; end if;
          field:='data.person_id'; person:=(d->>'person_id')::uuid;
          if not exists(select 1 from public.people where id=person) then raise exception 'Existing person UUID required'; end if;
          field:='data.evidence';
          if coalesce(length(d->>'evidence'),0) not between 1 and 2000 then raise exception 'Attendance evidence required; rosters alone do not prove presence'; end if;
          field:='data.status';
          insert into public.meeting_attendance(meeting_id,person_id,status) values(p_meeting_id,person,d->>'status');
        when 'vote' then
          if exists(select 1 from jsonb_object_keys(d) k where k not in ('subject','description','outcome','position','agenda_context')) then raise exception 'Unknown motion field'; end if;
          field:='data.subject';
          insert into public.meeting_votes(meeting_id,subject,description,outcome,position)
            values(p_meeting_id,d->>'subject',d->>'description',d->>'outcome',coalesce((d->>'position')::integer,0)) returning id into canonical;
        when 'choice' then
          if exists(select 1 from jsonb_object_keys(d) k where k not in ('person_id','vote_source_key','choice','original_text')) then raise exception 'Unknown choice field'; end if;
          field:='data.vote_source_key';
          select * into parent from public.meeting_record_sources where meeting_id=p_meeting_id and provider=p_provider
            and source_key=d->>'vote_source_key' and kind='vote';
          if not found then raise exception 'Import the voting round before its choices'; end if;
          canonical:=parent.vote_id; field:='data.person_id'; person:=(d->>'person_id')::uuid;
          field:='data.original_text';
          if coalesce(length(d->>'original_text'),0) not between 1 and 2000 then raise exception 'Original choice text required'; end if;
          if lower(trim(d->>'original_text'))='vote not recorded' and d->>'choice'<>'unknown' then raise exception 'Vote Not Recorded must remain unknown'; end if;
          field:='data.choice';
          insert into public.meeting_vote_choices(vote_id,meeting_id,person_id,choice) values(canonical,p_meeting_id,person,d->>'choice');
        else field:='kind'; raise exception 'Use attendance, vote or choice';
        end case;
        insert into public.meeting_record_sources(meeting_id,provider,source_key,kind,person_id,vote_id,payload)
          values(p_meeting_id,p_provider,r->>'source_key',r->>'kind',person,canonical,r);
        made:=made+1;
      end if;
      results:=results||jsonb_build_array(jsonb_build_object('source_key',r->>'source_key','kind',r->>'kind','meeting_id',p_meeting_id,'vote_id',canonical,'person_id',person));
    end loop;
    result:=jsonb_build_object('status','ok','dry_run',p_dry_run,'created',made,'updated',0,'unchanged',same,'rejected',0,'records',results);
    -- Subtransaction rollback validates the actual constraints, without persisting dry runs.
    if coalesce(p_dry_run,true) then raise exception using errcode='P0040',message='dry run'; end if;
  exception when sqlstate 'P0040' then return result;
    when others then return jsonb_build_object('status','rejected','created',0,'updated',0,'unchanged',0,'rejected',jsonb_array_length(p_records),
      'errors',jsonb_build_array(jsonb_build_object('index',idx-1,'field',field,'message',sqlerrm,'code',sqlstate)));
  end;
  return result;
end; $$;
revoke all on function public.import_meeting_records(uuid,text,jsonb,boolean) from public;
grant execute on function public.import_meeting_records(uuid,text,jsonb,boolean) to authenticated;

-- Retain the established discovery gates and add source evidence without widening them.
create function public.get_person_meeting_votes(p_person_id uuid, p_organization_id uuid default null,
  p_from date default null, p_to date default null, p_offset integer default 0, p_limit integer default 21)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(vote) || jsonb_build_object('sources',coalesce((select jsonb_agg(s.payload || jsonb_build_object('provider',s.provider))
    from public.meeting_record_sources s where s.meeting_id=vote.meeting_id and s.vote_id=vote.vote_id
      and (s.kind='vote' or s.person_id=p_person_id)), '[]'::jsonb))
  from (
    select v.id vote_id,e.id meeting_id,e.title meeting_title,e.starts_at,o.name organization_name,
      v.subject,v.description,v.outcome,ch.choice
    from public.meeting_vote_choices ch join public.people p on p.id=ch.person_id
    join public.meeting_votes v on v.id=ch.vote_id and v.meeting_id=ch.meeting_id
    join public.events e on e.id=ch.meeting_id join public.calendars c on c.id=e.calendar_id
    join public.organizations o on o.id=c.organization_id left join public.elections el on el.id=e.election_id
    where ch.person_id=p_person_id and e.is_meeting
      and (p.visibility in ('public','unlisted') or public.is_admin())
      and (e.visibility='public' or public.is_admin()) and (c.visibility='public' or public.is_admin())
      and (e.election_id is null or el.visibility='public' or public.is_admin())
      and (p_organization_id is null or o.id=p_organization_id)
      and (p_from is null or e.starts_at>=p_from::timestamptz)
      and (p_to is null or e.starts_at<(p_to+1)::timestamptz)
    order by e.starts_at desc,e.id,v.position,v.id
    limit least(greatest(coalesce(p_limit,21),1),50) offset greatest(coalesce(p_offset,0),0)
  ) vote;
$$;
revoke all on function public.get_person_meeting_votes(uuid,uuid,date,date,integer,integer) from public;
grant execute on function public.get_person_meeting_votes(uuid,uuid,date,date,integer,integer) to anon,authenticated;

-- Wrap the established gate, enrich only already-visible records.
alter function public.get_meeting(uuid) rename to get_meeting_without_sources;
revoke all on function public.get_meeting_without_sources(uuid) from public,anon,authenticated;
create function public.get_meeting(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare base jsonb;
begin
  base:=public.get_meeting_without_sources(p_id);
  if base->>'status'<>'ok' then return base; end if;
  return base || jsonb_build_object('sources',coalesce((select jsonb_agg(s.payload || jsonb_build_object('provider',s.provider,'vote_id',s.vote_id,'person_id',s.person_id))
    from public.meeting_record_sources s where s.meeting_id=p_id and (s.person_id is null or exists(
      select 1 from public.people p where p.id=s.person_id and (p.visibility='public' or public.is_admin())))), '[]'::jsonb));
end; $$;
revoke all on function public.get_meeting(uuid) from public;
grant execute on function public.get_meeting(uuid) to anon,authenticated;

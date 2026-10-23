-- A meeting is a calendar event with minutes, attendance, motions and files.
alter table public.events
  add column is_meeting boolean not null default false,
  add column meeting_notes text,
  add column meeting_transcript text,
  add constraint meeting_content_requires_meeting check (
    is_meeting or (meeting_notes is null and meeting_transcript is null)
  ),
  add constraint meeting_not_election_date check (not is_meeting or election_id is null);

create table public.meeting_attendance (
  meeting_id uuid not null references public.events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'excused')),
  note text check (char_length(note) <= 500),
  primary key (meeting_id, person_id)
);

create table public.meeting_votes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.events (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 300),
  description text,
  outcome text check (outcome in ('passed', 'failed', 'tabled', 'withdrawn')),
  position integer not null default 0,
  unique (id, meeting_id)
);
create index meeting_votes_meeting_id_idx on public.meeting_votes (meeting_id, position);

create table public.meeting_vote_choices (
  vote_id uuid not null,
  meeting_id uuid not null,
  person_id uuid not null,
  choice text not null check (choice in ('yes', 'no', 'abstain', 'recused')),
  primary key (vote_id, person_id),
  foreign key (vote_id, meeting_id) references public.meeting_votes (id, meeting_id) on delete cascade,
  foreign key (meeting_id, person_id) references public.meeting_attendance (meeting_id, person_id) on delete cascade
);
create index meeting_vote_choices_meeting_id_idx on public.meeting_vote_choices (meeting_id);

create table public.meeting_attachments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.events (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_at timestamptz not null default now(),
  check (storage_path like meeting_id::text || '/%')
);
create index meeting_attachments_meeting_id_idx on public.meeting_attachments (meeting_id);

create function public.check_meeting_child() returns trigger
language plpgsql set search_path = '' as $$
declare target_id uuid;
begin
  target_id := new.meeting_id;
  if not exists (select 1 from public.events where id = target_id and is_meeting) then
    raise exception 'Meeting record requires an event marked as a meeting';
  end if;
  return new;
end;
$$;
create trigger meeting_attendance_parent before insert or update on public.meeting_attendance
  for each row execute function public.check_meeting_child();
create trigger meeting_votes_parent before insert or update on public.meeting_votes
  for each row execute function public.check_meeting_child();
create trigger meeting_attachments_parent before insert or update on public.meeting_attachments
  for each row execute function public.check_meeting_child();

create function public.check_meeting_choice() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.meeting_attendance a
    where a.meeting_id = new.meeting_id and a.person_id = new.person_id
      and a.status = 'present'
  ) then
    raise exception 'Only a present attendee can have a recorded vote';
  end if;
  return new;
end;
$$;
create trigger meeting_choice_present before insert or update on public.meeting_vote_choices
  for each row execute function public.check_meeting_choice();

-- Do not leave ballots behind when an attendee changes from present to absent.
create function public.clear_absent_meeting_choices() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'present' and old.status = 'present' then
    delete from public.meeting_vote_choices
      where meeting_id = new.meeting_id and person_id = new.person_id;
  end if;
  return new;
end;
$$;
create trigger meeting_attendance_clear_choices after update of status on public.meeting_attendance
  for each row execute function public.clear_absent_meeting_choices();

create function public.keep_meeting_with_records() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.is_meeting and not new.is_meeting and (
    exists (select 1 from public.meeting_attendance where meeting_id = old.id) or
    exists (select 1 from public.meeting_votes where meeting_id = old.id) or
    exists (select 1 from public.meeting_attachments where meeting_id = old.id)
  ) then
    raise exception 'Remove meeting attendance, votes and attachments before changing this to an event';
  end if;
  return new;
end;
$$;
create trigger event_keep_meeting_records before update of is_meeting on public.events
  for each row execute function public.keep_meeting_with_records();

alter table public.meeting_attendance enable row level security;
alter table public.meeting_votes enable row level security;
alter table public.meeting_vote_choices enable row level security;
alter table public.meeting_attachments enable row level security;

create policy "Admins manage meeting attendance" on public.meeting_attendance
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage meeting votes" on public.meeting_votes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage meeting choices" on public.meeting_vote_choices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage meeting attachments" on public.meeting_attachments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.meeting_attendance, public.meeting_votes,
  public.meeting_vote_choices, public.meeting_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-attachments', 'meeting-attachments', false, 26214400,
  array['application/pdf', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload meeting files" on storage.objects for insert to authenticated
  with check (bucket_id = 'meeting-attachments' and public.is_admin()
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.[a-z0-9]+$'
    and exists (select 1 from public.events e
      where e.id = split_part(name, '/', 1)::uuid and e.is_meeting));
create policy "Admins delete meeting files" on storage.objects for delete to authenticated
  using (bucket_id = 'meeting-attachments' and public.is_admin());
create function public.can_read_meeting_attachment(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meeting_attachments a
    join public.events e on e.id = a.meeting_id
    join public.calendars c on c.id = e.calendar_id
    where a.storage_path = p_path
      and ((e.visibility <> 'private' and c.visibility <> 'private')
        or (select public.is_admin()))
  );
$$;
revoke execute on function public.can_read_meeting_attachment(text) from public;
grant execute on function public.can_read_meeting_attachment(text) to anon, authenticated;
create policy "Visible meeting files can be downloaded" on storage.objects for select
  using (bucket_id = 'meeting-attachments' and public.can_read_meeting_attachment(name));

-- The existing event viewer exposes event columns, so align its private gate
-- with the admin-only rule before adding minutes and transcripts to events.
create or replace function public.get_event(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; c public.calendars; o public.organizations; el public.elections;
begin
  select * into e from public.events where id = p_id;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  select * into c from public.calendars where id = e.calendar_id;
  select * into o from public.organizations where id = c.organization_id;
  if e.election_id is not null then select * into el from public.elections where id = e.election_id; end if;
  if (e.visibility = 'private' or c.visibility = 'private'
      or (el.id is not null and el.visibility = 'private'))
      and not (select public.is_admin()) then
    return jsonb_build_object('status', 'private');
  end if;
  return jsonb_build_object('status', 'ok', 'event', to_jsonb(e) - 'search_document' - 'site_search_document',
    'calendar', to_jsonb(c), 'organization', to_jsonb(o),
    'election', case when el.id is null then null else jsonb_build_object(
      'id', el.id, 'slug', el.slug, 'name', el.name, 'visibility', el.visibility) end);
end;
$$;

-- Calendar browse needs the meeting marker, but never the potentially long
-- minutes or transcript for every event in a month.
create or replace function public.browse_calendar_events(
  p_start timestamptz default null, p_end timestamptz default null,
  p_offset integer default 0, p_public_only boolean default false
) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(e) - 'search_document' - 'site_search_document'
    - 'meeting_notes' - 'meeting_transcript' || jsonb_build_object(
    'calendar_name', c.name, 'calendar_slug', c.slug, 'calendar_visibility', c.visibility,
    'organization_id', o.id, 'organization_name', o.name, 'organization_slug', o.slug,
    'election_name', el.name, 'election_slug', el.slug, 'election_visibility', el.visibility)
  from public.events e
  join public.calendars c on c.id = e.calendar_id
  join public.organizations o on o.id = c.organization_id
  left join public.elections el on el.id = e.election_id
  where (p_end is null or e.starts_at < p_end)
    and (p_start is null or coalesce(e.ends_at, e.starts_at) >= p_start)
    and (e.visibility = 'public' or (not p_public_only and (select public.is_admin())))
    and (c.visibility = 'public' or (not p_public_only and (select public.is_admin())))
    and (e.election_id is null or el.visibility = 'public'
      or (not p_public_only and (select public.is_admin()) and el.id is not null))
  order by e.starts_at, e.id
  limit 500 offset greatest(coalesce(p_offset, 0), 0);
$$;

create function public.get_meeting(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare base jsonb; visible_person boolean;
begin
  base := public.get_event(p_id);
  if base->>'status' <> 'ok' then return base; end if;
  if coalesce((base->'event'->>'is_meeting')::boolean, false) = false then
    return jsonb_build_object('status', 'missing');
  end if;
  visible_person := (select public.is_admin());
  return base || jsonb_build_object(
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', p.id, 'full_name', p.full_name, 'slug', p.slug,
      'status', a.status, 'note', a.note) order by p.full_name)
      from public.meeting_attendance a join public.people p on p.id = a.person_id
      where a.meeting_id = p_id and (p.visibility = 'public' or visible_person)), '[]'::jsonb),
    'votes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'subject', v.subject, 'description', v.description,
      'outcome', v.outcome, 'choices', coalesce((select jsonb_agg(jsonb_build_object(
        'person_id', p.id, 'full_name', p.full_name, 'choice', ch.choice) order by p.full_name)
        from public.meeting_vote_choices ch join public.people p on p.id = ch.person_id
        where ch.vote_id = v.id and (p.visibility = 'public' or visible_person)), '[]'::jsonb))
      order by v.position, v.id) from public.meeting_votes v where v.meeting_id = p_id), '[]'::jsonb),
    'attachments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'file_name', a.file_name, 'storage_path', a.storage_path,
      'mime_type', a.mime_type, 'size_bytes', a.size_bytes) order by a.created_at, a.id)
      from public.meeting_attachments a where a.meeting_id = p_id), '[]'::jsonb));
end;
$$;
revoke execute on function public.get_meeting(uuid) from public;
grant execute on function public.get_meeting(uuid) to anon, authenticated;

-- Election key dates (early voting windows, registration/absentee deadlines,
-- election day) are calendar events tagged with the election they belong to.
-- Tagging an event links it into the community calendar automatically; the
-- election page then groups the events by `election_date_kind`.
--
-- Like the event/calendar rule, an event linked to an election is only visible
-- when its election is also visible, so a key date for a hidden election never
-- appears on the public calendar.

alter table public.events
  add column election_id uuid references public.elections (id) on delete set null,
  add column election_date_kind text
    check (
      election_date_kind is null
      or election_date_kind in (
        'election_day',
        'early_voting',
        'registration_deadline',
        'absentee_request_deadline',
        'absentee_return_deadline',
        'other'
      )
    );

comment on column public.events.election_id is
  'When set, this event is a key date for the election (early voting, deadline, election day).';
comment on column public.events.election_date_kind is
  'The kind of election key date: election_day, early_voting, registration_deadline, absentee_request_deadline, absentee_return_deadline, or other.';

alter table public.events
  add constraint events_election_date_kind_requires_election
  check (election_date_kind is null or election_id is not null);

create index events_election_id_idx on public.events (election_id);

-- search_events gains election columns and the election-visibility gate, so the
-- return type changes; the old function must be dropped and recreated.
drop function if exists public.search_events(text, uuid, uuid, boolean, int);

create function public.search_events(
  p_query text default '',
  p_organization_id uuid default null,
  p_calendar_id uuid default null,
  p_include_past boolean default false,
  p_limit int default 50
)
returns table (
  id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  location text,
  url text,
  visibility text,
  calendar_id uuid,
  calendar_name text,
  calendar_slug text,
  calendar_visibility text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  election_id uuid,
  election_date_kind text,
  election_name text,
  election_slug text,
  election_visibility text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q tsquery;
  lim int;
begin
  q := websearch_to_tsquery('english'::regconfig, coalesce(p_query, ''));
  lim := least(greatest(coalesce(p_limit, 50), 1), 100);

  return query
  select
    e.id,
    e.title,
    e.description,
    e.starts_at,
    e.ends_at,
    e.all_day,
    e.location,
    e.url,
    e.visibility,
    c.id,
    c.name,
    c.slug,
    c.visibility,
    o.id,
    o.name,
    o.slug,
    el.id,
    e.election_date_kind,
    el.name,
    el.slug,
    el.visibility
  from public.events e
  join public.calendars c on c.id = e.calendar_id
  join public.organizations o on o.id = c.organization_id
  left join public.elections el on el.id = e.election_id
  where (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_calendar_id is null or e.calendar_id = p_calendar_id)
    and (p_include_past or e.starts_at >= date_trunc('day', now()))
    and (
      e.visibility = 'public'
      or ((select auth.uid()) is not null and e.visibility in ('unlisted', 'private'))
    )
    and (
      c.visibility = 'public'
      or ((select auth.uid()) is not null and c.visibility in ('unlisted', 'private'))
    )
    and (
      e.election_id is null
      or el.visibility = 'public'
      or ((select auth.uid()) is not null and el.visibility in ('unlisted', 'private'))
    )
    and (numnode(q) = 0 or e.search_document @@ q)
  order by
    case when numnode(q) = 0 then null else ts_rank(e.search_document, q) end desc nulls last,
    e.starts_at asc
  limit lim;
end;
$$;

comment on function public.search_events(text, uuid, uuid, boolean, int) is
  'Full-text event search filtered by organization and/or calendar, honoring event, calendar, and election visibility.';

revoke execute on function public.search_events(text, uuid, uuid, boolean, int) from public;
grant execute on function public.search_events(text, uuid, uuid, boolean, int) to anon, authenticated;

-- get_event gains the linked election so the viewer can link back to it.
create or replace function public.get_event(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
  c public.calendars;
  o public.organizations;
  el public.elections;
begin
  select * into e from public.events where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  select * into c from public.calendars where id = e.calendar_id;
  select * into o from public.organizations where id = c.organization_id;
  if e.election_id is not null then
    select * into el from public.elections where id = e.election_id;
  end if;

  if (e.visibility = 'private' or c.visibility = 'private')
     and (select auth.uid()) is null then
    return jsonb_build_object('status', 'private');
  end if;

  if el.id is not null and el.visibility = 'private' and (select auth.uid()) is null then
    return jsonb_build_object('status', 'private');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'event', to_jsonb(e),
    'calendar', to_jsonb(c),
    'organization', to_jsonb(o),
    'election', case
      when el.id is null then null
      else jsonb_build_object(
        'id', el.id,
        'slug', el.slug,
        'name', el.name,
        'visibility', el.visibility
      )
    end
  );
end;
$$;

comment on function public.get_event(uuid) is
  'Returns {status: ok|private|missing, event?, calendar?, organization?, election?} for an event id, honoring visibility.';

-- Full election record with contests, candidates, and key dates for the
-- election page and the shared viewer. Applies the election visibility gate
-- and, for key dates, the event/calendar/election gates.
create function public.get_election(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.elections;
  o public.organizations;
  contests jsonb;
  dates jsonb;
begin
  select * into e from public.elections where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if e.visibility = 'private' and (select auth.uid()) is null then
    return jsonb_build_object('status', 'private');
  end if;

  if e.organization_id is not null then
    select * into o from public.organizations where id = e.organization_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'election_id', c.election_id,
        'office', c.office,
        'district', c.district,
        'seat', c.seat,
        'description', c.description,
        'partisan', c.partisan,
        'position', c.position,
        'candidates', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'person', jsonb_build_object(
                  'id', p.id,
                  'slug', p.slug,
                  'full_name', p.full_name,
                  'kind', p.kind,
                  'title', p.title,
                  'image_path', p.image_path,
                  'visibility', p.visibility
                ),
                'party', cc.party,
                'status', cc.status,
                'position', cc.position
              )
              order by cc.position, p.full_name
            )
            from public.contest_candidates cc
            join public.people p on p.id = cc.person_id
            where cc.contest_id = c.id
          ),
          '[]'::jsonb
        )
      )
      order by c.position, c.office, c.district
    ),
    '[]'::jsonb
  )
  into contests
  from public.contests c
  where c.election_id = e.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ev.id,
        'title', ev.title,
        'description', ev.description,
        'starts_at', ev.starts_at,
        'ends_at', ev.ends_at,
        'all_day', ev.all_day,
        'location', ev.location,
        'url', ev.url,
        'visibility', ev.visibility,
        'election_date_kind', ev.election_date_kind,
        'calendar_id', cal.id,
        'calendar_name', cal.name,
        'calendar_slug', cal.slug
      )
      order by ev.starts_at, ev.title
    ),
    '[]'::jsonb
  )
  into dates
  from public.events ev
  join public.calendars cal on cal.id = ev.calendar_id
  where ev.election_id = e.id
    and (
      ev.visibility = 'public'
      or ((select auth.uid()) is not null and ev.visibility in ('unlisted', 'private'))
    )
    and (
      cal.visibility = 'public'
      or ((select auth.uid()) is not null and cal.visibility in ('unlisted', 'private'))
    );

  return jsonb_build_object(
    'status', 'ok',
    'election', to_jsonb(e),
    'organization', case
      when o.id is null then null
      else jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name)
    end,
    'contests', contests,
    'dates', dates
  );
end;
$$;

comment on function public.get_election(uuid) is
  'Returns {status: ok|private|missing, election?, organization?, contests?, dates?} for an election id, honoring election and event visibility.';

revoke execute on function public.get_election(uuid) from public;
grant execute on function public.get_election(uuid) to anon, authenticated;

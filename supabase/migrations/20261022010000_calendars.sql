-- Calendars belong to exactly one organization (an organization can have many),
-- and events belong to exactly one calendar. Events carry the same visibility
-- and search rules as maps/layers:
--   public   = listed, searchable, visible to everyone
--   unlisted = reachable by uuid only; hidden from anonymous listings/search
--   private  = requires a signed-in user
-- An event is only visible when both it *and* its owning calendar are visible,
-- the same way a layer is gated by its map.

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.calendars is 'Calendars owned by an organization; each holds events.';
comment on column public.calendars.visibility is
  'public = listed/indexed; unlisted = reachable by uuid URL only; private = requires a signed-in user.';

create index calendars_organization_id_idx on public.calendars (organization_id);

alter table public.calendars enable row level security;

create policy "Public calendars are readable"
  on public.calendars
  for select
  using (visibility = 'public');

create policy "Private calendars are readable when signed in"
  on public.calendars
  for select
  to authenticated
  using (visibility = 'private');

create policy "Admins can read all calendars"
  on public.calendars
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert calendars"
  on public.calendars
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update calendars"
  on public.calendars
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete calendars"
  on public.calendars
  for delete
  to authenticated
  using (public.is_admin());

create trigger calendars_set_updated_at
  before update on public.calendars
  for each row
  execute function public.set_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text check (char_length(location) <= 300),
  url text check (char_length(url) <= 500),
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

comment on table public.events is
  'Calendar events. The visibility rule depends on the owning calendar too, so reads go through security definer RPCs.';
comment on column public.events.visibility is
  'public = listed/searchable; unlisted = reachable by uuid URL only; private = requires a signed-in user.';

create index events_calendar_id_idx on public.events (calendar_id);
create index events_starts_at_idx on public.events (starts_at);

-- Events are never read directly over the Data API: visibility depends on the
-- owning calendar as well, so public reads go through the RPCs below.
-- Admins still read the raw table for the admin UI.
alter table public.events enable row level security;

create policy "Admins can read all events"
  on public.events
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert events"
  on public.events
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete events"
  on public.events
  for delete
  to authenticated
  using (public.is_admin());

create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

alter table public.events
  add column search_document tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(location, '')), 'C')
  ) stored;

create index events_search_document_idx
  on public.events using gin (search_document);

-- Calendars the caller may see, with their owning organization. Anonymous
-- callers get public calendars only; signed-in callers also get unlisted and
-- private calendars. Unlisted calendars stay unreachable through the Data API.
create function public.list_calendars(p_organization_id uuid default null)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  visibility text,
  organization_id uuid,
  organization_name text,
  organization_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.slug,
    c.name,
    c.description,
    c.visibility,
    o.id,
    o.name,
    o.slug
  from public.calendars c
  join public.organizations o on o.id = c.organization_id
  where (p_organization_id is null or c.organization_id = p_organization_id)
    and (
      c.visibility = 'public'
      or ((select auth.uid()) is not null and c.visibility in ('unlisted', 'private'))
    )
  order by o.name, c.name;
$$;

comment on function public.list_calendars(uuid) is
  'Calendars the caller may see, optionally limited to one organization.';

revoke execute on function public.list_calendars(uuid) from public;
grant execute on function public.list_calendars(uuid) to anon, authenticated;

-- Full-text event search with optional organization/calendar filters. Both the
-- event and its calendar must be visible. Anonymous callers see public content
-- only; signed-in callers also see unlisted and private content. Past events are
-- excluded unless p_include_past is true.
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
  organization_slug text
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
    o.slug
  from public.events e
  join public.calendars c on c.id = e.calendar_id
  join public.organizations o on o.id = c.organization_id
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
    and (numnode(q) = 0 or e.search_document @@ q)
  order by
    case when numnode(q) = 0 then null else ts_rank(e.search_document, q) end desc nulls last,
    e.starts_at asc
  limit lim;
end;
$$;

comment on function public.search_events(text, uuid, uuid, boolean, int) is
  'Full-text event search filtered by organization and/or calendar, honoring event and calendar visibility.';

revoke execute on function public.search_events(text, uuid, uuid, boolean, int) from public;
grant execute on function public.search_events(text, uuid, uuid, boolean, int) to anon, authenticated;

-- Single-event lookup for the viewer shell. Unlisted events are never listed,
-- so they are reachable only by id here; private events (or events on a private
-- calendar) additionally require a session.
create function public.get_event(p_id uuid)
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
begin
  select * into e from public.events where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  select * into c from public.calendars where id = e.calendar_id;
  select * into o from public.organizations where id = c.organization_id;

  if (e.visibility = 'private' or c.visibility = 'private')
     and (select auth.uid()) is null then
    return jsonb_build_object('status', 'private');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'event', to_jsonb(e),
    'calendar', to_jsonb(c),
    'organization', to_jsonb(o)
  );
end;
$$;

comment on function public.get_event(uuid) is
  'Returns {status: ok|private|missing, event?, calendar?, organization?} for an event id, honoring visibility.';

revoke execute on function public.get_event(uuid) from public;
grant execute on function public.get_event(uuid) to anon, authenticated;

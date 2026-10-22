-- Date-range pagination keeps busy months complete without changing search_events.
alter table public.events add column category text check (char_length(category) <= 120);
-- Imported calendars already carry useful category names. Administrators can refine them.
update public.events e set category = c.name from public.calendars c where c.id = e.calendar_id;

create function public.browse_calendar_events(
  p_start timestamptz default null, p_end timestamptz default null,
  p_offset integer default 0, p_public_only boolean default false
) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(e) - 'search_document' - 'site_search_document' || jsonb_build_object(
    'calendar_name', c.name, 'calendar_slug', c.slug, 'calendar_visibility', c.visibility,
    'organization_id', o.id, 'organization_name', o.name, 'organization_slug', o.slug,
    'election_name', el.name, 'election_slug', el.slug, 'election_visibility', el.visibility)
  from public.events e
  join public.calendars c on c.id = e.calendar_id
  join public.organizations o on o.id = c.organization_id
  left join public.elections el on el.id = e.election_id
  where (p_end is null or e.starts_at < p_end)
    and (p_start is null or coalesce(e.ends_at, e.starts_at) >= p_start)
    and (e.visibility = 'public' or (not p_public_only and (select auth.uid()) is not null))
    and (c.visibility = 'public' or (not p_public_only and (select auth.uid()) is not null))
    and (e.election_id is null or el.visibility = 'public'
      or (not p_public_only and (select auth.uid()) is not null and el.id is not null))
  order by e.starts_at, e.id
  limit 500 offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.browse_calendar_events(timestamptz,timestamptz,integer,boolean) from public;
grant execute on function public.browse_calendar_events(timestamptz,timestamptz,integer,boolean) to anon, authenticated;

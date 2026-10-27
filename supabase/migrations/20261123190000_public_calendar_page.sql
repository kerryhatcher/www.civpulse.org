-- Events intentionally have no direct anonymous row policy. Compose the existing
-- gated public readers under caller permissions instead of selecting their tables.
-- Keep one output row per browsed event (including non-meetings) so the browser
-- API row cap and build pagination share the same deterministic 500-row boundary.
drop function public.export_public_calendar_meetings(integer,integer);
create function public.export_public_calendar_page(p_offset integer default 0)
returns setof jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    raise exception 'Public build export requires an anonymous caller' using errcode = '42501';
  end if;
  return query
  with events as materialized (
    select e from public.browse_calendar_events(p_offset=>greatest(coalesce(p_offset,0),0),p_public_only=>true) e
  ), details as materialized (
    select e,case when (e->>'is_meeting')::boolean then public.get_meeting((e->>'id')::uuid) end as meeting from events
  )
  select jsonb_build_object('event',d.e,'meeting',case when d.meeting is null then null else jsonb_build_object(
    'status',d.meeting->'status',
    'event',jsonb_build_object('id',d.e->'id','title',d.meeting->'event'->'title',
      'meeting_notes',d.meeting->'event'->'meeting_notes',
      'meeting_transcript',d.meeting->'event'->'meeting_transcript',
      'meeting_video_url',d.meeting->'event'->'meeting_video_url',
      'meeting_video_start_seconds',d.meeting->'event'->'meeting_video_start_seconds'),
    'attendance',d.meeting->'attendance','votes',d.meeting->'votes',
    'attachments',d.meeting->'attachments') end) from details d
  order by (d.e->>'starts_at')::timestamptz,d.e->>'id';
end;
$$;
revoke all on function public.export_public_calendar_page(integer) from public,authenticated;
grant execute on function public.export_public_calendar_page(integer) to anon;
comment on function public.export_public_calendar_page(integer) is
  'Anonymous-only public build composition of browse_calendar_events(public_only) and get_meeting. Caller permissions; no table/RLS changes or signed download URLs.';

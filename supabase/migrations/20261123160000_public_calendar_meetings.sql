-- Batch the existing gated reader for static publication without opening table
-- grants or making one HTTP request for every meeting. Only public parent chains
-- qualify; anonymous get_meeting also omits hidden attendance/vote participants.
create function public.export_public_calendar_meetings(p_offset integer default 0, p_limit integer default 100)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    raise exception 'Public build export requires an anonymous caller' using errcode = '42501';
  end if;
  return query
  with page as materialized (
    select e.id from public.events e
    join public.calendars c on c.id=e.calendar_id
    left join public.elections el on el.id=e.election_id
    where e.is_meeting and e.visibility='public' and c.visibility='public'
      and (e.election_id is null or el.visibility='public')
    order by e.id
    limit least(greatest(coalesce(p_limit,100),1),100)
    offset greatest(coalesce(p_offset,0),0)
  ), details as materialized (
    select p.id, public.get_meeting(p.id) as payload from page p
  )
  select jsonb_build_object('id',d.id,'meeting',jsonb_build_object(
    'status', d.payload->'status',
    'event',jsonb_build_object('id',d.id,'title',d.payload->'event'->'title',
      'meeting_notes',d.payload->'event'->'meeting_notes',
      'meeting_transcript',d.payload->'event'->'meeting_transcript',
      'meeting_video_url',d.payload->'event'->'meeting_video_url',
      'meeting_video_start_seconds',d.payload->'event'->'meeting_video_start_seconds'),
    'attendance',d.payload->'attendance','votes',d.payload->'votes',
    'attachments',d.payload->'attachments')) from details d order by d.id;
end;
$$;
revoke all on function public.export_public_calendar_meetings(integer,integer) from public, authenticated;
grant execute on function public.export_public_calendar_meetings(integer,integer) to anon;
comment on function public.export_public_calendar_meetings(integer,integer) is
  'Anonymous-only public calendar build export. Public event/calendar/election parents; existing get_meeting participant visibility; no signed download URLs.';

-- The export only selects public events/calendars/elections; anon already has
-- SELECT under their existing RLS. Keep the nested, visibility-aware meeting
-- reader, but do not add a privileged public entrypoint for the batch wrapper.
alter function public.export_public_calendar_meetings(integer,integer) security invoker;
comment on function public.export_public_calendar_meetings(integer,integer) is
  'Anonymous-only public calendar build export under caller RLS. Public event/calendar/election parents; existing get_meeting participant visibility; no signed download URLs.';

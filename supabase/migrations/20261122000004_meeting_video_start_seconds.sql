alter table public.events
  add column meeting_video_start_seconds integer,
  add constraint meeting_video_start_nonnegative check (meeting_video_start_seconds >= 0),
  drop constraint meeting_content_requires_meeting,
  add constraint meeting_content_requires_meeting check (
    is_meeting or (meeting_notes is null and meeting_transcript is null
      and meeting_video_url is null and meeting_video_start_seconds is null)
  );
comment on column public.events.meeting_video_start_seconds is
  'Optional recording start offset in whole seconds, independent of the shared video URL. Null uses the URL/default start; zero explicitly starts at the beginning.';

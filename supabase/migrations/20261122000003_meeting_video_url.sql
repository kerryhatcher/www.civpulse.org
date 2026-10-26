alter table public.events
  add column meeting_video_url text,
  add constraint meeting_video_url_valid check (meeting_video_url is null or (
    char_length(meeting_video_url) <= 2048 and meeting_video_url ~ '^https://[^[:space:]]+$')),
  drop constraint meeting_content_requires_meeting,
  add constraint meeting_content_requires_meeting check (
    is_meeting or (meeting_notes is null and meeting_transcript is null and meeting_video_url is null)
  );

comment on column public.events.meeting_video_url is
  'Optional HTTPS recording URL. YouTube and Vimeo render as embedded players; other hosts render as links. Multiple meetings may share a recording.';

-- Carry forward explicitly labeled recordings already saved in meeting descriptions.
-- Preserve the description, including the explanation of shared continuous streams.
update public.events
set meeting_video_url = substring(description from
  'Meeting recording:[[:space:]]+(https://(www[.])?(youtube[.]com|youtu[.]be|vimeo[.]com)/[^[:space:]]+)')
where is_meeting and description ~
  'Meeting recording:[[:space:]]+https://(www[.])?(youtube[.]com|youtu[.]be|vimeo[.]com)/';

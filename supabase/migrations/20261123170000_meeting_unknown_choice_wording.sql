-- Named source rows include the member after a colon. Preserve their unknown
-- meaning as well as the bare label; an importer must not normalize either to Yes/No.
create function public.check_meeting_source_choice_wording() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind='choice'
    and lower(trim(new.payload->'data'->>'original_text')) ~ '^vote[[:space:]]+not[[:space:]]+recorded([[:space:]]*:|[[:space:]]*$)'
    and new.payload->'data'->>'choice' is distinct from 'unknown' then
    raise exception 'Vote Not Recorded must remain unknown';
  end if;
  return new;
end; $$;
revoke all on function public.check_meeting_source_choice_wording() from public;
create trigger meeting_source_choice_wording before insert on public.meeting_record_sources
  for each row execute function public.check_meeting_source_choice_wording();

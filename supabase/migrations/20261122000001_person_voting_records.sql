-- A person's profile is a discovery surface: unlisted meetings must remain
-- reachable only from their direct links, just like calendar browse results.
create function public.get_person_votes(
  p_person_id uuid, p_offset integer default 0, p_limit integer default 21
) returns table (
  vote_id uuid, meeting_id uuid, meeting_title text, starts_at timestamptz,
  organization_name text, subject text, description text, outcome text, choice text
)
language sql stable security definer set search_path = '' as $$
  select v.id, e.id, e.title, e.starts_at, o.name,
    v.subject, v.description, v.outcome, ch.choice
  from public.meeting_vote_choices ch
  join public.people p on p.id = ch.person_id
  join public.meeting_votes v on v.id = ch.vote_id and v.meeting_id = ch.meeting_id
  join public.events e on e.id = ch.meeting_id
  join public.calendars c on c.id = e.calendar_id
  join public.organizations o on o.id = c.organization_id
  left join public.elections el on el.id = e.election_id
  where ch.person_id = p_person_id and e.is_meeting
    and (p.visibility in ('public', 'unlisted') or (select public.is_admin()))
    and (e.visibility = 'public' or (select public.is_admin()))
    and (c.visibility = 'public' or (select public.is_admin()))
    and (e.election_id is null or el.visibility = 'public' or (select public.is_admin()))
  order by e.starts_at desc, e.id, v.position, v.id
  limit least(greatest(coalesce(p_limit, 21), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke execute on function public.get_person_votes(uuid, integer, integer) from public;
grant execute on function public.get_person_votes(uuid, integer, integer) to anon, authenticated;
comment on function public.get_person_votes(uuid, integer, integer) is
  'Paginated recorded choices for a visible person; public meetings only except for admins.';

create index meeting_vote_choices_person_idx
  on public.meeting_vote_choices (person_id, meeting_id, vote_id);

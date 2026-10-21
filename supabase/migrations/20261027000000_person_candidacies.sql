-- Profile history is a discovery surface: anonymous visitors see public
-- elections only. Signed-in visitors follow the election search visibility rule.
create function public.get_person_candidacies(p_person_id uuid)
returns table (
  contest_id uuid,
  office text,
  district text,
  seat text,
  party text,
  status text,
  is_write_in boolean,
  election_id uuid,
  election_name text,
  election_slug text,
  election_date date,
  election_visibility text,
  is_current boolean
)
language sql stable security definer set search_path = '' as $$
  with visible as (
    select c.id as contest_id, c.office, c.district, c.seat,
      cc.party, cc.status, cc.is_write_in,
      e.id as election_id, e.name as election_name, e.slug as election_slug,
      e.election_date, e.visibility as election_visibility,
      (e.election_date >= (now() at time zone 'America/New_York')::date
        and cc.status in ('running', 'runoff', 'pending')) as is_current
    from public.contest_candidates cc
    join public.contests c on c.id = cc.contest_id
    join public.elections e on e.id = c.election_id
    join public.people p on p.id = cc.person_id
    where cc.person_id = p_person_id
      and (p.visibility in ('public', 'unlisted') or (select auth.uid()) is not null)
      and (e.visibility = 'public' or (select auth.uid()) is not null)
  )
  select * from visible
  order by is_current desc,
    case when is_current then election_date end asc,
    case when not is_current then election_date end desc,
    election_name, office, district, seat, contest_id;
$$;
revoke execute on function public.get_person_candidacies(uuid) from public;
grant execute on function public.get_person_candidacies(uuid) to anon, authenticated;
comment on function public.get_person_candidacies(uuid) is
  'Visible candidacies for a viewable person. Current means an active status and an election today or later in Georgia; completed or withdrawn candidacies are past.';

-- Ballot method belongs to the candidacy, not the person's name or party.
alter table public.contest_candidates
  add column is_write_in boolean not null default false;
comment on column public.contest_candidates.is_write_in is
  'Certified write-in candidate whose name is not printed on the ballot.';

-- Mark the eleven certified November write-ins researched from the official
-- county-posted certification. Do not infer write-in status from a missing party.
update public.contest_candidates cc
set is_write_in = true
from public.contests c, public.elections e, public.people p
where cc.contest_id = c.id and c.election_id = e.id and cc.person_id = p.id
  and e.slug = '2026-11-03-general-election'
  and (
    (c.office = 'United States Senate' and p.slug in (
      'elbert-arthur-bartell', 'christina-clement', 'cassandra-easton'
    ))
    or (c.office = 'Governor of Georgia' and p.slug in (
      'david-c-byrne', 'jacqueline-angela-dacosta', 'deb-broughton-davis',
      'justin-laster', 'milton-j-lofton', 'david-leon-moreland',
      'leland-j-olinger-iii', 'andrew-pacetti'
    ))
  );

create or replace function public.get_election(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.elections;
  o public.organizations;
  contests jsonb;
  dates jsonb;
begin
  select * into e from public.elections where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if e.visibility = 'private' and (select auth.uid()) is null then
    return jsonb_build_object('status', 'private');
  end if;

  if e.organization_id is not null then
    select * into o from public.organizations where id = e.organization_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'election_id', c.election_id,
        'office', c.office,
        'district', c.district,
        'seat', c.seat,
        'description', c.description,
        'partisan', c.partisan,
        'position', c.position,
        'candidates', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'person', jsonb_build_object(
                  'id', p.id,
                  'slug', p.slug,
                  'full_name', p.full_name,
                  'kind', p.kind,
                  'title', p.title,
                  'image_path', p.image_path,
                  'visibility', p.visibility
                ),
                'party', cc.party,
                'is_write_in', cc.is_write_in,
                'status', cc.status,
                'position', cc.position
              )
              order by cc.position, p.full_name
            )
            from public.contest_candidates cc
            join public.people p on p.id = cc.person_id
            where cc.contest_id = c.id
          ),
          '[]'::jsonb
        )
      )
      order by c.position, c.office, c.district
    ),
    '[]'::jsonb
  )
  into contests
  from public.contests c
  where c.election_id = e.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ev.id,
        'title', ev.title,
        'description', ev.description,
        'starts_at', ev.starts_at,
        'ends_at', ev.ends_at,
        'all_day', ev.all_day,
        'location', ev.location,
        'url', ev.url,
        'visibility', ev.visibility,
        'election_date_kind', ev.election_date_kind,
        'calendar_id', cal.id,
        'calendar_name', cal.name,
        'calendar_slug', cal.slug
      )
      order by ev.starts_at, ev.title
    ),
    '[]'::jsonb
  )
  into dates
  from public.events ev
  join public.calendars cal on cal.id = ev.calendar_id
  where ev.election_id = e.id
    and (
      ev.visibility = 'public'
      or ((select auth.uid()) is not null and ev.visibility in ('unlisted', 'private'))
    )
    and (
      cal.visibility = 'public'
      or ((select auth.uid()) is not null and cal.visibility in ('unlisted', 'private'))
    );

  return jsonb_build_object(
    'status', 'ok',
    'election', to_jsonb(e),
    'organization', case
      when o.id is null then null
      else jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name)
    end,
    'contests', contests,
    'dates', dates
  );
end;
$$;

comment on function public.get_election(uuid) is
  'Returns {status: ok|private|missing, election?, organization?, contests?, dates?} for an election id, honoring election and event visibility.';

revoke execute on function public.get_election(uuid) from public;
grant execute on function public.get_election(uuid) to anon, authenticated;

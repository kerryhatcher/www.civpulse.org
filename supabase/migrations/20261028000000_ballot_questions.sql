-- Ballot questions inherit election visibility; direct table access is admin-only.
create table public.ballot_questions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  question_text text not null check (char_length(btrim(question_text)) between 1 and 20000),
  description text check (char_length(description) <= 4000),
  jurisdiction text check (char_length(jurisdiction) <= 200),
  choices text[] not null default array['Yes', 'No']
    check (array_ndims(choices) = 1 and cardinality(choices) between 2 and 20
      and array_position(choices, null) is null
      and not (choices && array['']) and char_length(array_to_string(choices, '')) <= 4000),
  source_url text check (char_length(source_url) <= 2000 and source_url ~ '^https?://[^[:space:]]+$'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ballot_questions_election_order_idx on public.ballot_questions(election_id, position);
alter table public.ballot_questions enable row level security;
revoke all on public.ballot_questions from anon, authenticated;
grant select, insert, update, delete on public.ballot_questions to authenticated;
grant all on public.ballot_questions to service_role;
create policy "Admins can read ballot questions" on public.ballot_questions
  for select to authenticated using ((select public.is_admin()));
create policy "Admins can insert ballot questions" on public.ballot_questions
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins can update ballot questions" on public.ballot_questions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete ballot questions" on public.ballot_questions
  for delete to authenticated using ((select public.is_admin()));
create trigger ballot_questions_set_updated_at before update on public.ballot_questions
  for each row execute function public.set_updated_at();
comment on table public.ballot_questions is
  'Referendums, amendments, and other ballot questions. Public reads go through get_election; writes require an admin.';

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
  questions jsonb;
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

  select coalesce(jsonb_agg(to_jsonb(q) - 'created_at' - 'updated_at' order by q.position, q.title, q.id), '[]'::jsonb)
  into questions from public.ballot_questions q where q.election_id = e.id;

  return jsonb_build_object(
    'status', 'ok',
    'election', to_jsonb(e),
    'organization', case
      when o.id is null then null
      else jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name)
    end,
    'contests', contests,
    'ballot_questions', questions,
    'dates', dates
  );
end;
$$;

comment on function public.get_election(uuid) is
  'Returns {status: ok|private|missing, election?, organization?, contests?, ballot_questions?, dates?} for an election id, honoring election and event visibility.';

revoke execute on function public.get_election(uuid) from public;
grant execute on function public.get_election(uuid) to anon, authenticated;

-- Elections are organized by the date of the actual election. Each election has
-- one or more key dates (early voting windows and deadlines) that are stored as
-- calendar events tagged with the election, and a set of contests for the
-- offices being elected.
--
-- Elections carry the same visibility rules as people/maps/layers/events:
--   public   = listed, searchable, visible to everyone
--   unlisted = reachable by uuid only; hidden from anonymous listings/search
--   private  = requires a signed-in user
-- Contests and candidates inherit the election's visibility, so they have no
-- separate visibility column: reads go through get_election, which gates the
-- whole record. Hidden elections therefore never leak their contests.

create table public.elections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 200),
  election_date date not null,
  kind text not null default 'general'
    check (kind in (
      'special',
      'special_runoff',
      'primary',
      'primary_runoff',
      'general',
      'general_runoff',
      'other'
    )),
  description text check (char_length(description) <= 4000),
  -- The jurisdiction or board that administers the election (optional).
  organization_id uuid references public.organizations (id) on delete set null,
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.elections is
  'An election on a specific date, with contests and calendar-linked key dates.';
comment on column public.elections.kind is
  'The election type: special, special_runoff, primary, primary_runoff, general, general_runoff, or other.';
comment on column public.elections.visibility is
  'public = listed/indexed; unlisted = reachable by uuid URL only; private = requires a signed-in user.';

create index elections_election_date_idx on public.elections (election_date);
create index elections_organization_id_idx on public.elections (organization_id);

alter table public.elections enable row level security;

create policy "Public elections are readable"
  on public.elections
  for select
  using (visibility = 'public');

create policy "Private elections are readable when signed in"
  on public.elections
  for select
  to authenticated
  using (visibility = 'private');

create policy "Admins can read all elections"
  on public.elections
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert elections"
  on public.elections
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update elections"
  on public.elections
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete elections"
  on public.elections
  for delete
  to authenticated
  using (public.is_admin());

create trigger elections_set_updated_at
  before update on public.elections
  for each row
  execute function public.set_updated_at();

alter table public.elections
  add column search_document tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')
  ) stored;

create index elections_search_document_idx
  on public.elections using gin (search_document);

-- Contests: the offices being elected within an election (US Senator, state
-- representative, school board, etc.). No public select policy: a contest is
-- only visible when its election is, so reads go through get_election.
create table public.contests (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  office text not null check (char_length(office) between 1 and 160),
  district text check (char_length(district) <= 160),
  seat text check (char_length(seat) <= 160),
  description text check (char_length(description) <= 2000),
  partisan boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contests is
  'A race for an office within an election; candidates are people linked to it.';
comment on column public.contests.office is
  'The office being elected, e.g. "US Senator", "State Representative", "School Board".';
comment on column public.contests.position is
  'Sort order within the election; lower numbers appear first.';

create index contests_election_id_idx on public.contests (election_id);

alter table public.contests enable row level security;

create policy "Admins can read all contests"
  on public.contests
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert contests"
  on public.contests
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update contests"
  on public.contests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete contests"
  on public.contests
  for delete
  to authenticated
  using (public.is_admin());

create trigger contests_set_updated_at
  before update on public.contests
  for each row
  execute function public.set_updated_at();

-- Candidates link a person to a contest. The person record holds the profile;
-- this join holds the race-specific facts (party, status).
create table public.contest_candidates (
  contest_id uuid not null references public.contests (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  party text check (char_length(party) <= 120),
  status text not null default 'running'
    check (status in ('running', 'withdrawn', 'won', 'lost', 'runoff', 'pending')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (contest_id, person_id)
);

comment on table public.contest_candidates is
  'Links a person to a contest as a candidate, with party and status.';
comment on column public.contest_candidates.status is
  'running, withdrawn, won, lost, runoff, or pending.';

create index contest_candidates_person_id_idx on public.contest_candidates (person_id);

alter table public.contest_candidates enable row level security;

create policy "Admins manage candidates"
  on public.contest_candidates
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Full-text election search. Anonymous callers see public elections only;
-- signed-in callers also see unlisted and private elections.
create function public.search_elections(p_query text default '', p_limit int default 50)
returns setof public.elections
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q tsquery;
  lim int;
begin
  q := websearch_to_tsquery('english'::regconfig, coalesce(p_query, ''));
  lim := least(greatest(coalesce(p_limit, 50), 1), 100);

  if numnode(q) = 0 then
    return query
      select e.*
      from public.elections e
      where e.visibility = 'public'
         or ((select auth.uid()) is not null and e.visibility in ('unlisted', 'private'))
      order by
        (e.election_date >= current_date) desc,
        case when e.election_date >= current_date then e.election_date end asc nulls last,
        case when e.election_date < current_date then e.election_date end desc nulls last,
        e.name;
  end if;

  return query
    select e.*
    from public.elections e
    where (
        e.visibility = 'public'
        or ((select auth.uid()) is not null and e.visibility in ('unlisted', 'private'))
      )
      and e.search_document @@ q
    order by ts_rank(e.search_document, q) desc, e.election_date desc, e.name;
  return;
end;
$$;

comment on function public.search_elections(text, int) is
  'Full-text election search. Anonymous callers see public elections; signed-in callers also see unlisted and private elections.';

revoke execute on function public.search_elections(text, int) from public;
grant execute on function public.search_elections(text, int) to anon, authenticated;

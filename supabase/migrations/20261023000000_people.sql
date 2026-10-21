-- People: CRM-style records for officials, elected office holders, and
-- candidates for office. They carry the same visibility rules as
-- maps/layers/events:
--   public   = listed, searchable, visible to everyone
--   unlisted = reachable by uuid only; hidden from anonymous listings/search
--   private  = requires a signed-in user
-- People are linked to organizations with a role (member, owner, officer, CEO,
-- employee, etc.). Affiliations are gated by the person's visibility, so reads
-- go through security definer RPCs for unlisted/private rows.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  full_name text not null check (char_length(full_name) between 1 and 160),
  kind text not null default 'other'
    check (kind in ('elected_official', 'appointed_official', 'candidate', 'other')),
  title text check (char_length(title) <= 160),
  description text check (char_length(description) <= 4000),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 40),
  website_url text check (char_length(website_url) <= 500),
  social_url text check (char_length(social_url) <= 500),
  image_path text check (char_length(image_path) <= 500),
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.people is
  'Public records for officials, elected office holders, candidates, and other civic figures.';
comment on column public.people.kind is
  'The record type: elected_official, appointed_official, candidate, or other.';
comment on column public.people.visibility is
  'public = listed/indexed; unlisted = reachable by uuid URL only; private = requires a signed-in user.';

alter table public.people enable row level security;

create policy "Public people are readable"
  on public.people
  for select
  using (visibility = 'public');

create policy "Private people are readable when signed in"
  on public.people
  for select
  to authenticated
  using (visibility = 'private');

create policy "Admins can read all people"
  on public.people
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert people"
  on public.people
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update people"
  on public.people
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete people"
  on public.people
  for delete
  to authenticated
  using (public.is_admin());

create trigger people_set_updated_at
  before update on public.people
  for each row
  execute function public.set_updated_at();

create table public.person_organizations (
  person_id uuid not null references public.people (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null check (char_length(role) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (person_id, organization_id)
);

comment on table public.person_organizations is
  'Links a person to an organization with a role (member, owner, officer, CEO, employee, …).';
comment on column public.person_organizations.role is
  'The person''s relationship to the organization; free text so uncommon roles are still possible.';

create index person_organizations_organization_id_idx
  on public.person_organizations (organization_id);

alter table public.person_organizations enable row level security;

-- Public affiliations are readable only for public people so the static build
-- can render organization pages. Unlisted people (and their links) stay
-- unreachable through the Data API and are reached via get_person instead.
create policy "Affiliations of public people are readable"
  on public.person_organizations
  for select
  using (
    exists (
      select 1
      from public.people p
      where p.id = person_organizations.person_id
        and p.visibility = 'public'
    )
  );

create policy "Affiliations of private people are readable when signed in"
  on public.person_organizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.people p
      where p.id = person_organizations.person_id
        and p.visibility = 'private'
    )
  );

create policy "Admins manage affiliations"
  on public.person_organizations
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Public profile image storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'person-images',
  'person-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Person images are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'person-images');

create policy "Admins can upload person images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'person-images' and public.is_admin());

create policy "Admins can update person images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'person-images' and public.is_admin());

create policy "Admins can remove person images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'person-images' and public.is_admin());

-- Full-text search over people: full_name (weight A), title (weight B), and
-- description (weight C).
alter table public.people
  add column search_document tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(full_name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored;

create index people_search_document_idx
  on public.people using gin (search_document);

-- Full-text people search. Anonymous callers see public people only; signed-in
-- callers also see unlisted and private people. Unlisted rows stay unreachable
-- through the Data API.
create function public.search_people(p_query text default '', p_limit int default 20)
returns setof public.people
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
  lim := least(greatest(coalesce(p_limit, 20), 1), 50);

  if numnode(q) = 0 then
    return query
      select p.*
      from public.people p
      where p.visibility = 'public'
         or ((select auth.uid()) is not null and p.visibility in ('unlisted', 'private'))
      order by p.full_name
      limit lim;
  end if;

  return query
    select p.*
    from public.people p
    where (
        p.visibility = 'public'
        or ((select auth.uid()) is not null and p.visibility in ('unlisted', 'private'))
      )
      and p.search_document @@ q
    order by ts_rank(p.search_document, q) desc, p.full_name
    limit lim;
end;
$$;

comment on function public.search_people(text, int) is
  'Full-text people search. Anonymous callers see public people; signed-in callers also see unlisted and private people.';

revoke execute on function public.search_people(text, int) from public;
grant execute on function public.search_people(text, int) to anon, authenticated;

-- Single-person lookup for the viewer shell. Unlisted people are never listed,
-- so they are reachable only by id here; private people additionally require a
-- session. Affiliations are returned for anyone allowed to see the person.
create function public.get_person(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.people;
  orgs jsonb;
begin
  select * into p from public.people where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if p.visibility = 'private' and (select auth.uid()) is null then
    return jsonb_build_object('status', 'private');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'slug', o.slug,
        'name', o.name,
        'role', po.role
      )
      order by o.name
    ),
    '[]'::jsonb
  )
  into orgs
  from public.person_organizations po
  join public.organizations o on o.id = po.organization_id
  where po.person_id = p.id;

  return jsonb_build_object(
    'status', 'ok',
    'person', to_jsonb(p),
    'organizations', orgs
  );
end;
$$;

comment on function public.get_person(uuid) is
  'Returns {status: ok|private|missing, person?, organizations?} for a person id, honoring visibility.';

revoke execute on function public.get_person(uuid) from public;
grant execute on function public.get_person(uuid) to anon, authenticated;

-- Offices are durable seats; office_terms record actual service, independently
-- of candidacies. Returning to office creates another term, not another person.
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  district text not null default '' check (char_length(district) <= 160),
  seat text not null default '' check (char_length(seat) <= 160),
  description text check (char_length(description) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name, district, seat)
);
create table public.office_terms (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete cascade,
  selection_method text not null check (selection_method in ('elected', 'appointed')),
  starts_on date not null check (isfinite(starts_on)),
  ends_on date check (isfinite(ends_on) and ends_on >= starts_on),
  source_url text check (char_length(source_url) <= 2000 and source_url ~* '^https?://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, person_id, starts_on)
);
create index office_terms_person_idx on public.office_terms(person_id);
create index office_terms_office_idx on public.office_terms(office_id);
create trigger offices_updated_at before update on public.offices
  for each row execute function public.set_updated_at();
create trigger office_terms_updated_at before update on public.office_terms
  for each row execute function public.set_updated_at();
alter table public.offices enable row level security;
alter table public.office_terms enable row level security;
revoke all on public.offices, public.office_terms from anon, authenticated;
grant select on public.offices to anon;
grant select, insert, update, delete on public.offices, public.office_terms to authenticated;
create policy offices_read on public.offices for select to anon, authenticated using (true);
create policy offices_insert on public.offices for insert to authenticated with check (public.is_admin());
create policy offices_update on public.offices for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy offices_delete on public.offices for delete to authenticated using (public.is_admin());
-- Relationships are exposed only through gated profile RPCs, never the Data API.
create policy office_terms_read on public.office_terms for select to authenticated using (public.is_admin());
create policy office_terms_insert on public.office_terms for insert to authenticated with check (public.is_admin());
create policy office_terms_update on public.office_terms for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy office_terms_delete on public.office_terms for delete to authenticated using (public.is_admin());

-- Person UUID access follows get_person; organization discovery follows search_people.
create function public.get_office_terms(p_person_id uuid default null, p_organization_id uuid default null)
returns table (
  id uuid, office_id uuid, office_name text, district text, seat text,
  organization_id uuid, organization_name text, organization_slug text,
  person_id uuid, person_name text, person_slug text, person_visibility text,
  selection_method text, starts_on date, ends_on date, source_url text, service_status text
)
language sql stable security definer set search_path = '' as $$
  select t.id, o.id, o.name, o.district, o.seat, org.id, org.name, org.slug,
    p.id, p.full_name, p.slug, p.visibility, t.selection_method, t.starts_on, t.ends_on, t.source_url,
    case when t.starts_on > (now() at time zone 'America/New_York')::date then 'upcoming'
      when t.ends_on < (now() at time zone 'America/New_York')::date then 'former'
      else 'current' end
  from public.office_terms t
  join public.offices o on o.id = t.office_id
  join public.organizations org on org.id = o.organization_id
  join public.people p on p.id = t.person_id
  where (p_person_id is not null or p_organization_id is not null)
    and (p_person_id is null or p.id = p_person_id)
    and (p_organization_id is null or org.id = p_organization_id)
    and (p.visibility = 'public' or (select auth.uid()) is not null
      or (p_person_id is not null and p.visibility = 'unlisted'))
  order by t.starts_on desc, o.name, p.full_name, t.id;
$$;
revoke all on function public.get_office_terms(uuid, uuid) from public;
grant execute on function public.get_office_terms(uuid, uuid) to anon, authenticated;
comment on table public.offices is 'Public office/seat belonging to an organization; distinct from a person or election contest.';
comment on column public.office_terms.ends_on is 'Last day of service, inclusive; null means ongoing. Future starts are upcoming, not current.';

-- Concrete example, only where the existing Jon Ossoff profile is present.
-- Source: https://www.senate.gov/states/GA/senators.htm
-- https://www.ossoff.senate.gov/press-releases/photos-video-u-s-senator-jon-ossoff-sworn-in-to-u-s-senate/
do $$
declare org_id uuid; senator_id uuid; office_uuid uuid;
begin
  select id into senator_id from public.people where slug = 'jon-ossoff';
  if senator_id is null then return; end if;
  select id into org_id from public.organizations
    where slug in ('united-states-senate', 'us-senate', 'u-s-senate')
      or lower(name) in ('united states senate', 'u.s. senate', 'us senate')
    order by created_at, id limit 1;
  if org_id is null then
    insert into public.organizations(name, slug, website_url)
      values ('United States Senate', 'united-states-senate', 'https://www.senate.gov/') returning id into org_id;
  end if;
  insert into public.offices(organization_id, name, district, seat)
    values (org_id, 'U.S. Senator', 'Georgia', 'Class 2') returning id into office_uuid;
  insert into public.office_terms(office_id, person_id, selection_method, starts_on, source_url)
    values (office_uuid, senator_id, 'elected', '2021-01-20', 'https://www.senate.gov/states/GA/senators.htm');
end;
$$;

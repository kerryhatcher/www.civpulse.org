-- One source-backed relationship, with a label for each organization's profile.
create table public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  related_organization_id uuid not null references public.organizations(id) on delete cascade,
  relationship text not null check (length(trim(relationship)) between 1 and 160),
  reverse_relationship text not null check (length(trim(reverse_relationship)) between 1 and 160),
  source_url text check (source_url is null or (length(source_url) <= 2000 and source_url ~ '^https?://[^[:space:]]+$')),
  created_at timestamptz not null default now(),
  check (organization_id <> related_organization_id)
);
create unique index organization_relationships_pair on public.organization_relationships
  (least(organization_id, related_organization_id), greatest(organization_id, related_organization_id));
create index organization_relationships_organization on public.organization_relationships(organization_id);
create index organization_relationships_related on public.organization_relationships(related_organization_id);
alter table public.organization_relationships enable row level security;
grant select on public.organization_relationships to anon, authenticated;
grant insert, update, delete on public.organization_relationships to authenticated;
create policy "Organization relationships are public" on public.organization_relationships
  for select to anon, authenticated using (true);
create policy "Admins insert organization relationships" on public.organization_relationships
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update organization relationships" on public.organization_relationships
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete organization relationships" on public.organization_relationships
  for delete to authenticated using ((select public.is_admin()));

create function public.get_organization_relationships(p_organization_id uuid)
returns table(id uuid, organization_id uuid, related_organization_id uuid, related_organization_name text,
  related_organization_slug text, relationship text, reverse_relationship text, source_url text)
language sql stable security invoker set search_path = '' as $$
  select r.id, p_organization_id, o.id, o.name, o.slug,
    case when r.organization_id = p_organization_id then r.relationship else r.reverse_relationship end,
    case when r.organization_id = p_organization_id then r.reverse_relationship else r.relationship end,
    r.source_url
  from public.organization_relationships r
  join public.organizations o on o.id = case when r.organization_id = p_organization_id
    then r.related_organization_id else r.organization_id end
  where p_organization_id in (r.organization_id, r.related_organization_id)
  order by o.name, r.id;
$$;
revoke all on function public.get_organization_relationships(uuid) from public;
grant execute on function public.get_organization_relationships(uuid) to anon, authenticated;

-- Verified links are resolved by slug; empty development databases skip missing endpoints.
insert into public.organization_relationships(organization_id,related_organization_id,relationship,reverse_relationship,source_url)
select a.id,b.id,v.relationship,v.reverse_relationship,v.source_url from (values
  ('bibb-county-board-of-education','bcsd','School district governed by this board','Governing board','https://simbli.eboardsolutions.com/AboutUs/AboutUs.aspx?S=4013&TID=1'),
  ('macon-bibb-county-planning-and-zoning-commission','macon-bibb-county-design-review-board','Associated design review board','Associated planning and zoning commission','https://mbpz.org/team/'),
  ('macon-bibb-county-urban-development-authority','downtown-macon-parking-advisory-board','Parking advisory board appointed by this authority','Appointing authority; advised on parking policy','https://www.parkmacon.com/public-engagement'),
  ('macon-bibb-county-board-of-health','macon-bibb-county-health-department','County health department overseen by this board','Local public-health governing board','https://northcentralhealthdistrict.org/board-of-health/'),
  ('north-central-health-district','macon-bibb-county-health-department','County health department within the district','Regional public-health district','https://northcentralhealthdistrict.org/macon-bibb-county-health-department/'),
  ('macon-bibb-county-board-of-commissioners','macon-bibb-county-clerk-of-commission','Clerk maintaining commission records and supporting meetings','Commission served by this clerk’s office','https://www.maconbibb.us/clerk-of-commission/meet-the-clerk/'),
  ('macon-bibb-county-government','macon-bibb-county-board-of-commissioners','County legislative governing body','Consolidated county government','https://www.maconbibb.us/commissioners/'),
  ('macon-bibb-county-government','macon-bibb-county-manager-s-office','County administrative leadership','County government served by this office','https://www.maconbibb.us/county-manager/'),
  ('macon-bibb-county-government','middle-georgia-regional-commission','Regional commission serving Macon-Bibb','Member county government represented on the council','https://www.middlegeorgiarc.org/mgrc-council-2/'),
  ('macon-water-authority','macon-water-authority-district-1','District 1 elected board seat','Authority on whose board this elected seat serves','https://maconwater.org/your-mwa/board-members/'),
  ('river-edge-behavioral-health','river-edge-foundation','Charitable foundation established by River Edge','Public community services board that established the foundation','https://www.maconbibb.us/economic-community-development/program-highlights/'),
  ('united-way-of-central-georgia','brookdale-resource-center','Resource center operated by United Way','Operating organization','https://www.unitedwaycg.org/news/hello-house-opens-brookdale-resource-center'),
  ('brookdale-resource-center','hello-house-at-brookdale','Short-term shelter program within the resource center','Resource center hosting this shelter program','https://www.unitedwaycg.org/news/hello-house-opens-brookdale-resource-center'),
  ('united-way-of-central-georgia','hello-house-at-brookdale','Shelter program operated at Brookdale','Operating organization','https://www.unitedwaycg.org/news/hello-house-opens-brookdale-resource-center'),
  ('macon-arts-alliance','macon-bibb-county-urban-development-authority','Partner in the Mill Hill arts district','Partner in the Mill Hill arts district','https://www.maconartsalliance.org/about/'),
  ('piedmont-macon-medical-center','piedmont-macon-north-hospital','Fellow Macon hospital within Piedmont Healthcare','Fellow Macon hospital within Piedmont Healthcare','https://www.maconbibb.us/griefsupportsession41626/'),
  ('bibb-county-superior-court','bibb-county-clerk-of-superior-court','Clerk maintaining Superior Court records','Court whose records this office maintains','https://www.maconbibb.us/superior-court/clerk-of-superior-court/'),
  ('bibb-county-solicitor-general-s-office','state-court-of-bibb-county','Court in which the solicitor prosecutes misdemeanor cases','Office prosecuting misdemeanor cases in this court','https://www.maconbibb.us/solicitor/'),
  ('bibb-county-solicitor-general-s-office','macon-bibb-county-municipal-court','Court in which the solicitor prosecutes misdemeanor cases','Office prosecuting misdemeanor cases in this court','https://www.maconbibb.us/solicitor/')
) as v(a,b,relationship,reverse_relationship,source_url)
join public.organizations a on a.slug=v.a
join public.organizations b on b.slug=v.b
on conflict do nothing;

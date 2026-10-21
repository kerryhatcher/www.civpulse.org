-- Maps: admin-managed base map plus one or more remote GeoJSON sources.

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  base_map text not null default 'osm'
    check (base_map in ('osm', 'osm-humanitarian', 'osm-topo')),
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.maps is 'Admin-managed maps: an OSM base map plus remote GeoJSON overlays.';
comment on column public.maps.sources is 'Public URLs of GeoJSON files drawn as overlays.';

alter table public.maps enable row level security;

create policy "Maps are publicly readable"
  on public.maps
  for select
  using (true);

create policy "Admins can insert maps"
  on public.maps
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update maps"
  on public.maps
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete maps"
  on public.maps
  for delete
  to authenticated
  using (public.is_admin());

create trigger maps_set_updated_at
  before update on public.maps
  for each row
  execute function public.set_updated_at();

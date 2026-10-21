-- Layers become first-class data objects with their own visibility, reusable
-- across maps via a many-to-many join.

create table public.layers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  source_url text not null check (char_length(source_url) between 1 and 1000),
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.layers is 'Reusable GeoJSON layers that can be added to one or more maps.';

alter table public.layers enable row level security;

create policy "Public layers are readable"
  on public.layers
  for select
  using (visibility = 'public');

create policy "Private layers are readable when signed in"
  on public.layers
  for select
  to authenticated
  using (visibility = 'private');

create policy "Admins can read all layers"
  on public.layers
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert layers"
  on public.layers
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update layers"
  on public.layers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete layers"
  on public.layers
  for delete
  to authenticated
  using (public.is_admin());

create trigger layers_set_updated_at
  before update on public.layers
  for each row
  execute function public.set_updated_at();

create table public.map_layers (
  map_id uuid not null references public.maps (id) on delete cascade,
  layer_id uuid not null references public.layers (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (map_id, layer_id)
);

comment on table public.map_layers is 'Ordered join between maps and layers.';

alter table public.map_layers enable row level security;

create policy "Admins manage map layers"
  on public.map_layers
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Backfill the existing maps.sources URLs as layers.
insert into public.layers (name, source_url, visibility)
select distinct on (src.url)
  m.name || ' layer',
  src.url,
  m.visibility
from public.maps m
cross join lateral unnest(m.sources) with ordinality as src(url, ord)
where src.url <> ''
order by src.url, m.name;

insert into public.map_layers (map_id, layer_id, position)
select m.id, l.id, (src.ord - 1)::int
from public.maps m
cross join lateral unnest(m.sources) with ordinality as src(url, ord)
join public.layers l on l.source_url = src.url
where src.url <> ''
on conflict (map_id, layer_id) do nothing;

alter table public.maps drop column sources;

-- Accessible layers for a map. Unlisted behaves like public for rendering
-- (obscure but visible); private requires a session. Also requires the map
-- itself to be viewable by the caller.
create function public.get_map_layers(p_map_id uuid)
returns setof public.layers
language sql
stable
security definer
set search_path = ''
as $$
  select l.*
  from public.layers l
  join public.map_layers ml on ml.layer_id = l.id
  where ml.map_id = p_map_id
    and exists (
      select 1
      from public.maps m
      where m.id = p_map_id
        and (
          m.visibility in ('public', 'unlisted')
          or (m.visibility = 'private' and (select auth.uid()) is not null)
        )
    )
    and (
      l.visibility in ('public', 'unlisted')
      or (l.visibility = 'private' and (select auth.uid()) is not null)
    )
  order by ml.position, l.name;
$$;

comment on function public.get_map_layers(uuid) is
  'Layers for a map that the caller may see (public/unlisted always, private when signed in).';

revoke execute on function public.get_map_layers(uuid) from public;
grant execute on function public.get_map_layers(uuid) to anon, authenticated;

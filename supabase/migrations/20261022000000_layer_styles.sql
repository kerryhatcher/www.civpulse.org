-- Layer styling: every layer carries a reusable default style, and a map can
-- override that style per layer without affecting the layer anywhere else.

alter table public.layers
  add column style jsonb not null default '{}'::jsonb;

comment on column public.layers.style is
  'Default Leaflet style (color, weight, opacity, fillColor, fillOpacity, dashArray, radius). An empty object falls back to the app default.';

alter table public.map_layers
  add column style jsonb;

comment on column public.map_layers.style is
  'Optional per-map style override for this layer. Null inherits the layer default style.';

-- Recreate get_map_layers so it returns the effective style for the map: the
-- per-map override when set, otherwise the layer default. Dropping is required
-- because the return type changes.
drop function if exists public.get_map_layers(uuid);

create function public.get_map_layers(p_map_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  source_url text,
  visibility text,
  style jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.name,
    l.description,
    l.source_url,
    l.visibility,
    coalesce(ml.style, l.style) as style
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
  'Layers for a map that the caller may see, with the effective style (map override or layer default).';

revoke execute on function public.get_map_layers(uuid) from public;
grant execute on function public.get_map_layers(uuid) to anon, authenticated;

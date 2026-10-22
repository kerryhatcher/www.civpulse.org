-- Backward-compatible presentation settings; existing maps keep their defaults.
alter table public.layers add column presentation jsonb not null default '{}'::jsonb
  check (jsonb_typeof(presentation) = 'object');
alter table public.maps add column view_options jsonb not null default '{}'::jsonb
  check (jsonb_typeof(view_options) = 'object');
alter table public.map_layers add column visible_by_default boolean not null default true;

-- Keep both visibility gates, including for optional (initially hidden) layers.
drop function public.get_map_layers(uuid);
create function public.get_map_layers(p_map_id uuid)
returns table (id uuid, name text, description text, source_url text, visibility text,
  style jsonb, source_type text, presentation jsonb, visible_by_default boolean, "position" int)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, l.description, l.source_url, l.visibility,
    l.style || coalesce(ml.style, '{}'::jsonb), l.source_type, l.presentation,
    ml.visible_by_default, ml.position
  from public.layers l join public.map_layers ml on ml.layer_id = l.id
  where ml.map_id = p_map_id
    and exists (select 1 from public.maps m where m.id = p_map_id
      and (m.visibility in ('public', 'unlisted') or (select auth.uid()) is not null))
    and (l.visibility in ('public', 'unlisted') or (select auth.uid()) is not null)
  order by ml.position, l.name;
$$;
revoke execute on function public.get_map_layers(uuid) from public;
grant execute on function public.get_map_layers(uuid) to anon, authenticated;

-- Save map metadata and its ordered links in one transaction; failures preserve
-- the previous configuration instead of leaving a map with missing layers.
create function public.save_map(p_map jsonb, p_layers jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid := coalesce((p_map->>'id')::uuid, gen_random_uuid());
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_layers) is distinct from 'array' then raise exception 'Expected a layer array'; end if;
  if p_map->>'id' is not null then
    perform 1 from public.maps where id = v_id for update;
    if not found then raise exception 'Map not found'; end if;
  end if;
  insert into public.maps (id, name, slug, description, base_map, visibility, organization_id, view_options)
    values (v_id, p_map->>'name', p_map->>'slug', p_map->>'description', p_map->>'base_map',
      p_map->>'visibility', (p_map->>'organization_id')::uuid, coalesce(p_map->'view_options', '{}'::jsonb))
  on conflict (id) do update set name = excluded.name, slug = excluded.slug,
    description = excluded.description, base_map = excluded.base_map,
    visibility = excluded.visibility, organization_id = excluded.organization_id,
    view_options = case when p_map ? 'view_options' then excluded.view_options else public.maps.view_options end;
  delete from public.map_layers where map_id = v_id;
  insert into public.map_layers (map_id, layer_id, position, style, visible_by_default)
    select v_id, (entry->>'layer_id')::uuid, (ordinality - 1)::int,
      nullif(entry->'style', 'null'::jsonb), coalesce((entry->>'visible_by_default')::boolean, true)
    from jsonb_array_elements(p_layers) with ordinality as links(entry, ordinality);
  return v_id;
end;
$$;
revoke execute on function public.save_map(jsonb, jsonb) from public, anon;
grant execute on function public.save_map(jsonb, jsonb) to authenticated;

create or replace function public.save_postgis_layer(p_layer jsonb, p_geojson jsonb default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := coalesce((p_layer->>'id')::uuid, gen_random_uuid());
  v_features jsonb;
  v_feature jsonb;
  v_position int := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_geojson is not null then
    if p_geojson->>'type' = 'FeatureCollection' then
      v_features := p_geojson->'features';
    elsif p_geojson->>'type' = 'Feature' then
      v_features := jsonb_build_array(p_geojson);
    else
      v_features := jsonb_build_array(jsonb_build_object('type', 'Feature', 'geometry', p_geojson));
    end if;
    if jsonb_typeof(v_features) is distinct from 'array' then raise exception 'Expected a GeoJSON features array'; end if;
    if jsonb_array_length(v_features) > 10000 or octet_length(p_geojson::text) > 10485760 then
      raise exception 'Import limit: 10 MB and 10,000 features';
    end if;
  end if;

  if p_layer->>'id' is not null then
    perform 1 from public.layers where id = v_id for update;
    if not found then raise exception 'Layer not found'; end if;
    if p_geojson is null and exists (select 1 from public.layers where id = v_id and source_type <> 'postgis') then
      raise exception 'Choose GeoJSON data to convert this layer';
    end if;
    update public.layers set name = p_layer->>'name', description = p_layer->>'description',
      visibility = p_layer->>'visibility', style = coalesce(p_layer->'style', '{}'::jsonb),
      source_type = 'postgis', source_url = null,
      presentation = case when p_layer ? 'presentation' then p_layer->'presentation' else presentation end where id = v_id;
  else
    if p_geojson is null then raise exception 'Choose GeoJSON data to create a stored layer'; end if;
    insert into public.layers (id, name, description, visibility, style, source_type, presentation)
      values (v_id, p_layer->>'name', p_layer->>'description', p_layer->>'visibility',
        coalesce(p_layer->'style', '{}'::jsonb), 'postgis', coalesce(p_layer->'presentation', '{}'::jsonb));
  end if;

  if p_geojson is not null then
    delete from public.layer_features where layer_id = v_id;
    for v_feature in select value from jsonb_array_elements(v_features) loop
      if v_feature->>'type' is distinct from 'Feature'
        or v_feature->'geometry' is null or v_feature->'geometry' = 'null'::jsonb then
        raise exception 'Feature % must have a point, line, or polygon geometry', v_position + 1;
      end if;
      insert into public.layer_features (layer_id, position, feature_id, properties, geometry)
        values (v_id, v_position, v_feature->'id',
          coalesce(nullif(v_feature->'properties', 'null'::jsonb), '{}'::jsonb),
          extensions.st_force2d(extensions.st_geomfromgeojson(v_feature->'geometry')));
      v_position := v_position + 1;
    end loop;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.save_postgis_layer(jsonb, jsonb) from public, anon;
grant execute on function public.save_postgis_layer(jsonb, jsonb) to authenticated;


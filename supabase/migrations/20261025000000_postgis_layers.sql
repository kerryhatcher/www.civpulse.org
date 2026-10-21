-- Keep URL layers; stored layers hold one spatially indexed row per feature.
create extension if not exists postgis with schema extensions;

alter table public.layers
  add column source_type text not null default 'geojson'
    check (source_type in ('geojson', 'postgis')),
  alter column source_url drop not null;
alter table public.layers add constraint layers_source_required
  check (source_type = 'postgis' or source_url is not null);

create table public.layer_features (
  id bigint generated always as identity primary key,
  layer_id uuid not null references public.layers(id) on delete cascade,
  position int not null,
  feature_id jsonb,
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  geometry extensions.geometry(Geometry, 4326) not null,
  constraint layer_features_geometry_valid check (
    extensions.st_geometrytype(geometry) in (
      'ST_Point', 'ST_MultiPoint', 'ST_LineString', 'ST_MultiLineString',
      'ST_Polygon', 'ST_MultiPolygon'
    ) and not extensions.st_isempty(geometry) and extensions.st_isvalid(geometry)
    and extensions.st_xmin(extensions.box3d(geometry)) >= -180
    and extensions.st_xmax(extensions.box3d(geometry)) <= 180
    and extensions.st_ymin(extensions.box3d(geometry)) >= -90
    and extensions.st_ymax(extensions.box3d(geometry)) <= 90
  ),
  unique (layer_id, position)
);
create index layer_features_geometry_idx on public.layer_features using gist (geometry);
alter table public.layer_features enable row level security;
create policy "Admins manage layer features" on public.layer_features
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.layer_features from anon;
grant select, insert, update, delete on public.layer_features to authenticated;
grant usage, select on sequence public.layer_features_id_seq to authenticated;

-- Metadata and replacement features commit together. An exception restores the
-- previous dataset. A row lock serializes competing imports of the same layer.
create function public.save_postgis_layer(p_layer jsonb, p_geojson jsonb default null)
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
      source_type = 'postgis', source_url = null where id = v_id;
  else
    if p_geojson is null then raise exception 'Choose GeoJSON data to create a stored layer'; end if;
    insert into public.layers (id, name, description, visibility, style, source_type)
      values (v_id, p_layer->>'name', p_layer->>'description', p_layer->>'visibility',
        coalesce(p_layer->'style', '{}'::jsonb), 'postgis');
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

-- Include the source type while retaining the existing map/layer visibility gate.
drop function public.get_map_layers(uuid);
create function public.get_map_layers(p_map_id uuid)
returns table (id uuid, name text, description text, source_url text, visibility text, style jsonb, source_type text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, l.description, l.source_url, l.visibility,
    coalesce(ml.style, l.style), l.source_type
  from public.layers l join public.map_layers ml on ml.layer_id = l.id
  where ml.map_id = p_map_id
    and exists (select 1 from public.maps m where m.id = p_map_id
      and (m.visibility in ('public', 'unlisted') or (select auth.uid()) is not null))
    and (l.visibility in ('public', 'unlisted') or (select auth.uid()) is not null)
  order by ml.position, l.name;
$$;
revoke execute on function public.get_map_layers(uuid) from public;
grant execute on function public.get_map_layers(uuid) to anon, authenticated;

-- Non-admin geometry reads require an accessible map containing this layer.
-- Direct feature-table reads remain admin-only, including for unlisted data.
create function public.get_layer_geojson(p_layer_id uuid, p_map_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.get_map_layers(p_map_id) l where l.id = p_layer_id
  ) then raise exception 'Layer not accessible' using errcode = '42501'; end if;
  return (select jsonb_build_object('type', 'FeatureCollection', 'features',
    coalesce(jsonb_agg(jsonb_build_object('type', 'Feature',
      'geometry', extensions.st_asgeojson(f.geometry, 15)::jsonb,
      'properties', f.properties) ||
      case when f.feature_id is null then '{}'::jsonb else jsonb_build_object('id', f.feature_id) end
      order by f.position), '[]'::jsonb))
    from public.layer_features f where f.layer_id = p_layer_id);
end;
$$;
revoke execute on function public.get_layer_geojson(uuid, uuid) from public;
grant execute on function public.get_layer_geojson(uuid, uuid) to anon, authenticated;

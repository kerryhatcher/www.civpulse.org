-- Keep each geometry response below the hosted anonymous query timeout.
-- The full-document RPC remains available for existing clients and downloads.
create function public.get_layer_geojson_page(p_layer_id uuid, p_map_id uuid default null,
  p_offset integer default 0, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; total integer;
begin
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Expected a nonnegative offset and limit between 1 and 100' using errcode = '22023';
  end if;
  if not public.is_admin() and not exists (
    select 1 from public.get_map_layers(p_map_id) l where l.id = p_layer_id
  ) then raise exception 'Layer not accessible' using errcode = '42501'; end if;
  select count(*) into total from public.layer_features where layer_id = p_layer_id;
  select coalesce(jsonb_agg(jsonb_build_object('type', 'Feature',
    'geometry', extensions.st_asgeojson(f.geometry, 15)::jsonb, 'properties', f.properties) ||
    case when f.feature_id is null then '{}'::jsonb else jsonb_build_object('id', f.feature_id) end
    order by f.position), '[]'::jsonb) into result
  from (select * from public.layer_features where layer_id = p_layer_id
    order by position limit p_limit offset p_offset) f;
  return jsonb_build_object('type', 'FeatureCollection', 'features', result, 'numberMatched', total);
end $$;
revoke execute on function public.get_layer_geojson_page(uuid, uuid, integer, integer) from public;
grant execute on function public.get_layer_geojson_page(uuid, uuid, integer, integer) to anon, authenticated;

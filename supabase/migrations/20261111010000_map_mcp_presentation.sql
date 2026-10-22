create or replace function public.mcp_save_postgis_layer(p_layer jsonb, p_geojson jsonb default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  previous public.layers;
  edited public.layers;
  v_layer_id uuid := (p_layer->>'id')::uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_layer) is distinct from 'object' then raise exception 'Expected layer object' using errcode = '22023'; end if;
  if v_layer_id is not null then
    select * into previous from public.layers where id = v_layer_id for update;
    if not found then raise exception 'Layer not found' using errcode = 'P0002'; end if;
  end if;
  edited := jsonb_populate_record(previous, p_layer);
  return public.save_postgis_layer(jsonb_build_object('id', v_layer_id, 'name', edited.name,
    'description', edited.description, 'visibility', coalesce(edited.visibility, 'public'),
    'style', coalesce(edited.style, '{}'::jsonb), 'presentation', coalesce(edited.presentation, '{}'::jsonb)), p_geojson);
end $$;
revoke execute on function public.mcp_save_postgis_layer(jsonb, jsonb) from public, anon;
grant execute on function public.mcp_save_postgis_layer(jsonb, jsonb) to authenticated;

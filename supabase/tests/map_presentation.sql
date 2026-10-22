-- All fixtures roll back. Run against a migrated local database.
begin;
insert into auth.users (id, email) values ('20000000-0000-4000-8000-000000000001', 'map-style-test@example.test');
insert into public.admins (user_id) values ('20000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare l uuid; private_l uuid; m uuid; data jsonb; before_doc jsonb;
begin
  data := '{"type":"FeatureCollection","features":[{"type":"Feature","id":"original","properties":{"name":"Test"},"geometry":{"type":"Point","coordinates":[-83,32]}}]}';
  l := public.save_postgis_layer('{"name":"Style test","visibility":"public","style":{"color":"#173e34","weight":2},"presentation":{"key":"test","group":"Community","renderer":"fields"}}', data);
  private_l := public.save_postgis_layer('{"name":"Private style test","visibility":"private","presentation":{"key":"restricted"}}', data);
  m := public.save_map('{"name":"Map test","slug":"map-presentation-test","visibility":"public","base_map":"osm","view_options":{"zoom":10}}', jsonb_build_array(
    jsonb_build_object('layer_id',l,'style','{"weight":4}'::jsonb,'visible_by_default',false),
    jsonb_build_object('layer_id',private_l,'visible_by_default',true)));
  perform set_config('test.map_id',m::text,true);
  perform set_config('test.layer_id',l::text,true);
  perform set_config('test.private_layer_id',private_l::text,true);
  assert (select style = '{"color":"#173e34","weight":4}'::jsonb and not visible_by_default and presentation->>'group' = 'Community' from public.get_map_layers(m) where id = l), 'effective styles merge; presentation and default selection roundtrip';
  before_doc := public.get_layer_geojson(l);
  perform public.mcp_save_postgis_layer(jsonb_build_object('id',l,'presentation','{"group":"Updated"}'::jsonb));
  assert (select presentation->>'group' = 'Updated' from public.layers where id = l), 'MCP can edit presentation';
  perform public.save_postgis_layer(jsonb_build_object('id',l,'name','Style test','visibility','public','style','{"color":"#173e34"}'::jsonb));
  assert (select presentation->>'group' = 'Updated' from public.layers where id = l), 'metadata-only updates preserve presentation';
  assert public.get_layer_geojson(l) = before_doc, 'presentation edits preserve geometry and feature IDs';
  begin
    perform public.save_map(jsonb_build_object('id',m,'name','Should roll back','slug','map-presentation-test','visibility','public','base_map','osm'),
      '[{"layer_id":"20000000-0000-4000-8000-000000000099"}]');
    raise exception 'Invalid link accepted';
  exception when foreign_key_violation then null; end;
  assert (select name = 'Map test' and view_options->>'zoom' = '10' from public.maps where id = m), 'invalid link rolls back map metadata';
  assert (select count(*) = 2 from public.map_layers where map_id = m), 'invalid link preserves existing links';
  insert into public.layer_features(layer_id, position, feature_id, properties, geometry)
    select l, i, to_jsonb(i), jsonb_build_object('name', 'Page ' || i),
      extensions.st_setsrid(extensions.st_makepoint(-83, 32),4326) from generate_series(1,120) i;
  assert public.get_layer_geojson_page(l,null,0,50)->>'numberMatched' = '121', 'page reports full feature count';
  assert (public.get_layer_geojson_page(l,null,0,50)->'features') ||
    (public.get_layer_geojson_page(l,null,50,50)->'features') ||
    (public.get_layer_geojson_page(l,null,100,50)->'features') = public.get_layer_geojson(l)->'features',
    'pages preserve every feature, ID, property, and ordering';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  assert (select count(*) = 1 from public.get_map_layers(current_setting('test.map_id')::uuid)), 'anonymous sees optional public layer, never private layer';
  assert jsonb_array_length(public.get_layer_geojson_page(current_setting('test.layer_id')::uuid,current_setting('test.map_id')::uuid,100,50)->'features') = 21, 'optional layer pages use map gate';
  assert jsonb_array_length(public.get_layer_geojson_page(current_setting('test.layer_id')::uuid,current_setting('test.map_id')::uuid,121,50)->'features') = 0, 'past-end page is empty';
  begin
    perform public.get_layer_geojson_page(current_setting('test.layer_id')::uuid,current_setting('test.map_id')::uuid,0,101);
    raise exception 'Unbounded page accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.get_layer_geojson_page(current_setting('test.private_layer_id')::uuid,current_setting('test.map_id')::uuid);
    raise exception 'Private paged geometry leaked';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_layer_geojson(current_setting('test.private_layer_id')::uuid,current_setting('test.map_id')::uuid);
    raise exception 'Private geometry leaked';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_map('{}','[]');
    raise exception 'Anonymous map write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  assert (select count(*) = 2 from public.get_map_layers(current_setting('test.map_id')::uuid)), 'signed-in visitors see private layers';
  begin
    perform public.save_map('{}','[]');
    raise exception 'Non-admin map write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.maps set visibility = 'private' where id = current_setting('test.map_id')::uuid;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$ begin
  assert not exists(select 1 from public.get_map_layers(current_setting('test.map_id')::uuid)), 'private map hides every layer including public ones';
  begin
    perform public.get_layer_geojson_page(current_setting('test.layer_id')::uuid,current_setting('test.map_id')::uuid);
    raise exception 'Private map paged geometry leaked';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

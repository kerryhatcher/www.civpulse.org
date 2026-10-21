-- Run with psql against a local database after migrations; all fixtures roll back.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('10000000-0000-0000-0000-000000000001', 'postgis-test@example.test');
insert into public.admins (user_id) values ('10000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select public.save_postgis_layer(
  '{"name":"Geometry test","visibility":"unlisted"}',
  '{"type":"FeatureCollection","features":[
    {"type":"Feature","id":"origin","properties":{"name":"Point"},"geometry":{"type":"Point","coordinates":[-83,32,5]}},
    {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-83,32],[-84,33]]}},
    {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-83,32],[-84,32],[-84,33],[-83,32]]]}},
    {"type":"Feature","geometry":{"type":"MultiPoint","coordinates":[[-83,32],[-84,33]]}},
    {"type":"Feature","geometry":{"type":"MultiLineString","coordinates":[[[-83,32],[-84,33]]]}},
    {"type":"Feature","geometry":{"type":"MultiPolygon","coordinates":[[[[-83,32],[-84,32],[-84,33],[-83,32]]]]}}
  ]}'
) as layer_id \gset
select set_config('test.layer_id', :'layer_id', true);

do $$
declare l uuid := current_setting('test.layer_id')::uuid; doc jsonb; bad jsonb;
begin
  doc := public.get_layer_geojson(l);
  assert jsonb_array_length(doc->'features') = 6, 'all six geometry types roundtrip';
  assert doc#>>'{features,0,id}' = 'origin', 'feature ID preserved';
  assert doc#>>'{features,0,properties,name}' = 'Point', 'properties preserved';
  assert jsonb_array_length(doc#>'{features,0,geometry,coordinates}') = 2, 'altitude removed';
  assert (select count(distinct extensions.st_geometrytype(geometry)) = 6 from public.layer_features where layer_id = l);

  for bad in select value from jsonb_array_elements('[
    {"type":"Point","coordinates":[200,32]},
    {"type":"LineString","coordinates":[[1,2]]},
    {"type":"Polygon","coordinates":[[[0,0],[2,2],[0,2],[2,0],[0,0]]]},
    {"type":"Feature","geometry":null},
    {"type":"GeometryCollection","geometries":[]},
    {"type":"FeatureCollection","features":null}
  ]'::jsonb) loop
    begin
      perform public.save_postgis_layer(jsonb_build_object('id', l, 'name', 'Bad import', 'visibility', 'public'), bad);
      raise exception 'Invalid data was accepted: %', bad;
    exception when check_violation or data_exception or raise_exception or internal_error then
      if sqlerrm like 'Invalid data was accepted:%' then raise; end if;
    end;
    assert (select name = 'Geometry test' from public.layers where id = l), 'failed import rolls metadata back';
    assert public.get_layer_geojson(l) = doc, 'failed import preserves features';
  end loop;

  perform public.save_postgis_layer(jsonb_build_object('id', l, 'name', 'Metadata only', 'visibility', 'unlisted'));
  assert public.get_layer_geojson(l) = doc, 'metadata edits keep geometry';
  perform public.save_postgis_layer(jsonb_build_object('id', l, 'name', 'Replacement', 'visibility', 'unlisted'),
    '{"type":"Point","coordinates":[1,2]}');
  assert jsonb_array_length(public.get_layer_geojson(l)->'features') = 1, 'replacement removes old features';
  perform public.save_postgis_layer(jsonb_build_object('id', l, 'name', 'Empty', 'visibility', 'unlisted'),
    '{"type":"FeatureCollection","features":[]}');
  assert public.get_layer_geojson(l)->'features' = '[]'::jsonb, 'empty dataset supported';
  perform public.save_postgis_layer(jsonb_build_object('id', l, 'name', 'Restored', 'visibility', 'unlisted'), doc);

end;
$$;

insert into public.maps (slug, name, visibility) values ('postgis-test-map', 'PostGIS test', 'public') returning id as map_id \gset
insert into public.map_layers (map_id, layer_id) values (:'map_id', :'layer_id');
select set_config('test.map_id', :'map_id', true);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  assert jsonb_array_length(public.get_layer_geojson(current_setting('test.layer_id')::uuid, current_setting('test.map_id')::uuid)->'features') = 6,
    'anonymous visitor can read an unlisted layer through a public map';
  begin
    perform public.get_layer_geojson(current_setting('test.layer_id')::uuid);
    raise exception 'Missing map context was accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.layer_features;
    raise exception 'Anonymous direct geometry access was accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
update public.layers set visibility = 'private' where id = :'layer_id';
set local role anon;
do $$
begin
  assert not exists(select 1 from public.get_map_layers(current_setting('test.map_id')::uuid)), 'private layer omitted';
  begin
    perform public.get_layer_geojson(current_setting('test.layer_id')::uuid, current_setting('test.map_id')::uuid);
    raise exception 'Private geometry leaked';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- A signed-in non-admin can read private geometry, but cannot import or read the table.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $$
begin
  assert jsonb_array_length(public.get_layer_geojson(current_setting('test.layer_id')::uuid, current_setting('test.map_id')::uuid)->'features') = 6;
  assert not exists(select 1 from public.layer_features), 'direct features remain admin-only';
  begin
    perform public.save_postgis_layer('{"name":"Unauthorized","visibility":"public"}', '{"type":"Point","coordinates":[0,0]}');
    raise exception 'Non-admin import was accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
update public.maps set visibility = 'private' where id = :'map_id';
update public.layers set visibility = 'public' where id = :'layer_id';
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin
    perform public.get_layer_geojson(current_setting('test.layer_id')::uuid, current_setting('test.map_id')::uuid);
    raise exception 'Private map gate bypassed';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;

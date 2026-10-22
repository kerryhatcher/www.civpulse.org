-- MCP detail reads follow discovery visibility. Association lists remain admin-only.
create function public.mcp_get_record(p_type text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  record_json jsonb;
  election_id uuid;
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  case p_type
    when 'organization' then
      select to_jsonb(o) into record_json from public.organizations o where o.id = p_id;
    when 'calendar' then
      select to_jsonb(c) into record_json from public.calendars c where c.id = p_id
        and (c.visibility = 'public' or (select auth.uid()) is not null);
    when 'layer' then
      select to_jsonb(l) into record_json from public.layers l where l.id = p_id
        and (l.visibility = 'public' or (select auth.uid()) is not null);
    when 'article' then
      select to_jsonb(a) into record_json from public.articles a where a.id = p_id
        and (a.visibility = 'public' or (select auth.uid()) is not null);
    when 'contest' then
      select c.election_id into election_id from public.contests c where c.id = p_id;
      select x.value into record_json
        from jsonb_array_elements(public.get_election(election_id)->'contests') x
        where x.value->>'id' = p_id::text;
    when 'ballot_question' then
      select b.election_id into election_id from public.ballot_questions b where b.id = p_id;
      select x.value into record_json
        from jsonb_array_elements(public.get_election(election_id)->'ballot_questions') x
        where x.value->>'id' = p_id::text;
    else raise exception 'Unknown record type' using errcode = '22023';
  end case;
  if record_json is null then return jsonb_build_object('status', 'missing'); end if;
  result := jsonb_build_object('status', 'ok', p_type, record_json - 'search_document' - 'site_search_document');
  if p_type = 'article' and (select public.is_admin()) then
    result := result || jsonb_build_object(
      'people', (select coalesce(jsonb_agg(jsonb_build_object('person_id', ap.person_id, 'role', ap.role) order by ap.person_id), '[]'::jsonb)
        from public.article_people ap where ap.article_id = p_id),
      'organizations', (select coalesce(jsonb_agg(jsonb_build_object('organization_id', ao.organization_id, 'role', ao.role) order by ao.organization_id), '[]'::jsonb)
        from public.article_organizations ao where ao.article_id = p_id));
  end if;
  return result;
end $$;
revoke execute on function public.mcp_get_record(text, uuid) from public, anon;
grant execute on function public.mcp_get_record(text, uuid) to authenticated;

-- Preserve omitted fields/links and serialize partial edits before calling the
-- existing article transaction. Explicit null clears dates; [] clears link sets.
create function public.mcp_save_article(p_article jsonb, p_people jsonb default null, p_organizations jsonb default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  previous public.articles;
  edited public.articles;
  v_article_id uuid := (p_article->>'id')::uuid;
  people_json jsonb;
  organizations_json jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_article) is distinct from 'object' then raise exception 'Expected article object' using errcode = '22023'; end if;
  if v_article_id is not null then
    select * into previous from public.articles where id = v_article_id for update;
    if not found then raise exception 'Article not found' using errcode = 'P0002'; end if;
  end if;
  edited := jsonb_populate_record(previous, p_article);
  people_json := coalesce(p_people, (select jsonb_agg(jsonb_build_object('person_id', ap.person_id, 'role', ap.role))
    from public.article_people ap where ap.article_id = v_article_id), '[]'::jsonb);
  organizations_json := coalesce(p_organizations, (select jsonb_agg(jsonb_build_object('organization_id', ao.organization_id, 'role', ao.role))
    from public.article_organizations ao where ao.article_id = v_article_id), '[]'::jsonb);
  return public.save_article(edited.title, edited.url, coalesce(edited.visibility, 'public'),
    people_json, organizations_json, v_article_id, edited.fetched_on, edited.published_on);
end $$;
revoke execute on function public.mcp_save_article(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.mcp_save_article(jsonb, jsonb, jsonb) to authenticated;

-- Stored-feature reads use exactly the existing map/layer geometry gate.
-- IDs are text to preserve bigint precision in JavaScript clients.
create function public.mcp_layer_features(p_layer_id uuid, p_map_id uuid default null,
  p_query text default '', p_id bigint default null, p_limit integer default 20, p_offset integer default 0)
returns table(id text, layer_id uuid, "position" integer, feature_id jsonb, properties jsonb, geometry jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  needle text := lower(btrim(coalesce(p_query, '')));
  q tsquery := websearch_to_tsquery('english'::regconfig, coalesce(p_query, ''));
begin
  if (select auth.uid()) is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not public.is_admin() and not exists (select 1 from public.get_map_layers(p_map_id) l where l.id = p_layer_id) then
    raise exception 'Layer not accessible' using errcode = '42501';
  end if;
  if char_length(coalesce(p_query, '')) > 500 then raise exception 'Search query is too long' using errcode = '22023'; end if;
  return query select f.id::text, f.layer_id, f.position, f.feature_id, f.properties,
      extensions.st_asgeojson(f.geometry, 15)::jsonb
    from public.layer_features f
    where f.layer_id = p_layer_id and (p_id is null or f.id = p_id)
      and (needle = '' or f.site_search_document @@ q or strpos(lower(f.properties::text), needle) > 0)
    order by f.position, f.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke execute on function public.mcp_layer_features(uuid, uuid, text, bigint, integer, integer) from public, anon;
grant execute on function public.mcp_layer_features(uuid, uuid, text, bigint, integer, integer) to authenticated;

-- Incremental edits retain all existing geometry checks and bulk-import limits.
create function public.mcp_save_layer_feature(p_layer_id uuid, p_feature jsonb, p_id bigint default null)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  previous public.layer_features;
  feature_row_id bigint;
  next_position integer;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_feature) is distinct from 'object' then raise exception 'Expected feature object' using errcode = '22023'; end if;
  perform 1 from public.layers where id = p_layer_id and source_type = 'postgis' for update;
  if not found then raise exception 'Stored PostGIS layer not found' using errcode = 'P0002'; end if;
  if p_id is not null then
    select * into previous from public.layer_features where id = p_id and layer_id = p_layer_id for update;
    if not found then raise exception 'Feature not found' using errcode = 'P0002'; end if;
  end if;
  select coalesce(max(position) + 1, 0) into next_position from public.layer_features where layer_id = p_layer_id;
  if p_id is null then
    insert into public.layer_features(layer_id, position, feature_id, properties, geometry)
      values(p_layer_id, coalesce((p_feature->>'position')::integer, next_position),
        nullif(p_feature->'feature_id', 'null'::jsonb), coalesce(p_feature->'properties', '{}'::jsonb),
        extensions.st_force2d(extensions.st_geomfromgeojson(p_feature->'geometry')))
      returning public.layer_features.id into feature_row_id;
  else
    update public.layer_features set
      position = case when p_feature ? 'position' then (p_feature->>'position')::integer else previous.position end,
      feature_id = case when p_feature ? 'feature_id' then nullif(p_feature->'feature_id', 'null'::jsonb) else previous.feature_id end,
      properties = case when p_feature ? 'properties' then p_feature->'properties' else previous.properties end,
      geometry = case when p_feature ? 'geometry' then extensions.st_force2d(extensions.st_geomfromgeojson(p_feature->'geometry')) else previous.geometry end
      where public.layer_features.id = p_id and layer_id = p_layer_id
      returning public.layer_features.id into feature_row_id;
  end if;
  if (select count(*) from public.layer_features where layer_id = p_layer_id) > 10000
    or octet_length(public.get_layer_geojson(p_layer_id)::text) > 10485760 then
    raise exception 'Stored layer limit: 10 MB and 10,000 features' using errcode = '22023';
  end if;
  return feature_row_id::text;
end $$;
revoke execute on function public.mcp_save_layer_feature(uuid, jsonb, bigint) from public, anon;
grant execute on function public.mcp_save_layer_feature(uuid, jsonb, bigint) to authenticated;

-- Merge metadata under the same row lock used by stored-dataset imports.
create function public.mcp_save_postgis_layer(p_layer jsonb, p_geojson jsonb default null)
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
    'style', coalesce(edited.style, '{}'::jsonb)), p_geojson);
end $$;
revoke execute on function public.mcp_save_postgis_layer(jsonb, jsonb) from public, anon;
grant execute on function public.mcp_save_postgis_layer(jsonb, jsonb) to authenticated;

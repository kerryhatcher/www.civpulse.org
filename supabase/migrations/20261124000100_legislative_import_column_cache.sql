-- Resolve importable columns once per resource per request, preserving all import guards.
create or replace function public.import_legislation(p_records jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb; tbl text; data jsonb; col text; columns_sql text; values_sql text; updates_sql text;
 saved uuid; result jsonb:='[]'; column_cache jsonb:='{}'; table_columns jsonb;
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>100 or octet_length(p_records::text)>2000000 then
  raise exception 'Provide at most 100 normalized records (2 MB)' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_records) loop
  tbl:=item->>'table';data:=item->'data';
  if tbl is null or tbl not in ('legislative_terms','legislative_sessions','legislative_bodies','legislative_body_memberships','bills','bill_versions',
   'bill_amendments','bill_actions','bill_relationships','bill_sponsorships','bill_positions','legislative_votes',
   'legislative_vote_bills','legislative_vote_choices','article_bills','legislative_event_links') then
   raise exception 'Unknown legislative resource' using errcode='22023'; end if;
  if not (column_cache ? tbl) then
   select coalesce(jsonb_agg(column_name),'[]'::jsonb) into table_columns
    from information_schema.columns where table_schema='public' and table_name=tbl;
   column_cache:=jsonb_set(column_cache,array[tbl],table_columns);
  end if;
  if jsonb_typeof(data) is distinct from 'object' or nullif(btrim(data->>'source_system'),'') is null or nullif(btrim(data->>'source_id'),'') is null then
   raise exception 'Every import needs source_system and source_id' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(tbl||':'||(data->>'source_system')||':'||(data->>'source_id'),0));
  execute format('select id from public.%I where source_system=$1 and source_id=$2',tbl) into saved using data->>'source_system',data->>'source_id';
  if saved is not null then
   if data->>'id' is not null and saved<>(data->>'id')::uuid then raise exception 'Provider key already maps to another UUID' using errcode='23505'; end if;
   data:=data||jsonb_build_object('id',saved);
  end if;
  columns_sql:='';values_sql:='';updates_sql:='';
  for col in select jsonb_object_keys(data) loop
   if col in ('created_at','updated_at') or not ((column_cache->tbl) ? col) then
    raise exception 'Unknown or managed import field %',col using errcode='22023'; end if;
   columns_sql:=columns_sql||format('%I,',col);values_sql:=values_sql||format('r.%I,',col);
   if col<>'id' then
    if tbl='legislative_votes' and col='category' then
     -- Use the locked target row at UPDATE time so a concurrent reviewed correction wins.
     updates_sql:=updates_sql||'category=case when t.category=''attendance'' then t.category else r.category end,';
    else updates_sql:=updates_sql||format('%I=r.%I,',col,col); end if;
   end if;
  end loop;
  if saved is not null then
   execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.id=$2 returning t.id',tbl,rtrim(updates_sql,','),tbl) into saved using data,saved;
  else
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning id',tbl,rtrim(columns_sql,','),rtrim(values_sql,','),tbl) into saved using data;
  end if;
  if data->>'id' is not null and saved<>(data->>'id')::uuid then raise exception 'Provider key already maps to another UUID' using errcode='23505'; end if;
  result:=result||jsonb_build_array(jsonb_build_object('table',tbl,'id',saved));
 end loop;
 return result;
end $$;
notify pgrst,'reload schema';

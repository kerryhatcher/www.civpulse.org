-- Avoid scanning content tables and the entire log to gate deleted relationships.
create index revisions_object_idx on audit.revisions(table_name, object_id, id desc);

create or replace function audit.subjects_public(p_subjects jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare s jsonb; config audit.objects; row_data jsonb; info jsonb; key_data jsonb; tombstone audit.revisions; predicate text;
begin
  for s in select distinct value from jsonb_array_elements(p_subjects) loop
    select * into config from audit.objects where table_name = s->>'table';
    if not found then return false; end if;
    if config.key_columns = array['id'] then
      -- UUID and bigint lookups use the existing primary-key indexes.
      execute format('select to_jsonb(t) from public.%I t where id = $1::%s',
        config.table_name, case when config.table_name = 'layer_features' then 'bigint' else 'uuid' end)
        into row_data using s->>'id';
    else
      key_data := (s->>'id')::jsonb;
      select string_agg(format('%I = ($1->>%L)::uuid',k,k),' and ') into predicate
        from unnest(config.key_columns) k;
      execute format('select to_jsonb(t) from public.%I t where %s',config.table_name,predicate)
        into row_data using key_data;
    end if;
    if row_data is null then
      select * into tombstone from audit.revisions
        where table_name = s->>'table' and object_id = s->>'id' order by id desc limit 1;
      if not found or tombstone.operation <> 'DELETE' or not tombstone.public_at_change then return false; end if;
      row_data := tombstone.before_data;
    end if;
    info := audit.describe_row(config.table_name,row_data);
    if not coalesce((info->>'public')::boolean,false) then return false; end if;
  end loop;
  return true;
end;
$$;

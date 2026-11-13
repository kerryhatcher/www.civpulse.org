-- Keep derived search indexes out of revisions; private storage paths are admin-only.
create or replace function audit.capture() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b jsonb; a jsonb; bi jsonb; ai jsonb; actor uuid := auth.uid(); name text;
begin
  if tg_op <> 'INSERT' then b := to_jsonb(old) - 'search_vector' - 'search_document' - 'site_search_document' - 'updated_at'; end if;
  if tg_op <> 'DELETE' then a := to_jsonb(new) - 'search_vector' - 'search_document' - 'site_search_document' - 'updated_at'; end if;
  if b is not distinct from a then return null; end if;
  bi := audit.describe_row(tg_table_name,b);
  ai := audit.describe_row(tg_table_name,a);
  select nullif(trim(display_name),'') into name from public.profiles where id = actor;
  insert into audit.revisions(table_name,object_id,operation,actor_id,actor_name,before_data,after_data,public_at_change,subjects)
  values(tg_table_name,coalesce(ai->>'id',bi->>'id'),tg_op,actor,
    coalesce(name,case when actor is null then 'System / import' else 'Editor' end),b,a,
    coalesce((bi->>'public')::boolean,true) and coalesce((ai->>'public')::boolean,true),
    coalesce(bi->'subjects','[]'::jsonb) || coalesce(ai->'subjects','[]'::jsonb));
  return null;
end;
$$;

create or replace function public.get_object_history(
  p_table text default null, p_object_id text default null,
  p_before bigint default null, p_limit integer default 25
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare admin boolean := public.is_admin(); result jsonb;
begin
  -- Only admins can browse the global feed. Public requests require an object.
  if not admin and (p_table is null or p_object_id is null) then
    return jsonb_build_object('admin',false,'revisions','[]'::jsonb);
  end if;
  if p_table is not null and not exists(select 1 from audit.objects where table_name=p_table) then
    return jsonb_build_object('admin',admin,'revisions','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(item order by id desc),'[]'::jsonb) into result from (
    select r.id, jsonb_build_object('id',r.id::text,'changed_at',r.changed_at,
      'transaction_id',r.transaction_id::text,'table_name',r.table_name,'object_id',r.object_id,
      'operation',r.operation,'actor_name',r.actor_name,
      'actor_id',case when admin then r.actor_id else null end,
      'before',case when admin then r.before_data else r.before_data - 'storage_path' end,
      'after',case when admin then r.after_data else r.after_data - 'storage_path' end) as item
    from audit.revisions r
    where (p_before is null or r.id < p_before)
      and (p_table is null or (p_object_id is null and r.table_name=p_table)
        or r.subjects @> jsonb_build_array(jsonb_build_object('table',p_table,'id',p_object_id)))
      and (admin or (r.public_at_change and audit.subjects_public(r.subjects)))
    order by r.id desc limit greatest(1,least(coalesce(p_limit,25),100))
  ) revisions;
  return jsonb_build_object('admin',admin,'revisions',result);
end;
$$;

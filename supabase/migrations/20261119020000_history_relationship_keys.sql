-- Accept canonical relationship keys from links and copied JSON.
create or replace function public.get_object_history(
  p_table text default null, p_object_id text default null,
  p_before bigint default null, p_limit integer default 25
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare admin boolean := public.is_admin(); result jsonb; keys text[];
begin
  -- Only admins can browse the global feed. Public requests require an object.
  if not admin and (p_table is null or p_object_id is null) then
    return jsonb_build_object('admin',false,'revisions','[]'::jsonb);
  end if;
  if p_table is not null and not exists(select 1 from audit.objects where table_name=p_table) then
    return jsonb_build_object('admin',admin,'revisions','[]'::jsonb);
  end if;
  select key_columns into keys from audit.objects where table_name = p_table;
  if p_object_id is not null and keys <> array['id'] then
    begin
      p_object_id := p_object_id::jsonb::text;
    exception when invalid_text_representation then
      return jsonb_build_object('admin',admin,'revisions','[]'::jsonb);
    end;
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

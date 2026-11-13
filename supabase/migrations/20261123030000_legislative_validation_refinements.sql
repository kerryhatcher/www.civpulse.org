create or replace function public.import_legislation(p_records jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb; tbl text; data jsonb; col text; columns_sql text; values_sql text; updates_sql text;
 saved uuid; result jsonb:='[]';
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
   if col in ('created_at','updated_at') or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=tbl and column_name=col) then
    raise exception 'Unknown or managed import field %',col using errcode='22023'; end if;
   columns_sql:=columns_sql||format('%I,',col);values_sql:=values_sql||format('r.%I,',col);
   if col<>'id' then updates_sql:=updates_sql||format('%I=r.%I,',col,col); end if;
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
create function legislative_private.visible(p_table text,p_row jsonb,p_direct uuid,p_bill uuid,p_person uuid,p_vote uuid)
returns boolean language plpgsql stable set search_path='' as $$
declare parent record; parent_row jsonb; vis text; begin
 if p_row is null then return false; end if;
 if public.is_admin() then return true; end if;
 vis:=coalesce(p_row->>'visibility','public');
 if vis='private' then return false; end if;
 if vis='unlisted' and not coalesce((p_row->>'id')::uuid=p_direct or
   (p_table='bills' and (p_row->>'id')::uuid=p_bill) or
   (p_table='people' and (p_row->>'id')::uuid=p_person) or (p_table='legislative_votes' and (p_row->>'id')::uuid=p_vote),false) then return false; end if;
 for parent in select key,value from jsonb_each_text((select parents from audit.objects where table_name=p_table)) loop
  if p_row->>parent.key is not null then
   execute format('select to_jsonb(t) from public.%I t where id=$1',parent.value) into parent_row using (p_row->>parent.key)::uuid;
   if not legislative_private.visible(parent.value,parent_row,null,p_bill,p_person,p_vote) then return false; end if;
  end if;
 end loop;
 return true;
end $$;

revoke all on function legislative_private.visible(text,jsonb,uuid,uuid,uuid,uuid) from public;
drop function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid);
create or replace function public.browse_legislation(p_table text default 'bills',p_id uuid default null,
 p_filters jsonb default '{}',p_query text default '',p_limit integer default 25,p_offset integer default 0,
 p_bill_id uuid default null,p_person_id uuid default null,p_vote_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; k text; predicates text:=''; begin
 if p_table not in ('legislative_terms','legislative_sessions','legislative_bodies','legislative_body_memberships','bills','bill_versions',
 'bill_amendments','bill_actions','bill_relationships','bill_sponsorships','bill_positions','legislative_votes',
 'legislative_vote_bills','legislative_vote_choices','article_bills','legislative_event_links') then
 raise exception 'Unknown legislative resource' using errcode='22023'; end if;
 if jsonb_typeof(p_filters)<>'object' or length(p_filters::text)>4000 or length(p_query)>500 then raise exception 'Invalid filters' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_filters) loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=k) then raise exception 'Unknown filter' using errcode='22023'; end if;
  predicates:=predicates||format(' and t.%I = (jsonb_populate_record(null::public.%I,$2)).%I',k,p_table,k);
 end loop;
 execute format($q$
 with permitted as (
  select to_jsonb(t) as row from public.%I t
  where ($1 is null or t.id=$1) %s
   and ($3='' or concat_ws(' ',to_jsonb(t)->>'title',to_jsonb(t)->>'name',to_jsonb(t)->>'identifier',to_jsonb(t)->>'question',to_jsonb(t)->>'summary') ilike '%%'||$3||'%%')
   and legislative_private.visible(%L,to_jsonb(t),$1,$6,$7,$8)
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
 select jsonb_agg(row || legislative_private.details(%L,row)) from (select row from permitted order by coalesce(row->>'occurred_on',row->>'introduced_on',row->>'starts_on',row->>'published_on',row->>'created_at') desc,coalesce((row->>'sequence')::integer,0),row->>'id' limit $4 offset $5) paged),'[]'::jsonb))
 $q$,p_table,predicates,p_table,p_table) into result using p_id,p_filters,p_query,least(greatest(coalesce(p_limit,25),1),100),greatest(coalesce(p_offset,0),0),p_bill_id,p_person_id,p_vote_id;
 return result;
end $$;

revoke all on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) from public;
grant execute on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) to anon,authenticated;
create function public.get_legislative_vote_totals(p_vote_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with v as (select * from public.legislative_votes t where id=p_vote_id and legislative_private.visible('legislative_votes',to_jsonb(t),p_vote_id)),
 counts as (select count(*)::int total,count(*) filter(where choice='yes')::int yes,count(*) filter(where choice='no')::int no,
 count(*) filter(where choice not in ('yes','no'))::int other
 from public.legislative_vote_choices c where vote_id=p_vote_id and legislative_private.visible('legislative_vote_choices',to_jsonb(c),null,null,null,p_vote_id))
 select jsonb_build_object('recorded',to_jsonb(counts),'reported',jsonb_build_object('yes',v.reported_yes,'no',v.reported_no,'other',v.reported_other),
 'coverage',v.coverage,'matches_reported',case when v.coverage='complete' and v.reported_yes is not null and v.reported_no is not null and v.reported_other is not null
 then (counts.yes=v.reported_yes and counts.no=v.reported_no and counts.other=v.reported_other) else null end) from v cross join counts;
$$;
revoke all on function public.get_legislative_vote_totals(uuid) from public;
grant execute on function public.get_legislative_vote_totals(uuid) to anon,authenticated;
notify pgrst,'reload schema';

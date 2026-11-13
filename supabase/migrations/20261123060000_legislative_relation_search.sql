-- Search readable relation labels only after the recursive visibility gate.
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
 with visible_rows as materialized (
  select to_jsonb(t) as row from public.%I t
  where ($1 is null or t.id=$1) %s
   and legislative_private.visible(%L,to_jsonb(t),$1,$6,$7,$8)
 ), permitted as (
  select row from visible_rows
  where $3='' or concat_ws(' ',row->>'title',row->>'name',row->>'identifier',row->>'question',row->>'summary',
    (select string_agg(value,' ') from jsonb_each_text(legislative_private.details(%L,row)->'labels'))) ilike '%%'||$3||'%%'
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
 select jsonb_agg(row || legislative_private.details(%L,row)) from (select row from permitted order by coalesce(row->>'occurred_on',row->>'introduced_on',row->>'starts_on',row->>'published_on',row->>'created_at') desc,coalesce((row->>'sequence')::integer,0),row->>'id' limit $4 offset $5) paged),'[]'::jsonb))
 $q$,p_table,predicates,p_table,p_table,p_table) into result using p_id,p_filters,p_query,least(greatest(coalesce(p_limit,25),1),100),greatest(coalesce(p_offset,0),0),p_bill_id,p_person_id,p_vote_id;
 return result;
end $$;

revoke all on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) from public;
grant execute on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) to anon,authenticated;

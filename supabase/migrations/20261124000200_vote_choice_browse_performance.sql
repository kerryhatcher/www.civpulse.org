-- Resolve shared vote and office-term visibility once rather than recursively
-- walking identical parents for every member choice in the publication export.
create or replace function legislative_private.visible_vote_choice_ids(p_direct uuid default null,p_person uuid default null,p_vote uuid default null)
returns setof uuid language sql stable set search_path='' as $choices$
 with access as materialized (select public.is_admin() admin),
 votes as materialized (select legislative_private.visible_vote_ids(p_person,null,p_vote) id),
 service as materialized (
  select t.id from public.office_terms t
  where legislative_private.visible('office_terms',to_jsonb(t),null,null,p_person,p_vote)
 )
 select c.id from public.legislative_vote_choices c
 join votes v on v.id=c.vote_id join service s on s.id=c.office_term_id cross join access a
 where a.admin or c.visibility='public' or (c.visibility='unlisted' and c.id=p_direct);
$choices$;
revoke all on function legislative_private.visible_vote_choice_ids(uuid,uuid,uuid) from public,anon,authenticated;

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
   and case
    when %L='bills' then t.id in (select legislative_private.visible_bill_ids($1,$6,$7,$8))
    when %L='legislative_votes' then t.id in (select legislative_private.visible_vote_ids($7,$1,$8))
    when %L='legislative_vote_bills' then t.id in (select legislative_private.visible_vote_bill_ids($1,$6,$7,$8))
    when %L='legislative_vote_choices' then t.id in (select legislative_private.visible_vote_choice_ids($1,$7,$8))
    else legislative_private.visible(%L,to_jsonb(t),$1,$6,$7,$8) end
 ), permitted as (
  select row from visible_rows
  left join public.legislative_terms lt on $9='bills' and lt.id=(row->>'term_id')::uuid
  left join public.legislative_sessions ls on $9='bills' and ls.id=(row->>'session_id')::uuid
  left join public.legislative_bodies lb on $9='bills' and lb.id=(row->>'body_id')::uuid
  left join public.organizations org on org.id=lb.organization_id
  where $3='' or concat_ws(' ',row->>'title',row->>'name',row->>'identifier',row->>'question',row->>'summary',
    case when $9='bills' then concat_ws(' ',lt.name,ls.name,org.name) else (select string_agg(value,' ') from jsonb_each_text(legislative_private.details(%L,row)->'labels')) end) ilike '%%'||$3||'%%'
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
 select jsonb_agg(row || legislative_private.details(%L,row)) from (select row from permitted order by coalesce(row->>'occurred_on',row->>'introduced_on',row->>'starts_on',row->>'published_on',row->>'created_at') desc,coalesce((row->>'sequence')::integer,0),row->>'id' limit $4 offset $5) paged),'[]'::jsonb))
 $q$,p_table,predicates,p_table,p_table,p_table,p_table,p_table,p_table,p_table) into result using p_id,p_filters,p_query,least(greatest(coalesce(p_limit,25),1),100),greatest(coalesce(p_offset,0),0),p_bill_id,p_person_id,p_vote_id,p_table;
 return result;
end $$;

revoke all on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) from public;
grant execute on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) to anon,authenticated;

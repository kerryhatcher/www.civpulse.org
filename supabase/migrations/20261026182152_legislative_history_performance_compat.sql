-- Hosted compatibility repair: existing deployments already have the later legislative schema.
-- Fresh resets skip this repair; the dependency-ordered migration reapplies it afterward.
do $compat$ begin
 if to_regprocedure('public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer,uuid,text)') is not null then
 execute $repair$
-- Resolve shared context once, rather than recursively rechecking it for every vote.
-- Row-level visibility and every registered vote parent retain the same semantics.
create or replace function legislative_private.visible_vote_ids(p_person uuid default null,p_direct uuid default null,p_vote uuid default null)
returns setof uuid language sql stable set search_path='' as $votes$
 with access as materialized (select public.is_admin() admin),
 sessions as materialized (
  select s.id from public.legislative_sessions s
  where legislative_private.visible('legislative_sessions',to_jsonb(s),null,null,p_person,p_vote)
 ), bodies as materialized (
  select b.id from public.legislative_bodies b
  where legislative_private.visible('legislative_bodies',to_jsonb(b),null,null,p_person,p_vote)
 ), events as materialized (
  select e.id from public.events e where e.id in (select v.event_id from public.legislative_votes v where v.event_id is not null)
  and legislative_private.visible('events',to_jsonb(e),null,null,p_person,p_vote)
 )
 select v.id from public.legislative_votes v
 join sessions s on s.id=v.session_id join bodies b on b.id=v.body_id cross join access a
 where (a.admin or v.visibility='public' or (v.visibility='unlisted' and (v.id=p_direct or v.id=p_vote)))
 and (v.event_id is null or v.event_id in (select id from events));
$votes$;
revoke all on function legislative_private.visible_vote_ids(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.get_person_legislative_record(p_person_id uuid,p_session_id uuid default null,p_body_id uuid default null,
 p_category text default null,p_limit integer default 25,p_offset integer default 0,p_term_id uuid default null,p_bill_query text default null)
returns jsonb language sql stable security definer set search_path='' as $record$
 with access as materialized (select public.is_admin() admin),
 service as materialized (
  select t.id,t.office_id from public.office_terms t where t.person_id=p_person_id
  and legislative_private.visible('office_terms',to_jsonb(t),null,null,p_person_id,null)
 ), visible_votes as materialized (select legislative_private.visible_vote_ids(p_person_id,null,null) id),
 permitted as materialized (
  select c.id,c.choice,c.source_choice,c.membership_review_note,v.id vote_id,v.question,v.category,v.method,v.outcome,v.coverage,v.occurred_on,v.source_url,
   v.session_id,v.body_id,o.name office_name,o.district,o.seat,t.id office_term_id
  from public.legislative_vote_choices c join public.legislative_votes v on v.id=c.vote_id
  join visible_votes vv on vv.id=v.id join service t on t.id=c.office_term_id join public.offices o on o.id=t.office_id cross join access a
  where (a.admin or c.visibility='public')
   and (p_session_id is null or v.session_id=p_session_id) and (p_body_id is null or v.body_id=p_body_id)
   and (p_category is null or v.category=p_category)
   and (p_term_id is null or exists(select 1 from public.legislative_sessions s where s.id=v.session_id and s.term_id=p_term_id))
   and (nullif(p_bill_query,'') is null or exists(select 1 from public.legislative_vote_bills l join public.bills b on b.id=l.bill_id where l.vote_id=v.id
    and (b.identifier ilike '%'||left(p_bill_query,500)||'%' or b.title ilike '%'||left(p_bill_query,500)||'%')
    and legislative_private.visible('legislative_vote_bills',to_jsonb(l))))
 ), paged as (
  select * from permitted order by occurred_on desc,id limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)
 )
 select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
  select jsonb_agg(to_jsonb(x)||jsonb_build_object('bills',coalesce((
   select jsonb_agg(jsonb_build_object('id',b.id,'identifier',b.identifier,'title',b.title))
   from public.legislative_vote_bills l join public.bills b on b.id=l.bill_id where l.vote_id=x.vote_id
   and legislative_private.visible('legislative_vote_bills',to_jsonb(l))), '[]'::jsonb))) from paged x),'[]'::jsonb));
$record$;
revoke all on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer,uuid,text) from public;
grant execute on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer,uuid,text) to anon,authenticated;

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
   and case when %L='legislative_votes' then t.id in (select legislative_private.visible_vote_ids($7,$1,$8)) else legislative_private.visible(%L,to_jsonb(t),$1,$6,$7,$8) end
 ), permitted as (
  select row from visible_rows
  where $3='' or concat_ws(' ',row->>'title',row->>'name',row->>'identifier',row->>'question',row->>'summary',
    (select string_agg(value,' ') from jsonb_each_text(legislative_private.details(%L,row)->'labels'))) ilike '%%'||$3||'%%'
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
 select jsonb_agg(row || legislative_private.details(%L,row)) from (select row from permitted order by coalesce(row->>'occurred_on',row->>'introduced_on',row->>'starts_on',row->>'published_on',row->>'created_at') desc,coalesce((row->>'sequence')::integer,0),row->>'id' limit $4 offset $5) paged),'[]'::jsonb))
 $q$,p_table,predicates,p_table,p_table,p_table,p_table) into result using p_id,p_filters,p_query,least(greatest(coalesce(p_limit,25),1),100),greatest(coalesce(p_offset,0),0),p_bill_id,p_person_id,p_vote_id;
 return result;
end $$;

revoke all on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) from public;
grant execute on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) to anon,authenticated;

notify pgrst,'reload schema';

$repair$;
 end if;
end $compat$;

-- Resolve shared parent visibility once for the entire directory, preserving direct-ID context.
create or replace function legislative_private.visible_bill_ids(p_direct uuid default null,p_bill uuid default null,p_person uuid default null,p_vote uuid default null)
returns setof uuid language sql stable set search_path='' as $bills$
 with access as materialized (select public.is_admin() admin),
 terms as materialized (select t.id from public.legislative_terms t where legislative_private.visible('legislative_terms',to_jsonb(t),null,p_bill,p_person,p_vote)),
 sessions as materialized (select s.id from public.legislative_sessions s where legislative_private.visible('legislative_sessions',to_jsonb(s),null,p_bill,p_person,p_vote)),
 bodies as materialized (select b.id from public.legislative_bodies b where legislative_private.visible('legislative_bodies',to_jsonb(b),null,p_bill,p_person,p_vote))
 select b.id from public.bills b join terms t on t.id=b.term_id join sessions s on s.id=b.session_id
 join bodies body on body.id=b.body_id cross join access a
 where a.admin or b.visibility='public' or (b.visibility='unlisted' and (b.id=p_direct or b.id=p_bill));
$bills$;
revoke all on function legislative_private.visible_bill_ids(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function legislative_private.visible_vote_bill_ids(p_direct uuid default null,p_bill uuid default null,p_person uuid default null,p_vote uuid default null)
returns setof uuid language sql stable set search_path='' as $links$
 with access as materialized (select public.is_admin() admin),
 bills as materialized (select legislative_private.visible_bill_ids(null,p_bill,p_person,p_vote) id),
 votes as materialized (select legislative_private.visible_vote_ids(p_person,null,p_vote) id)
 select l.id from public.legislative_vote_bills l join bills b on b.id=l.bill_id join votes v on v.id=l.vote_id cross join access a
 where (a.admin or l.visibility='public' or (l.visibility='unlisted' and l.id=p_direct))
 and (l.version_id is null or exists(select 1 from public.bill_versions x where x.id=l.version_id and legislative_private.visible('bill_versions',to_jsonb(x),null,p_bill,p_person,p_vote)))
 and (l.amendment_id is null or exists(select 1 from public.bill_amendments x where x.id=l.amendment_id and legislative_private.visible('bill_amendments',to_jsonb(x),null,p_bill,p_person,p_vote)))
 and (l.action_id is null or exists(select 1 from public.bill_actions x where x.id=l.action_id and legislative_private.visible('bill_actions',to_jsonb(x),null,p_bill,p_person,p_vote)));
$links$;
revoke all on function legislative_private.visible_vote_bill_ids(uuid,uuid,uuid,uuid) from public,anon,authenticated;

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
   and case
    when %L='bills' then t.id in (select legislative_private.visible_bill_ids($1,$6,$7,$8))
    when %L='legislative_votes' then t.id in (select legislative_private.visible_vote_ids($7,$1,$8))
    when %L='legislative_vote_bills' then t.id in (select legislative_private.visible_vote_bill_ids($1,$6,$7,$8))
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
 $q$,p_table,predicates,p_table,p_table,p_table,p_table,p_table,p_table) into result using p_id,p_filters,p_query,least(greatest(coalesce(p_limit,25),1),100),greatest(coalesce(p_offset,0),0),p_bill_id,p_person_id,p_vote_id,p_table;
 return result;
end $$;

revoke all on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) from public;
grant execute on function public.browse_legislation(text,uuid,jsonb,text,integer,integer,uuid,uuid,uuid) to anon,authenticated;

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
    and l.id in (select legislative_private.visible_vote_bill_ids())))
 ), paged as (
  select * from permitted order by occurred_on desc,id limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)
 )
 select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
  select jsonb_agg(to_jsonb(x)||jsonb_build_object('bills',coalesce((
   select jsonb_agg(jsonb_build_object('id',b.id,'identifier',b.identifier,'title',b.title))
   from public.legislative_vote_bills l join public.bills b on b.id=l.bill_id where l.vote_id=x.vote_id
   and l.id in (select legislative_private.visible_vote_bill_ids())), '[]'::jsonb))) from paged x),'[]'::jsonb));
$record$;
revoke all on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer,uuid,text) from public;
grant execute on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer,uuid,text) to anon,authenticated;


-- Group visibility-approved member choices before paging. Keep the original per-vote RPC unchanged.
create or replace function public.get_person_legislative_bill_groups(p_person_id uuid,p_session_id uuid default null,p_body_id uuid default null,
 p_category text default null,p_limit integer default 25,p_offset integer default 0,p_term_id uuid default null,p_bill_query text default null)
returns jsonb language sql stable security definer set search_path='' as $record$
 with access as materialized (select public.is_admin() admin),
 service as materialized (
  select t.id,t.office_id from public.office_terms t where t.person_id=p_person_id
  and legislative_private.visible('office_terms',to_jsonb(t),null,null,p_person_id,null)
 ), visible_votes as materialized (select legislative_private.visible_vote_ids(p_person_id,null,null) id),
 permitted as materialized (
  select c.id,c.choice,c.source_choice,c.membership_review_note,v.id vote_id,v.question,v.category,v.method,v.outcome,v.coverage,v.occurred_on,v.occurred_at,v.source_url,
   v.session_id,v.body_id,o.name office_name,o.district,o.seat,t.id office_term_id
  from public.legislative_vote_choices c join public.legislative_votes v on v.id=c.vote_id
  join visible_votes vv on vv.id=v.id join service t on t.id=c.office_term_id join public.offices o on o.id=t.office_id cross join access a
  where (a.admin or c.visibility='public')
   and (p_session_id is null or v.session_id=p_session_id) and (p_body_id is null or v.body_id=p_body_id)
   and (p_category is null or v.category=p_category)
   and (p_term_id is null or exists(select 1 from public.legislative_sessions s where s.id=v.session_id and s.term_id=p_term_id))

 ), associations as materialized (
  select distinct l.vote_id,b.id bill_id,b.identifier bill_identifier,b.title bill_title
  from public.legislative_vote_bills l join public.bills b on b.id=l.bill_id
  where l.vote_id in (select vote_id from permitted)
   and l.id in (select legislative_private.visible_vote_bill_ids())
 ), grouped as (
  select p.*,b.bill_id,b.bill_identifier,b.bill_title,
   coalesce(b.bill_id,p.vote_id) group_id,
   count(*) over (partition by coalesce(b.bill_id,p.vote_id)) vote_count,
   row_number() over (partition by coalesce(b.bill_id,p.vote_id)
    order by p.occurred_on desc,p.occurred_at desc nulls last,p.vote_id) position
  from permitted p left join associations b on b.vote_id=p.vote_id
  where nullif(p_bill_query,'') is null
   or b.bill_identifier ilike '%'||left(p_bill_query,500)||'%'
   or b.bill_title ilike '%'||left(p_bill_query,500)||'%'
 ), latest as materialized (select * from grouped where position=1),
 paged as (
  select * from latest order by occurred_on desc,occurred_at desc nulls last,group_id
  limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)
 )
 select jsonb_build_object('total',(select count(*) from latest),'rows',coalesce((
  select jsonb_agg(to_jsonb(x)-'position' order by occurred_on desc,occurred_at desc nulls last,group_id)
  from paged x),'[]'::jsonb));
$record$;
revoke all on function public.get_person_legislative_bill_groups(uuid,uuid,uuid,text,integer,integer,uuid,text) from public;
grant execute on function public.get_person_legislative_bill_groups(uuid,uuid,uuid,text,integer,integer,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';

notify pgrst,'reload schema';

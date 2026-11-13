-- Ensure the shared visibility helper also exists on fresh local databases.
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
   and legislative_private.visible('legislative_vote_bills',to_jsonb(l))
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

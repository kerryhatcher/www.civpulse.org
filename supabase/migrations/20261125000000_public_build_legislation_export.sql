-- Public build pagination: count lightweight IDs and project only the selected
-- page. Reuse the exact anonymous discovery gates; never allow hidden contexts.
create function public.export_public_legislation_page(p_table text,p_offset integer default 0,p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare dates text; sequence_expression text; result jsonb;
begin
 if (select auth.uid()) is not null then raise exception 'Public exports require the anonymous build client' using errcode='42501'; end if;
 if p_table is null or p_table not in ('legislative_terms','legislative_sessions','legislative_bodies','bills','legislative_votes',
  'bill_actions','bill_versions','bill_amendments','bill_sponsorships','bill_positions','article_bills','bill_relationships','legislative_vote_bills','legislative_vote_choices') then
  raise exception 'Unknown public legislative resource' using errcode='22023'; end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>500 then
  raise exception 'Expected nonnegative offset and limit between 1 and 500' using errcode='22023'; end if;
 -- Match browse_legislation's discovery ordering without converting every full
 -- source/provenance row to JSON before counting and pagination.
 select string_agg(format('t.%I::text',column_name),',' order by array_position(array['occurred_on','introduced_on','starts_on','published_on','created_at'],column_name)) into dates
 from information_schema.columns where table_schema='public' and table_name=p_table
  and column_name in ('occurred_on','introduced_on','starts_on','published_on','created_at');
 sequence_expression:=case when exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='sequence') then 't.sequence' else '0' end;
 execute format($query$
 with permitted as materialized (
  select t.id,coalesce(%s) sort_date,%s sort_sequence from public.%I t
  where t.visibility='public' and case
   when %L='bills' then t.id in (select legislative_private.visible_bill_ids())
   when %L='legislative_votes' then t.id in (select legislative_private.visible_vote_ids())
   when %L='legislative_vote_bills' then t.id in (select legislative_private.visible_vote_bill_ids())
   when %L='legislative_vote_choices' then t.id in (select legislative_private.visible_choice_ids())
   when %L='bill_actions' then t.id in (select legislative_private.visible_action_ids())
   when %L='bill_sponsorships' then t.id in (select legislative_private.visible_sponsorship_ids())
   else legislative_private.visible(%L,to_jsonb(t),null,null,null,null) end
 ), paged as (
  select * from permitted order by sort_date desc,sort_sequence,id limit $1 offset $2
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
  select jsonb_agg(to_jsonb(t)||legislative_private.details(%L,to_jsonb(t)) order by p.sort_date desc,p.sort_sequence,p.id)
  from paged p join public.%I t on t.id=p.id),'[]'::jsonb))
 $query$,dates,sequence_expression,p_table,p_table,p_table,p_table,p_table,p_table,p_table,p_table,p_table,p_table) into result using p_limit,p_offset;
 return result;
end $$;
revoke all on function public.export_public_legislation_page(text,integer,integer) from public,anon,authenticated;
grant execute on function public.export_public_legislation_page(text,integer,integer) to anon;
notify pgrst,'reload schema';

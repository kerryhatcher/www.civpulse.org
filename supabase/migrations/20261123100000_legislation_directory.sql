-- Jurisdiction is explicit metadata, not inferred from a bill number or sponsor's district.
alter table public.legislative_terms
 add column jurisdiction text not null default 'unspecified'
   check (jurisdiction in ('federal','state','unspecified')),
 add column state_name text,
 add constraint legislative_term_state check (
   (jurisdiction = 'state' and state_name is not null and length(btrim(state_name)) between 1 and 100)
   or (jurisdiction <> 'state' and state_name is null));

-- Classify only recognized legislatures; leave other existing terms unclassified.
update public.legislative_terms t set jurisdiction='federal'
from public.organizations o where o.id=t.organization_id
and o.slug in ('united-states-congress','us-congress','u-s-congress');
update public.legislative_terms t set jurisdiction='state',state_name='Georgia'
from public.organizations o where o.id=t.organization_id and o.slug='georgia-general-assembly';

create function public.browse_bills(p_query text default '', p_term_id uuid default null,
 p_jurisdiction text default '', p_state text default '', p_sort text default 'newest',
 p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_jurisdiction not in ('','federal','state','unspecified')
 or p_sort not in ('newest','oldest','title_asc','title_desc')
 or length(p_query)>500 or length(p_state)>100 then
   raise exception 'Invalid bill browsing options' using errcode='22023';
 end if;
 with access as materialized (select public.is_admin() admin),
 terms as materialized (select t.* from public.legislative_terms t where legislative_private.visible('legislative_terms',to_jsonb(t))),
 sessions as materialized (select s.* from public.legislative_sessions s where legislative_private.visible('legislative_sessions',to_jsonb(s))),
 bodies as materialized (select b.* from public.legislative_bodies b where legislative_private.visible('legislative_bodies',to_jsonb(b))),
 visible_rows as materialized (
  select to_jsonb(b) as row, t.jurisdiction,t.state_name, concat_ws(' ',t.name,s.name,o.name) context_labels
  from public.bills b join terms t on t.id=b.term_id
  join sessions s on s.id=b.session_id join bodies body on body.id=b.body_id
  join public.organizations o on o.id=body.organization_id cross join access a
  where (p_term_id is null or b.term_id=p_term_id)
   and (p_jurisdiction='' or t.jurisdiction=p_jurisdiction)
   and (p_state='' or (t.jurisdiction='state' and t.state_name=p_state))
   and (a.admin or b.visibility='public')
 ), matched as materialized (
  select row,jurisdiction,state_name from visible_rows
  where p_query='' or concat_ws(' ',row->>'title',row->>'identifier',row->>'summary',context_labels) ilike '%'||p_query||'%'
 ), paged as (
  select row,jurisdiction,state_name from matched order by
   case when p_sort='newest' then row->>'introduced_on' end desc,
   case when p_sort='oldest' then row->>'introduced_on' end asc,
   case when p_sort='title_asc' then lower(row->>'title') end asc,
   case when p_sort='title_desc' then lower(row->>'title') end desc,
   row->>'identifier',row->>'id'
  limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)
 ) select jsonb_build_object('total',(select count(*) from matched),
  'rows',coalesce((select jsonb_agg(row || legislative_private.details('bills',row) || jsonb_build_object('jurisdiction',jurisdiction,'state_name',state_name)) from paged),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.browse_bills(text,uuid,text,text,text,integer,integer) from public;
grant execute on function public.browse_bills(text,uuid,text,text,text,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';

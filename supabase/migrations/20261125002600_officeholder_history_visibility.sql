create or replace function public.read_officeholder_observations(p_person_id uuid default null,p_organization_id uuid default null,p_as_of date default null,p_history boolean default false,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if (p_person_id is null and p_organization_id is null) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'Parent UUID and bounded pagination required';end if;
 with visible as (
 select o.id,o.provider,o.source_key,o.revision,o.supersedes_id,o.recorded_at,o.payload,
 p.slug person_slug,g.slug organization_slug,
 exists(select 1 from public.officeholder_observations n where n.supersedes_id=o.id) superseded
 from public.officeholder_observations o join public.organizations g on g.id=o.organization_id left join public.people p on p.id=o.person_id
 where (p_person_id is null or o.person_id=p_person_id) and (p_organization_id is null or o.organization_id=p_organization_id)
 and ((select public.is_admin()) or (o.payload->>'visibility'='public' and (o.person_id is null or p.visibility='public')
 and exists(select 1 from public.officeholder_observations latest left join public.people lp on lp.id=latest.person_id
 where latest.provider=o.provider and latest.source_key=o.source_key and latest.payload->>'visibility'='public'
 and (latest.person_id is null or lp.visibility='public')
 and not exists(select 1 from public.officeholder_observations successor where successor.supersedes_id=latest.id))))
 and (p_as_of is null or (o.payload->>'precision'='day' and (o.payload->>'as_of')::date=p_as_of)
 or (o.payload->>'precision'='year' and extract(year from (o.payload->>'as_of')::date)=extract(year from p_as_of)))
 ), selected as(select * from visible where p_history or not superseded), page as(
 select * from selected order by payload->>'as_of' desc nulls last,provider,source_key,revision desc,id offset p_offset limit p_limit)
 select jsonb_build_object('version',1,'scope','Recorded observations only; not a complete roster, service interval or current-office determination',
 'as_of_filter',p_as_of,'history',p_history,'offset',p_offset,'limit',p_limit,'total',(select count(*) from selected),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 return result;
end;$$;
revoke all on function public.read_officeholder_observations(uuid,uuid,date,boolean,integer,integer) from public;
grant execute on function public.read_officeholder_observations(uuid,uuid,date,boolean,integer,integer) to anon,authenticated;

-- Generic audit metadata previously sees only top-level visibility. Explicitly
-- apply snapshot and latest-chain visibility without changing other object gates.
alter function audit.describe_row(text,jsonb) rename to describe_row_without_officeholder_visibility;
create function audit.describe_row(p_table text,p_row jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare info jsonb; readable boolean;
begin
 info:=audit.describe_row_without_officeholder_visibility(p_table,p_row);
 if p_table<>'officeholder_observations' or p_row is null then return info;end if;
 select exists(select 1 from public.officeholder_observations latest left join public.people lp on lp.id=latest.person_id
 where latest.provider=p_row->>'provider' and latest.source_key=p_row->>'source_key'
 and latest.payload->>'visibility'='public' and (latest.person_id is null or lp.visibility='public')
 and not exists(select 1 from public.officeholder_observations successor where successor.supersedes_id=latest.id)) into readable;
 return info||jsonb_build_object('public',coalesce((info->>'public')::boolean,false) and p_row->'payload'->>'visibility'='public' and readable);
end;$$;
revoke all on function audit.describe_row(text,jsonb),audit.describe_row_without_officeholder_visibility(text,jsonb) from public,anon,authenticated;

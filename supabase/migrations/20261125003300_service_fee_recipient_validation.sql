-- Append-only correction: preserve applied 031 and retain all read/history gates.
alter table public.service_fee_reports drop constraint service_fee_reports_check;
alter table public.service_fee_reports add constraint service_fee_reports_check check(
 (organization_id is not null and coalesce(manifest->>'organization_review','')='reviewed') or
 (organization_id is null and coalesce(manifest->>'organization_review','')='unresolved' and visibility<>'public'));

create or replace function public.browse_service_fees(p_organization_id uuid default null,p_year integer default null,p_query text default '',p_recipient_kind text default null,p_recipient_id uuid default null,p_observation_id uuid default null,p_history boolean default false,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or p_query is null or length(p_query)>200 or (p_recipient_kind is not null and p_recipient_kind not in('person','organization')) or (p_recipient_id is not null and p_recipient_kind is null) then raise exception 'Bounded query and typed recipient filter required';end if;
 with latest as materialized(select r.* from public.service_fee_reports r where not exists(select 1 from public.service_fee_reports n where n.supersedes_id=r.id)),
 visible as materialized(
 select o.id,o.source_key,o.payload,r.id report_id,r.provider,r.revision,r.manifest,r.recorded_at,r.organization_id,
 coalesce(g.name,r.manifest->>'reported_organization') organization_name,g.slug organization_slug,o.recipient_person_id,o.recipient_organization_id,
 p.slug recipient_person_slug,v.slug recipient_organization_slug,
 exists(select 1 from public.service_fee_reports n where n.supersedes_id=r.id) superseded
 from public.service_fee_observations o join public.service_fee_reports r on r.id=o.report_id left join public.organizations g on g.id=r.organization_id
 left join public.people p on p.id=o.recipient_person_id left join public.organizations v on v.id=o.recipient_organization_id
 where ((select public.is_admin()) or (r.visibility='public' and o.visibility='public' and (o.recipient_person_id is null or p.visibility='public')
 and exists(select 1 from latest l where l.provider=r.provider and l.source_key=r.source_key and l.visibility='public')))
 and ((select public.is_admin()) or not exists(select 1 from latest l join public.service_fee_observations lo on lo.report_id=l.id and lo.source_key=o.source_key left join public.people lp on lp.id=lo.recipient_person_id where l.provider=r.provider and l.source_key=r.source_key and (lo.visibility<>'public' or (lo.recipient_person_id is not null and lp.visibility<>'public'))))
 and (p_history or not exists(select 1 from public.service_fee_reports n where n.supersedes_id=r.id))
 and (p_organization_id is null or r.organization_id=p_organization_id) and (p_year is null or (r.manifest->>'year')::integer=p_year)
 and (p_recipient_kind is null or (p_recipient_kind='person' and o.recipient_person_id is not null) or (p_recipient_kind='organization' and o.recipient_organization_id is not null))
 and (p_recipient_id is null or (p_recipient_kind='person' and o.recipient_person_id=p_recipient_id) or (p_recipient_kind='organization' and o.recipient_organization_id=p_recipient_id))
 and (p_observation_id is null or o.id=p_observation_id)),
 selected as(select * from visible where p_query='' or position(lower(p_query) in lower((payload->>'reported_recipient')||' '||organization_name||' '||(payload->>'description')||' '||coalesce(payload->>'reported_category','')))>0),
 page as(select * from selected order by manifest->>'year' desc nulls last,organization_name,payload->>'reported_recipient',revision desc,report_id,id offset p_offset limit p_limit),
 totals as(select report_id,payload->>'reported_category' reported_category,max(organization_name) organization,max(revision) revision,max(manifest->>'year') as "year",max(manifest->>'currency') currency,max(manifest->>'unit') unit,max(manifest->>'measure_label') measure,max(manifest->>'grain') grain,max(manifest->>'period_start') period_start,max(manifest->>'period_end') period_end,max(manifest->>'aggregation') aggregation,count(*) visible_matching_rows,
 case when max(manifest->>'aggregation')='disjoint_rows' then sum((payload->>'amount')::numeric)::text else null end amount from selected where exists(select 1 from page pg where pg.report_id=selected.report_id and (pg.payload->>'reported_category') is not distinct from (selected.payload->>'reported_category')) group by report_id,payload->>'reported_category')
 select jsonb_build_object('version',1,'scope','Only matching visible reported professional-service fees, per diem and expenses. Category totals remain separate per report revision/measure/currency/unit/period/grain and only for source-asserted disjoint rows. May overlap payroll or payment datasets; never combine without source-backed reconciliation.',
 'filters',jsonb_build_object('organization_id',p_organization_id,'year',p_year,'query',p_query,'recipient_kind',p_recipient_kind,'recipient_id',p_recipient_id,'observation_id',p_observation_id,'history',p_history),
 'totals_scope','Report/category groups represented on this page; sums cover matching visible rows in each category group, not necessarily only this page. Never add groups/revisions together.','offset',p_offset,'limit',p_limit,'total',(select count(*) from selected),'totals',coalesce((select jsonb_agg(to_jsonb(totals) order by report_id,reported_category) from totals),'[]'),
 'organizations',coalesce((select jsonb_agg(x order by name) from(select distinct organization_id id,organization_name name from visible)x),'[]'),
 'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 return result;
end;$$;
revoke all on function public.browse_service_fees(uuid,integer,text,text,uuid,uuid,boolean,integer,integer) from public;
grant execute on function public.browse_service_fees(uuid,integer,text,text,uuid,uuid,boolean,integer,integer) to anon,authenticated;

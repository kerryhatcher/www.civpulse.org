-- Reported professional-service fees / per diem are distinct from salary and transaction ledgers.
create table public.service_fee_reports(
 id uuid primary key default gen_random_uuid(),provider text not null,source_key text not null,revision integer not null,
 organization_id uuid references public.organizations(id) on delete restrict,
 visibility text not null check(visibility in('public','unlisted','private')),
 supersedes_id uuid unique references public.service_fee_reports(id),manifest jsonb not null,
 recorded_at timestamptz not null default now(),unique(provider,source_key,revision),
 check((organization_id is not null and manifest->>'organization_review'='reviewed') or
 (organization_id is null and manifest->>'organization_review'='unresolved' and visibility<>'public'))
);
create table public.service_fee_observations(
 id uuid primary key default gen_random_uuid(),report_id uuid not null references public.service_fee_reports(id),
 source_key text not null,visibility text not null check(visibility in('public','unlisted','private')),
 recipient_person_id uuid references public.people(id) on delete restrict,
 recipient_organization_id uuid references public.organizations(id) on delete restrict,
 payload jsonb not null,unique(report_id,source_key),check(num_nonnulls(recipient_person_id,recipient_organization_id)<=1)
);
create index service_fee_reports_org on public.service_fee_reports(organization_id);
create index service_fee_recipient_person on public.service_fee_observations(recipient_person_id);
create index service_fee_recipient_org on public.service_fee_observations(recipient_organization_id);
alter table public.service_fee_reports enable row level security;
alter table public.service_fee_observations enable row level security;
revoke all on public.service_fee_reports,public.service_fee_observations from anon,authenticated;
grant select on public.service_fee_reports,public.service_fee_observations to authenticated;
create policy service_fee_report_admin on public.service_fee_reports for select to authenticated using((select public.is_admin()));
create policy service_fee_row_admin on public.service_fee_observations for select to authenticated using((select public.is_admin()));

create function public.accept_service_fee_report(p_version integer,p_provider text,p_report jsonb,p_rows jsonb,p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.service_fee_reports; r jsonb; item jsonb; org uuid; report_id uuid; person uuid; recipient_org uuid; ordered jsonb; result jsonb; idx integer:=0; field text;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501';end if;
 if p_version is distinct from 1 or coalesce(length(p_provider),0) not between 1 and 100 or jsonb_typeof(p_rows) is distinct from 'array'
 or jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text)+octet_length(p_report::text)>1048576 then raise exception 'Version 1; provider; 1–100 rows / 1 MiB required';end if;
 if jsonb_typeof(p_report) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_report) k where k not in('source_key','organization_id','reported_organization','organization_review','report_label','year','period_start','period_end','source_url','retrieved_at','document_sha256','published_on','locator','evidence_status','coverage','visibility','supersedes_id','correction_reason','measure_label','currency','unit','grain','aggregation','aggregation_basis')) then raise exception 'Unknown report fields';end if;
 if exists(select 1 from unnest(array['source_key','reported_organization','report_label','locator','coverage','measure_label','unit','grain']) k where jsonb_typeof(p_report->k) is distinct from 'string' or coalesce(length(btrim(p_report->>k)),0) not between 1 and 2000)
 or not fee_private.https(p_report->>'source_url') or coalesce(p_report->>'document_sha256','')!~'^[a-f0-9]{64}$'
 or coalesce(p_report->>'currency','')!~'^[A-Z]{3}$' or coalesce(p_report->>'organization_review','') not in('reviewed','unresolved')
 or coalesce(p_report->>'evidence_status','') not in('original_verified','indexed_copy_unverified','unverified')
 or coalesce(p_report->>'visibility','') not in('public','unlisted','private') or coalesce(p_report->>'aggregation','') not in('disjoint_rows','not_additive')
 or (p_report->>'aggregation'='disjoint_rows' and coalesce(length(btrim(p_report->>'aggregation_basis')),0) not between 1 and 2000) then raise exception 'Source/provenance, explicit service_fee measure/currency/unit/grain and aggregation evidence required';end if;
 org:=(p_report->>'organization_id')::uuid;
 if (org is null)<>(p_report->>'organization_review'='unresolved') or (org is not null and not exists(select 1 from public.organizations where id=org)) or (p_report->>'visibility'='public' and org is null) then raise exception 'Public payer requires reviewed existing org UUID; unresolved raw labels stay unlinked/private';end if;
 if p_report->>'year' is not null and (jsonb_typeof(p_report->'year')<>'number' or p_report->>'year'!~'^[0-9]{4}$') then raise exception 'Source year integer or null required';end if;
 if coalesce(p_report->>'retrieved_at','')!~'^\d{4}-\d{2}-\d{2}T.+(Z|[+-][0-9]{2}:[0-9]{2})$' or not isfinite((p_report->>'retrieved_at')::timestamptz) or (p_report->>'retrieved_at')::timestamptz>now() then raise exception 'Actual retrieval timestamp with timezone required';end if;
 foreach field in array array['period_start','period_end','published_on'] loop
 if p_report->>field is not null and (p_report->>field!~'^\d{4}-\d{2}-\d{2}$' or not isfinite((p_report->>field)::date)) then raise exception 'ISO source date or null required';end if;end loop;
 if (p_report->>'period_start')::date>(p_report->>'period_end')::date then raise exception 'Reporting period order invalid';end if;
 select jsonb_agg(value order by value->>'source_key') into ordered from jsonb_array_elements(p_rows);
 if exists(select 1 from jsonb_array_elements(p_rows) q group by q->>'source_key' having count(*)>1) then raise exception 'Duplicate source observation keys';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider||':'||(p_report->>'source_key'),152));
 select * into previous from public.service_fee_reports where provider=p_provider and source_key=p_report->>'source_key' order by revision desc limit 1;
 if found then
 if previous.manifest=p_report and (select jsonb_agg(payload order by source_key) from public.service_fee_observations where service_fee_observations.report_id=previous.id)=ordered then return jsonb_build_object('status','unchanged','report_id',previous.id,'rows',jsonb_array_length(p_rows));end if;
 if p_report->>'supersedes_id' is distinct from previous.id::text or coalesce(length(btrim(p_report->>'correction_reason')),0) not between 1 and 2000 then return jsonb_build_object('status','conflict','current_report_id',previous.id);end if;
 if previous.organization_id is not null and org is distinct from previous.organization_id then raise exception 'Cannot move reviewed payer identity';end if;
 elsif p_report->>'supersedes_id' is not null then raise exception 'No report to supersede';end if;
 begin
 insert into public.service_fee_reports(provider,source_key,revision,organization_id,visibility,supersedes_id,manifest) values(p_provider,p_report->>'source_key',coalesce(previous.revision,0)+1,org,p_report->>'visibility',previous.id,p_report) returning id into report_id;
 for r in select value from jsonb_array_elements(ordered) loop
 idx:=idx+1;person:=null;recipient_org:=null;
 if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) k where k not in('source_key','reported_recipient','recipient_kind','recipient_id','recipient_review','amount','visibility','locator','description','reported_category','classification','classification_review'))
 or exists(select 1 from unnest(array['source_key','reported_recipient','locator']) k where jsonb_typeof(r->k) is distinct from 'string' or coalesce(length(btrim(r->>k)),0) not between 1 and 2000)
 or not fee_private.decimal(r->'amount',true) or coalesce(r->>'visibility','') not in('public','unlisted','private') then raise exception 'Stable row/raw recipient/locator, exact signed decimal string and visibility required';end if;
 if r->>'recipient_kind'='person' and r->>'recipient_review'='reviewed' then
 person:=(r->>'recipient_id')::uuid;if person is null or not exists(select 1 from public.people where id=person) then raise exception 'Existing reviewed recipient person UUID required';end if;
 elsif r->>'recipient_kind'='organization' and r->>'recipient_review'='reviewed' then
 recipient_org:=(r->>'recipient_id')::uuid;if recipient_org is null or not exists(select 1 from public.organizations where id=recipient_org) then raise exception 'Existing reviewed recipient organization UUID required';end if;
 elsif r->>'recipient_kind'='unresolved' and r->>'recipient_review'='unresolved' and r->>'recipient_id' is null and r->>'visibility'<>'public' then null;
 else raise exception 'Vendor must be reviewed existing person/org, or unresolved unlinked/private; never guess';end if;
 if exists(select 1 from unnest(array['description']) k where jsonb_typeof(r->k) is distinct from 'string' or coalesce(length(btrim(r->>k)),0) not between 1 and 2000) then raise exception 'Original source description and category required; retain exact text';end if;
 if not(r ? 'reported_category') or (r->>'reported_category' is not null and (jsonb_typeof(r->'reported_category') is distinct from 'string' or coalesce(length(btrim(r->>'reported_category')),0) not between 1 and 2000)) then raise exception 'Original reported category text or explicit null if absent required';end if;
 if coalesce(r->>'classification_review','') not in('reviewed','unresolved') or (r->>'classification_review'='reviewed' and (jsonb_typeof(r->'classification') is distinct from 'string' or coalesce(length(btrim(r->>'classification')),0) not between 1 and 2000)) or (r->>'classification_review'='unresolved' and r->>'classification' is not null) then raise exception 'Reviewed classification text or explicit unresolved null required; never infer profession or employment';end if;
 insert into public.service_fee_observations(report_id,source_key,visibility,recipient_person_id,recipient_organization_id,payload) values(report_id,r->>'source_key',r->>'visibility',person,recipient_org,r);
 end loop;
 result:=jsonb_build_object('status','created','report_id',report_id,'revision',coalesce(previous.revision,0)+1,'rows',idx,'dry_run',coalesce(p_dry_run,true));
 if coalesce(p_dry_run,true) then raise exception using errcode='P0052',message='dry run';end if;
 exception when sqlstate 'P0052' then return result;
 when others then return jsonb_build_object('status','rejected','index',idx-1,'message',sqlerrm,'rows',0);end;
 return result;
end;$$;
revoke all on function public.accept_service_fee_report(integer,text,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.accept_service_fee_report(integer,text,jsonb,jsonb,boolean) to authenticated;

create function public.browse_service_fees(p_organization_id uuid default null,p_year integer default null,p_query text default '',p_recipient_kind text default null,p_recipient_id uuid default null,p_observation_id uuid default null,p_history boolean default false,p_offset integer default 0,p_limit integer default 50)
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
insert into audit.objects(table_name,key_columns,parents) values
 ('service_fee_reports',array['id'],'{"organization_id":"organizations"}'),
 ('service_fee_observations',array['id'],'{"report_id":"service_fee_reports","recipient_person_id":"people","recipient_organization_id":"organizations"}');
create trigger record_history after insert on public.service_fee_reports for each row execute function audit.capture();
create trigger record_history after insert on public.service_fee_observations for each row execute function audit.capture();
create trigger frontend_rebuild_required after insert on public.service_fee_reports for each statement execute function frontend_private.mark_frontend_rebuild_required();
alter function audit.describe_row(text,jsonb) rename to describe_row_without_service_fee_visibility;
create function audit.describe_row(p_table text,p_row jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare info jsonb; readable boolean;
begin
 info:=audit.describe_row_without_service_fee_visibility(p_table,p_row);
 if p_row is null then return info;end if;
 if p_table='service_fee_observations' then
 select not exists(select 1 from public.service_fee_reports parent join public.service_fee_reports l on l.provider=parent.provider and l.source_key=parent.source_key join public.service_fee_observations lo on lo.report_id=l.id and lo.source_key=p_row->>'source_key' left join public.people lp on lp.id=lo.recipient_person_id
 where parent.id=(p_row->>'report_id')::uuid and not exists(select 1 from public.service_fee_reports n where n.supersedes_id=l.id) and (lo.visibility<>'public' or (lo.recipient_person_id is not null and lp.visibility<>'public'))) into readable;
 return info||jsonb_build_object('public',coalesce((info->>'public')::boolean,false) and readable);
 end if;
 if p_table<>'service_fee_reports' then return info;end if;
 select exists(select 1 from public.service_fee_reports l where l.provider=p_row->>'provider' and l.source_key=p_row->>'source_key' and l.visibility='public' and not exists(select 1 from public.service_fee_reports n where n.supersedes_id=l.id)) into readable;
 return info||jsonb_build_object('public',coalesce((info->>'public')::boolean,false) and readable);
end;$$;
revoke all on function audit.describe_row(text,jsonb),audit.describe_row_without_service_fee_visibility(text,jsonb) from public,anon,authenticated;

-- Preserve unresolved raw agency labels without inventing placeholder profiles.
alter table public.user_fee_reports alter column organization_id drop not null;
alter table public.user_fees alter column organization_id drop not null;
alter table public.user_fee_reports add constraint fee_report_reviewed_organization check(
 (organization_id is not null and manifest->>'organization_review'='reviewed') or
 (organization_id is null and manifest->>'organization_review'='unresolved' and visibility in('private','unlisted')));
do $$ declare name text;begin
 for name in select conname from pg_catalog.pg_constraint where conrelid='public.user_fees'::regclass and contype='u' loop
 execute format('alter table public.user_fees drop constraint %I',name);end loop;
end;$$;
alter table public.user_fees add constraint user_fees_identity unique nulls not distinct(organization_id,provider,source_key);
create or replace function public.accept_user_fee_report(p_version integer,p_provider text,p_report jsonb,p_rows jsonb,p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.user_fee_reports; r jsonb; authority jsonb; org uuid; report_id uuid; fee uuid; ordered jsonb; result jsonb; idx integer:=0;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501';end if;
 if p_version is distinct from 1 or coalesce(length(p_provider),0) not between 1 and 100 or jsonb_typeof(p_rows) is distinct from 'array'
 or jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text)+octet_length(p_report::text)>1048576 then raise exception 'Version 1; provider; 1–100 rows / 1 MiB required';end if;
 if jsonb_typeof(p_report) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_report) k where k not in('source_key','organization_id','reported_organization','organization_review','report_label','year','period_start','period_end','source_url','retrieved_at','document_sha256','published_on','locator','evidence_status','coverage','visibility','supersedes_id','correction_reason')) then raise exception 'Unknown report fields';end if;
 if exists(select 1 from unnest(array['source_key','reported_organization','report_label','locator','coverage']) k where jsonb_typeof(p_report->k) is distinct from 'string' or coalesce(length(btrim(p_report->>k)),0) not between 1 and 2000)
 or not fee_private.https(p_report->>'source_url') or coalesce(p_report->>'document_sha256','')!~'^[a-f0-9]{64}$'
 or coalesce(p_report->>'organization_review','') not in('reviewed','unresolved')
 or coalesce(p_report->>'evidence_status','') not in('original_verified','indexed_copy_unverified','unverified')
 or coalesce(p_report->>'visibility','') not in('public','unlisted','private') then raise exception 'Report source identity, raw labels, scope, source evidence and visibility required';end if;
 org:=(p_report->>'organization_id')::uuid;if (org is null)<>(p_report->>'organization_review'='unresolved') or (org is not null and not exists(select 1 from public.organizations where id=org))
 or (p_report->>'visibility'='public' and org is null) then raise exception 'Public reports require reviewed existing org UUID; unresolved raw labels stay unlinked and private/unlisted';end if;
 if p_report->>'year' is not null and (jsonb_typeof(p_report->'year')<>'number' or p_report->>'year'!~'^[0-9]{4}$') then raise exception 'Year is a source-reported integer or null';end if;
 if coalesce(p_report->>'retrieved_at','')!~'^\d{4}-\d{2}-\d{2}T.+(Z|[+-][0-9]{2}:[0-9]{2})$' or not isfinite((p_report->>'retrieved_at')::timestamptz) or (p_report->>'retrieved_at')::timestamptz>now() then raise exception 'Actual source retrieval timestamp with timezone required';end if;
 for r in select to_jsonb(k) from unnest(array['period_start','period_end','published_on']) k loop
 if p_report->>(r#>>'{}') is not null and (p_report->>(r#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' or not isfinite((p_report->>(r#>>'{}'))::date)) then raise exception 'Source dates require YYYY-MM-DD or null';end if;end loop;
 if (p_report->>'period_start')::date>(p_report->>'period_end')::date then raise exception 'Reporting period order invalid';end if;
 select jsonb_agg(value order by value->>'source_key') into ordered from jsonb_array_elements(p_rows);
 if exists(select 1 from jsonb_array_elements(p_rows) q group by q->>'source_key' having count(*)>1) then raise exception 'Duplicate observation source_key';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider||':'||(p_report->>'source_key'),155));
 select * into previous from public.user_fee_reports where provider=p_provider and source_key=p_report->>'source_key' order by revision desc limit 1;
 if found then
 if previous.manifest=p_report and (select jsonb_agg(payload order by source_key) from public.user_fee_observations where user_fee_observations.report_id=previous.id)=ordered then return jsonb_build_object('status','unchanged','report_id',previous.id,'rows',jsonb_array_length(p_rows));end if;
 if p_report->>'supersedes_id' is distinct from previous.id::text or coalesce(length(btrim(p_report->>'correction_reason')),0) not between 1 and 2000 then return jsonb_build_object('status','conflict','current_report_id',previous.id,'message','Explicit latest supersedes_id and correction_reason required');end if;
 if previous.organization_id is not null and org is distinct from previous.organization_id then raise exception 'Report correction cannot move organization; reconcile identity explicitly';end if;
 elsif p_report->>'supersedes_id' is not null then raise exception 'No existing report to supersede';end if;
 begin
 insert into public.user_fee_reports(provider,source_key,revision,organization_id,visibility,supersedes_id,manifest) values(p_provider,p_report->>'source_key',coalesce(previous.revision,0)+1,org,p_report->>'visibility',previous.id,p_report) returning id into report_id;
 for r in select value from jsonb_array_elements(ordered) loop
 idx:=idx+1;
 if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) k where k not in('source_key','fee_key','reported_fee','purpose','observation_basis','rate','collections','authorities','effective_from','effective_to','exemptions','locator'))
 or exists(select 1 from unnest(array['source_key','fee_key','reported_fee','purpose','observation_basis','locator']) k where jsonb_typeof(r->k) is distinct from 'string' or coalesce(length(btrim(r->>k)),0) not between 1 and 2000) then raise exception 'Observation identity, raw fee/purpose, grain and locator required';end if;
 if r->>'exemptions' is not null and (jsonb_typeof(r->'exemptions')<>'string' or length(r->>'exemptions')>10000) then raise exception 'Source exemptions must be text or null';end if;
 perform fee_private.validate_rate(r->'rate');
 if jsonb_typeof(r->'collections') is distinct from 'object' or exists(select 1 from jsonb_object_keys(r->'collections') k where k not in('amount','currency','unit'))
 or not (r->'collections' ? 'amount') or (r->'collections'->>'currency' is not null and r->'collections'->>'currency'!~'^[A-Z]{3}$') or (r->'collections'->>'unit' is not null and (jsonb_typeof(r->'collections'->'unit')<>'string' or length(r->'collections'->>'unit')>200)) or (r->'collections'->>'amount' is not null and (not fee_private.decimal(r->'collections'->'amount',true) or coalesce(r->'collections'->>'currency','')!~'^[A-Z]{3}$' or coalesce(length(r->'collections'->>'unit'),0) not between 1 and 200)) then raise exception 'Separate exact collections string with currency/unit or explicit null required';end if;
 if jsonb_typeof(r->'authorities') is distinct from 'array' or jsonb_array_length(r->'authorities')>50 then raise exception 'Authority citation array required; empty means not recorded';end if;
 for authority in select value from jsonb_array_elements(r->'authorities') loop
 if jsonb_typeof(authority) is distinct from 'object' or exists(select 1 from jsonb_object_keys(authority) k where k not in('label','url','locator'))
 or coalesce(length(btrim(authority->>'label')),0) not between 1 and 2000 or coalesce(length(btrim(authority->>'locator')),0) not between 1 and 2000 or not fee_private.https(authority->>'url') then raise exception 'Authority label, usable HTTPS URL and locator required';end if;end loop;
 if (r->>'effective_from' is not null and (r->>'effective_from'!~'^\d{4}-\d{2}-\d{2}$' or not isfinite((r->>'effective_from')::date)))
 or (r->>'effective_to' is not null and (r->>'effective_to'!~'^\d{4}-\d{2}-\d{2}$' or not isfinite((r->>'effective_to')::date))) or (r->>'effective_from')::date>(r->>'effective_to')::date then raise exception 'Known effective dates require ordered ISO dates, not invented boundaries';end if;
 insert into public.user_fees(organization_id,provider,source_key) values(org,p_provider,case when org is null then (p_report->>'source_key')||':'||(r->>'fee_key') else r->>'fee_key' end) on conflict(organization_id,provider,source_key) do nothing;
 select id into fee from public.user_fees where organization_id is not distinct from org and provider=p_provider and source_key=case when org is null then (p_report->>'source_key')||':'||(r->>'fee_key') else r->>'fee_key' end;
 insert into public.user_fee_observations(report_id,fee_id,source_key,payload) values(report_id,fee,r->>'source_key',r);
 end loop;
 result:=jsonb_build_object('status','created','report_id',report_id,'revision',coalesce(previous.revision,0)+1,'rows',idx,'dry_run',coalesce(p_dry_run,true));
 if coalesce(p_dry_run,true) then raise exception using errcode='P0055',message='dry run';end if;
 exception when sqlstate 'P0055' then return result;
 when others then return jsonb_build_object('status','rejected','index',idx-1,'message',sqlerrm,'rows',0);end;
 return result;
end;$$;
revoke all on function public.accept_user_fee_report(integer,text,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.accept_user_fee_report(integer,text,jsonb,jsonb,boolean) to authenticated;

create or replace function public.browse_user_fees(p_organization_id uuid default null,p_year integer default null,p_query text default '',p_fee_id uuid default null,p_history boolean default false,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or p_query is null or length(p_query)>200 then raise exception 'Bounded query/pagination required';end if;
 with latest as materialized(select r.* from public.user_fee_reports r where not exists(select 1 from public.user_fee_reports n where n.supersedes_id=r.id)),
 visible as materialized(
 select o.id,o.fee_id,o.source_key,o.payload,r.id report_id,r.provider,r.revision,r.manifest,r.recorded_at,r.organization_id,coalesce(g.name,r.manifest->>'reported_organization') organization_name,g.slug organization_slug,
 exists(select 1 from public.user_fee_reports n where n.supersedes_id=r.id) superseded
 from public.user_fee_observations o join public.user_fee_reports r on r.id=o.report_id left join public.organizations g on g.id=r.organization_id
 where ((select public.is_admin()) or (r.visibility='public' and exists(select 1 from latest l where l.provider=r.provider and l.source_key=r.source_key and l.visibility='public')))
 and (p_history or not exists(select 1 from public.user_fee_reports n where n.supersedes_id=r.id))
 and (p_organization_id is null or r.organization_id=p_organization_id) and (p_year is null or (r.manifest->>'year')::integer=p_year)
 and (p_fee_id is null or o.fee_id=p_fee_id)),
 selected as(select * from visible where p_query='' or position(lower(p_query) in lower((payload->>'reported_fee')||' '||(payload->>'purpose')||' '||organization_name||' '||(manifest->>'reported_organization')))>0),
 page as(select * from selected order by manifest->>'year' desc nulls last,organization_name,payload->>'reported_fee',report_id,id offset p_offset limit p_limit)
 select jsonb_build_object('version',1,'scope','This filtered observation page only. Rates are not collections; unknown is not zero. Authority citations do not establish current effectiveness.',
 'filters',jsonb_build_object('organization_id',p_organization_id,'year',p_year,'query',p_query,'fee_id',p_fee_id,'history',p_history),'offset',p_offset,'limit',p_limit,
 'total',(select count(*) from selected),'organizations',coalesce((select jsonb_agg(x order by name) from(select distinct organization_id id,organization_name name from visible)x),'[]'),
 'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 return result;
end;$$;
revoke all on function public.browse_user_fees(uuid,integer,text,uuid,boolean,integer,integer) from public;
grant execute on function public.browse_user_fees(uuid,integer,text,uuid,boolean,integer,integer) to anon,authenticated;

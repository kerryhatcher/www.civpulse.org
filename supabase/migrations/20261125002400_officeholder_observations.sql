-- Snapshot evidence is deliberately not an office_term or a current-office claim.
create table public.officeholder_observations (
 id uuid primary key default gen_random_uuid(), provider text not null, source_key text not null,
 revision integer not null, organization_id uuid not null references public.organizations(id) on delete restrict,
 person_id uuid references public.people(id) on delete restrict, office_id uuid references public.offices(id) on delete restrict,
 office_term_id uuid references public.office_terms(id) on delete restrict,
 supersedes_id uuid unique references public.officeholder_observations(id) on delete restrict,
 payload jsonb not null, recorded_at timestamptz not null default now(), unique(provider,source_key,revision)
);
create index officeholder_observations_org on public.officeholder_observations(organization_id);
create index officeholder_observations_person on public.officeholder_observations(person_id);
alter table public.officeholder_observations enable row level security;
revoke all on public.officeholder_observations from anon,authenticated;
grant select on public.officeholder_observations to authenticated;
create policy observations_admin_read on public.officeholder_observations for select to authenticated using ((select public.is_admin()));
-- Only acceptance RPC can append. No update/delete grant or policy, including admins.
create function public.accept_officeholder_observations(p_version integer,p_provider text,p_rows jsonb,p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; previous public.officeholder_observations; org uuid; person uuid; office uuid; term uuid; asof date;
 made integer:=0; same integer:=0; idx integer:=0; ids jsonb:='[]'; result jsonb;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_version is distinct from 1 or coalesce(length(p_provider),0) not between 1 and 100 or jsonb_typeof(p_rows) is distinct from 'array'
 or jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text)>1048576 then raise exception 'Version 1; provider; 1–100 rows / 1 MiB required'; end if;
 -- Stable identities serialized in deterministic order, including concurrent retries.
 for r in select value from jsonb_array_elements(p_rows) order by value->>'source_key' loop
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider||':'||coalesce(r->>'source_key',''),147)); end loop;
 begin
 for r in select value from jsonb_array_elements(p_rows) loop
 idx:=idx+1;
 if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) k where k not in
 ('source_key','reported_person','reported_organization','reported_office','role','seat','district','capacity','selection_basis','as_of','precision','person_id','organization_id','office_id','office_term_id','source_url','document_sha256','retrieved_on','locator','evidence_status','review_status','confidence','visibility','supersedes_id','correction_reason')) then raise exception 'Unknown observation fields'; end if;
 if coalesce(length(r->>'source_key'),0) not between 1 and 500 then raise exception 'Stable source_key required'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) q where q->>'source_key'=r->>'source_key' group by q->>'source_key' having count(*)>1) then raise exception 'Duplicate source identity in batch'; end if;
 select * into previous from public.officeholder_observations where provider=p_provider and source_key=r->>'source_key' order by revision desc limit 1;
 if found and previous.payload=r then same:=same+1;ids:=ids||jsonb_build_array(previous.id);continue;end if;
 if previous.id is not null and (r->>'supersedes_id' is distinct from previous.id::text or coalesce(length(btrim(r->>'correction_reason')),0) not between 1 and 2000)
 or previous.id is null and r->>'supersedes_id' is not null then
 result:=jsonb_build_object('status','conflict','index',idx-1,'current_id',previous.id,'created',0,'unchanged',0,'message','Explicit latest supersedes_id and correction_reason required; no overwrite');
 raise exception using errcode='P0047',message='conflict';end if;
 if exists(select 1 from unnest(array['reported_person','reported_organization','reported_office','role','locator']) k where coalesce(length(btrim(r->>k)),0) not between 1 and 2000)
 or coalesce(r->>'source_url','') !~ '^https://[[:alnum:]][^[:space:]\\]*$'
 or coalesce(r->>'document_sha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Reported labels, role, exact locator, HTTPS source and SHA-256 required';end if;
 if coalesce(r->>'precision','') not in ('day','year','unknown') or coalesce(r->>'evidence_status','') not in ('original_verified','indexed_copy_unverified','unverified')
 or coalesce(r->>'review_status','') not in ('reviewed','unresolved','conflicting') or coalesce(r->>'confidence','') not in ('supported','uncertain','unassessed')
 or coalesce(r->>'visibility','') not in ('public','unlisted','private') or coalesce(r->>'capacity','') not in ('substantive','acting','interim','unspecified')
 or coalesce(r->>'selection_basis','') not in ('elected','appointed','unknown') then raise exception 'Explicit precision/evidence/review/confidence/visibility/capacity/selection labels required';end if;
 asof:=(r->>'as_of')::date;
 if (r->>'precision'='unknown')<>(asof is null) or (asof is not null and (not isfinite(asof) or r->>'as_of'!~ '^\d{4}-\d{2}-\d{2}$'))
 or (r->>'precision'='year' and to_char(asof,'MM-DD')<>'01-01') then raise exception 'Unknown date must be null; year uses January 1 only as sorting bound';end if;
 if coalesce(r->>'retrieved_on','')!~ '^\d{4}-\d{2}-\d{2}$' or not isfinite((r->>'retrieved_on')::date) or (r->>'retrieved_on')::date>current_date then raise exception 'Known retrieval date, not a verification date, required';end if;
 org:=(r->>'organization_id')::uuid;person:=(r->>'person_id')::uuid;office:=(r->>'office_id')::uuid;term:=(r->>'office_term_id')::uuid;
 if org is null or not exists(select 1 from public.organizations where id=org) then raise exception 'Resolve existing historical organization UUID';end if;
 if office is not null and not exists(select 1 from public.offices where id=office and organization_id=org) then raise exception 'Office must belong to resolved organization';end if;
 if r->>'review_status'='reviewed' and (person is null or office is null) then raise exception 'Reviewed identity requires existing person and office UUIDs';end if;
 if term is not null and not exists(select 1 from public.office_terms where id=term and person_id=person and office_id=office) then raise exception 'Corroborating term must match person and office';end if;
 insert into public.officeholder_observations(provider,source_key,revision,organization_id,person_id,office_id,office_term_id,supersedes_id,payload)
 values(p_provider,r->>'source_key',coalesce(previous.revision,0)+1,org,person,office,term,previous.id,r) returning id into person;
 made:=made+1;ids:=ids||jsonb_build_array(person);
 end loop;
 result:=jsonb_build_object('status','ok','created',made,'unchanged',same,'ids',ids,'dry_run',coalesce(p_dry_run,true));
 if coalesce(p_dry_run,true) then raise exception using errcode='P0047',message='dry run';end if;
 exception when sqlstate 'P0047' then return result;
 when others then return jsonb_build_object('status','rejected','index',idx-1,'message',sqlerrm,'created',0,'unchanged',0);
 end;
 return result;
end;$$;
revoke all on function public.accept_officeholder_observations(integer,text,jsonb,boolean) from public,anon;
grant execute on function public.accept_officeholder_observations(integer,text,jsonb,boolean) to authenticated;

create function public.read_officeholder_observations(p_person_id uuid default null,p_organization_id uuid default null,p_as_of date default null,p_history boolean default false,p_offset integer default 0,p_limit integer default 50)
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
 and ((select public.is_admin()) or (o.payload->>'visibility'='public' and (o.person_id is null or p.visibility='public')))
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
insert into audit.objects(table_name,key_columns,parents) values('officeholder_observations',array['id'],'{"person_id":"people","organization_id":"organizations","office_id":"offices","office_term_id":"office_terms"}');
create trigger record_history after insert on public.officeholder_observations for each row execute function audit.capture();
create trigger frontend_rebuild_required after insert on public.officeholder_observations for each statement execute function frontend_private.mark_frontend_rebuild_required();

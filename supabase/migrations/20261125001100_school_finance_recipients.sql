-- Append-only extension of the released school finance import contract.
create schema school_finance_private;
revoke all on schema school_finance_private from public,anon,authenticated;
create table public.school_finance_recipients (
 id uuid primary key default gen_random_uuid(),
 source_name text not null check(length(btrim(source_name)) between 1 and 500),
 name_key text generated always as (lower(regexp_replace(btrim(source_name),'[[:space:]]+',' ','g'))) stored unique,
 kind text not null check(kind in ('organization','person')),
 organization_id uuid references public.organizations(id) on delete restrict deferrable initially deferred,
 person_id uuid references public.people(id) on delete restrict deferrable initially deferred,
 is_stub boolean not null,
 identity_review_required boolean not null default true,
 review_note text check(length(review_note)<=2000),
 updated_at timestamptz not null default now(),
 check((kind='organization' and organization_id is not null and person_id is null) or (kind='person' and person_id is not null and organization_id is null))
);
alter table public.school_finance_recipients enable row level security;
revoke all on public.school_finance_recipients from public,anon,authenticated;
alter table public.school_finance_rows add column recipient_id uuid references public.school_finance_recipients(id) on delete restrict;
create index school_finance_recipient_rows on public.school_finance_rows(recipient_id) where recipient_id is not null;

-- Resolve distinct source labels in bulk, so publication does not scan all profiles per row.
create function school_finance_private.link_recipients(p_release uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('school-finance-recipients',0));
 with labels as materialized (
  select distinct on (lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g')))
   s.name,lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g')) name_key
  from public.school_finance_rows s join public.school_finance_releases r on r.id=s.release_id
  where r.id=p_release and r.dataset='payments' and r.status='published'
   and upper(btrim(s.name)) not in ('SALARY','SALARIES','BENEFITS')
  order by lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g')),s.row_number
 ), entities as materialized (
  select lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')) name_key,id,'organization'::text kind from public.organizations
  union all
  select lower(regexp_replace(btrim(full_name),'[[:space:]]+',' ','g')),id,'person' from public.people
 ), matches as (
  select l.name,l.name_key,count(e.id) n,min(e.kind) kind,
   (array_agg(e.id order by e.id) filter(where e.id is not null))[1] record_id
  from labels l left join entities e using(name_key) group by l.name,l.name_key
 )
 insert into public.school_finance_recipients(source_name,kind,organization_id,person_id,is_stub)
 select m.name,case when m.n=1 then m.kind else 'organization' end,
  case when m.n=1 and m.kind='organization' then m.record_id when m.n<>1 then gen_random_uuid() end,
  case when m.n=1 and m.kind='person' then m.record_id end,m.n<>1
 from matches m where not exists(select 1 from public.school_finance_recipients x where x.name_key=m.name_key);
 insert into public.organizations(id,slug,name,description)
 select x.organization_id,'open-ga-recipient-'||x.id,left(x.source_name,160),
  'Provisional payment-recipient stub from Open Georgia. Identity and organization/person classification need review. Reported recipient: '||x.source_name||'. No address, contact details or legal identity are inferred.'
 from public.school_finance_recipients x where x.kind='organization' and x.is_stub
  and not exists(select 1 from public.organizations o where o.id=x.organization_id);
 update public.school_finance_rows s set recipient_id=x.id from public.school_finance_recipients x
 where s.release_id=p_release and x.name_key=lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g'))
  and upper(btrim(s.name)) not in ('SALARY','SALARIES','BENEFITS');
end $$;
revoke all on function school_finance_private.link_recipients(uuid) from public,anon,authenticated;

-- Preserve the original validations and atomic publication; expose no alternate write route.
alter function public.manage_school_finances(text,jsonb) set schema school_finance_private;
revoke all on function school_finance_private.manage_school_finances(text,jsonb) from public,anon,authenticated;
create function public.manage_school_finances(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; x public.school_finance_recipients; target uuid; k text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_action='resolve_recipient' then
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576 then raise exception 'Object payload up to 1 MiB required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('school-finance-recipients',0));
  select * into x from public.school_finance_recipients where id=(p_payload->>'recipient_id')::uuid for update;
  if not found then raise exception 'Unknown recipient'; end if;
  k=p_payload->>'kind';target=(p_payload->>'target_id')::uuid;
  if k is null or k not in ('person','organization') or length(btrim(coalesce(p_payload->>'review_note',''))) not between 10 and 2000 then raise exception 'Recipient kind and sourced review note required'; end if;
  if target is null then
   target=gen_random_uuid();
   if k='person' then
    insert into public.people(id,slug,full_name,kind,description,visibility)
    values(target,'open-ga-payee-'||target,left(x.source_name,160),'other','Payment recipient stub from Open Georgia; identity needs review. Reported name: '||x.source_name,'public');
   else
    insert into public.organizations(id,slug,name,description)
    values(target,'open-ga-payee-'||target,left(x.source_name,160),'Payment recipient stub from Open Georgia; identity needs review. Reported name: '||x.source_name);
   end if;
  elsif (k='person' and not exists(select 1 from public.people where id=target)) or (k='organization' and not exists(select 1 from public.organizations where id=target)) then raise exception 'Recipient target does not exist'; end if;
  update public.school_finance_recipients set kind=k,organization_id=case when k='organization' then target end,
   person_id=case when k='person' then target end,is_stub=p_payload->>'target_id' is null,
   identity_review_required=p_payload->>'target_id' is null,review_note=p_payload->>'review_note',updated_at=now() where id=x.id;
  return jsonb_build_object('recipient_id',x.id,'kind',k,'target_id',target,'is_stub',p_payload->>'target_id' is null);
 end if;
 result=school_finance_private.manage_school_finances(p_action,p_payload);
 if p_action='publish' then perform school_finance_private.link_recipients((result->>'release_id')::uuid); end if;
 return result;
end $$;
revoke all on function public.manage_school_finances(text,jsonb) from public,anon;
grant execute on function public.manage_school_finances(text,jsonb) to authenticated;

alter function public.browse_school_finances(text,integer,text,integer,integer,text,uuid) set schema school_finance_private;
revoke all on function school_finance_private.browse_school_finances(text,integer,text,integer,integer,text,uuid) from public,anon,authenticated;
create function public.browse_school_finances(p_dataset text default 'payments',p_year integer default null,p_query text default '',p_offset integer default 0,p_limit integer default 50,p_sort text default 'amount',p_person_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; projected jsonb;
begin
 result=school_finance_private.browse_school_finances(p_dataset,p_year,p_query,p_offset,p_limit,p_sort,p_person_id);
 select coalesce(jsonb_agg(j.value || jsonb_build_object('recipient',case when x.kind='organization' or p.visibility='public' then
  jsonb_build_object('id',x.id,'kind',x.kind,'record_id',coalesce(x.organization_id,x.person_id),'slug',coalesce(o.slug,p.slug),
   'name',coalesce(o.name,p.full_name),'is_stub',x.is_stub,'identity_review_required',x.identity_review_required) end) order by j.ordinality),'[]'::jsonb)
 into projected from jsonb_array_elements(result->'rows') with ordinality j(value,ordinality)
 left join public.school_finance_rows s on s.release_id=(result->'release'->>'id')::uuid and s.row_number=(j.value->>'row_number')::int
 left join public.school_finance_recipients x on x.id=s.recipient_id
 left join public.organizations o on o.id=x.organization_id left join public.people p on p.id=x.person_id;
 return jsonb_set(result,'{rows}',projected);
end $$;
revoke all on function public.browse_school_finances(text,integer,text,integer,integer,text,uuid) from public;
grant execute on function public.browse_school_finances(text,integer,text,integer,integer,text,uuid) to anon,authenticated;

-- Existing published releases gain the same reviewed/stub mapping without changing facts.
do $$ declare r record;begin for r in select id from public.school_finance_releases where dataset='payments' and status='published' loop
 perform school_finance_private.link_recipients(r.id);end loop;end $$;

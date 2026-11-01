-- Reviewed payroll identity bindings preserve curated profiles and affiliations.
alter table public.school_finance_rows add column person_is_stub boolean not null default true;
alter table public.school_finance_rows add column identity_review_note text check(length(identity_review_note)<=2000);
create or replace function school_finance_private.manage_school_finances(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 r public.school_finance_releases; old public.school_finance_releases;
 item jsonb; n integer; a numeric; t numeric; incoming public.school_finance_rows;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576 then raise exception 'Object payload up to 1 MiB required'; end if;
 if p_action='begin' then
  if jsonb_typeof(p_payload->'expected_amount') is distinct from 'string' or (p_payload->>'dataset'='payroll' and jsonb_typeof(p_payload->'expected_travel') is distinct from 'string') then raise exception 'Expected totals must be exact decimal strings'; end if;
  if (p_payload->>'dataset') is null or (p_payload->>'fiscal_year') is null then raise exception 'Dataset and year required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('school-finance:'||(p_payload->>'dataset')||':'||(p_payload->>'fiscal_year'),0));
  select * into r from public.school_finance_releases where dataset=p_payload->>'dataset' and fiscal_year=(p_payload->>'fiscal_year')::int and source_sha256=p_payload->>'source_sha256';
  if found then
   if (to_jsonb(r) - array['id','status','created_by','created_at','published_at','supersedes','source_organization','source_organization_id','county_fips','organization_id'])
      <> jsonb_build_object('dataset',p_payload->>'dataset','fiscal_year',(p_payload->>'fiscal_year')::int,
      'source_url',p_payload->>'source_url','source_sha256',p_payload->>'source_sha256','source_filename',p_payload->>'source_filename',
      'source_filters',p_payload->'source_filters','retrieved_at',(p_payload->>'retrieved_at')::timestamptz,'parser_version',p_payload->>'parser_version',
      'expected_rows',(p_payload->>'expected_rows')::int,'expected_amount',(p_payload->>'expected_amount')::numeric,'expected_travel',(p_payload->>'expected_travel')::numeric) then
    raise exception 'Source checksum already registered with different metadata';
   end if;
   if p_payload->>'organization_id' is not null and r.organization_id is distinct from (p_payload->>'organization_id')::uuid then raise exception 'Organization metadata changed'; end if;
  else
   if p_payload->>'organization_id' is not null and not exists(select 1 from public.organizations where id=(p_payload->>'organization_id')::uuid and slug='bibb-county-board-of-education') then
    raise exception 'Organization must be the reviewed Bibb school organization';
   end if;
   insert into public.school_finance_releases(dataset,fiscal_year,organization_id,source_url,source_sha256,source_filename,source_filters,retrieved_at,parser_version,expected_rows,expected_amount,expected_travel)
   values(p_payload->>'dataset',(p_payload->>'fiscal_year')::int,(p_payload->>'organization_id')::uuid,p_payload->>'source_url',p_payload->>'source_sha256',p_payload->>'source_filename',p_payload->'source_filters',(p_payload->>'retrieved_at')::timestamptz,p_payload->>'parser_version',(p_payload->>'expected_rows')::int,(p_payload->>'expected_amount')::numeric,(p_payload->>'expected_travel')::numeric) returning * into r;
  end if;
 elsif p_action in ('append','publish','withdraw','review_person','resolve_payroll_person') then
  -- Serialize all operations for a dataset/year, then lock the release.
  select * into r from public.school_finance_releases where id=(p_payload->>'release_id')::uuid;
  if not found then raise exception 'Unknown release'; end if;
  perform pg_advisory_xact_lock(hashtextextended('school-finance:'||r.dataset||':'||r.fiscal_year,0));
  select * into r from public.school_finance_releases where id=r.id for update;
  if p_action='resolve_payroll_person' then
   if r.dataset<>'payroll' or r.status<>'staging' then raise exception 'Staging payroll required'; end if;
   if p_payload->>'confirm_identity' is distinct from 'true' or length(btrim(coalesce(p_payload->>'review_note',''))) not between 10 and 2000 then raise exception 'Sourced identity review note required'; end if;
   select * into incoming from public.school_finance_rows where release_id=r.id and row_number=(p_payload->>'row_number')::int;
   if not found then raise exception 'Unknown payroll row'; end if;
   if not exists(select 1 from public.people where id=(p_payload->>'person_id')::uuid) then raise exception 'Person target does not exist'; end if;
   if incoming.person_id is not null and incoming.person_id is distinct from (p_payload->>'person_id')::uuid then raise exception 'Payroll person changed'; end if;
   update public.school_finance_rows set person_id=(p_payload->>'person_id')::uuid,person_is_stub=false,identity_review_required=false,identity_review_note=p_payload->>'review_note' where release_id=r.id and row_number=incoming.row_number;
  elsif p_action='review_person' then
   if r.dataset<>'payroll' or r.status<>'published' or p_payload->>'confirm_identity' is distinct from 'true' or length(btrim(coalesce(p_payload->>'review_note','')))<10 then raise exception 'Published payroll and sourced identity review note required'; end if;
   select * into incoming from public.school_finance_rows where release_id=r.id and row_number=(p_payload->>'row_number')::int;
   if not found or incoming.person_id is null or incoming.person_id is distinct from (p_payload->>'person_id')::uuid then raise exception 'Payroll person changed'; end if;
   update public.school_finance_rows set identity_review_required=false,identity_review_note=p_payload->>'review_note' where release_id=r.id and row_number=incoming.row_number;
   update public.people set description='Identity reviewed for Open Georgia FY'||r.fiscal_year||' payroll, original data row '||incoming.source_row_number||'. Review: '||left(p_payload->>'review_note',2000)||'. Source: '||r.source_url where id=incoming.person_id and incoming.person_is_stub;
   update public.person_organizations set role='Payroll record FY'||r.fiscal_year||' (identity reviewed)' where person_id=incoming.person_id and organization_id=r.organization_id and incoming.person_is_stub;
  elsif p_action='append' then
   if r.status<>'staging' then raise exception 'Only staging releases accept rows'; end if;
   if jsonb_typeof(p_payload->'rows') is distinct from 'array' then raise exception 'Rows array required'; end if;
   if jsonb_array_length(p_payload->'rows') not between 1 and 500 then raise exception 'Use 1 to 500 rows per batch'; end if;
   for item in select value from jsonb_array_elements(p_payload->'rows') loop
    if exists(select 1 from jsonb_object_keys(item) k where k not in ('row_number','source_row_number','name','title','amount','travel','payment_count')) then raise exception 'Unknown row field'; end if;
    if (item->>'row_number')::int is null or (item->>'row_number')::int not between 1 and r.expected_rows then raise exception 'Row number outside expected range'; end if;
    if item->>'source_row_number' is null or (item->>'source_row_number')::int < 1 then raise exception 'Source row number required'; end if;
    if jsonb_typeof(item->'name') is distinct from 'string' then raise exception 'Source name must be text'; end if;
    if jsonb_typeof(item->'amount') is distinct from 'string' or (item->>'amount') !~ '^-?[0-9]+([.][0-9]{1,18})?$' or item->>'amount' is null then raise exception 'Exact decimal amount (up to 18 fractional digits) required'; end if;
    if r.dataset='payroll' then
     if length(item->>'name')>160 or length(item->>'title')>160 then raise exception 'Payroll profile name and title must fit 160 characters'; end if;
     if jsonb_typeof(item->'title') is distinct from 'string' or jsonb_typeof(item->'travel') is distinct from 'string' or item->>'title' is null or item->>'travel' is null or (item->>'travel') !~ '^-?[0-9]+([.][0-9]{1,18})?$' or item->>'payment_count' is not null then raise exception 'Payroll requires title and decimal travel, no payment count'; end if;
    elsif item->>'title' is not null or item->>'travel' is not null or item->>'payment_count' is null then raise exception 'Payments require count, no payroll fields'; end if;
    select * into incoming from public.school_finance_rows where release_id=r.id and row_number=(item->>'row_number')::int;
    if found then
     if incoming.source_row_number is distinct from (item->>'source_row_number')::int or incoming.name is distinct from item->>'name' or incoming.title is distinct from item->>'title' or incoming.amount is distinct from (item->>'amount')::numeric or incoming.travel is distinct from (item->>'travel')::numeric or incoming.payment_count is distinct from (item->>'payment_count')::int then raise exception 'Conflicting retry at row %',item->>'row_number'; end if;
    else
     insert into public.school_finance_rows(release_id,row_number,source_row_number,name,title,amount,travel,payment_count)
     values(r.id,(item->>'row_number')::int,(item->>'source_row_number')::int,item->>'name',item->>'title',(item->>'amount')::numeric,(item->>'travel')::numeric,(item->>'payment_count')::int);
    end if;
   end loop;
  elsif p_action='withdraw' then
   update public.people set visibility='unlisted' where id in (select person_id from public.school_finance_rows where release_id=r.id and person_is_stub) and not exists(select 1 from public.school_finance_rows shared join public.school_finance_releases sr on sr.id=shared.release_id left join public.school_finance_recipients payee on payee.id=shared.recipient_id where (shared.person_id=public.people.id or payee.person_id=public.people.id) and sr.status='published' and sr.id<>r.id);
   delete from public.person_organizations where organization_id=r.organization_id and person_id in (select person_id from public.school_finance_rows where release_id=r.id and person_is_stub) and not exists(select 1 from public.school_finance_rows shared join public.school_finance_releases sr on sr.id=shared.release_id left join public.school_finance_recipients payee on payee.id=shared.recipient_id where (shared.person_id=public.person_organizations.person_id or payee.person_id=public.person_organizations.person_id) and sr.organization_id=public.person_organizations.organization_id and sr.status='published' and sr.id<>r.id); 
   update public.school_finance_releases set status='withdrawn' where id=r.id returning * into r;
  elsif r.status='published' then
   null; -- Exact retry after an uncertain publication response.
  else
   if r.status<>'staging' then raise exception 'Only staging releases may be published'; end if;
   if p_payload->>'confirm_publication' is distinct from 'true' then raise exception 'Confirm publication after reviewing evidence'; end if;
   select count(*),sum(amount),sum(travel) into n,a,t from public.school_finance_rows where release_id=r.id;
   if n<>r.expected_rows or a is distinct from r.expected_amount or t is distinct from r.expected_travel then raise exception 'Row count or totals do not reconcile'; end if;
   select * into old from public.school_finance_releases where dataset=r.dataset and fiscal_year=r.fiscal_year and status='published';
   if old.id is distinct from (p_payload->>'expected_current_id')::uuid then raise exception 'Current release changed; review replacement'; end if;
   if old.id is not null and r.retrieved_at<=old.retrieved_at then raise exception 'Replacement must have newer evidence'; end if;
   -- The fixed external identity is curated, never a fuzzy name match.
   if r.organization_id is null then
    select id into r.organization_id from public.organizations where slug='bibb-county-board-of-education';
    if r.organization_id is null then
     insert into public.organizations(slug,name,description)
     values('bibb-county-board-of-education','Bibb County Board of Education','School district reporting organization identified as 6111 in Open Georgia.') returning id into r.organization_id;
    end if;
    update public.school_finance_releases set organization_id=r.organization_id where id=r.id;
   end if;
   if r.dataset='payroll' then
    -- Reviewed existing people are linked during staging; unresolved rows get separate stubs.
    update public.school_finance_rows set person_id=gen_random_uuid() where release_id=r.id and person_id is null;
    insert into public.people(id,slug,full_name,kind,title,description,visibility)
    select s.person_id,'open-ga-6111-fy'||r.fiscal_year||'-'||r.id||'-'||s.row_number,s.name,'other',s.title,
      'Identity needs review. This profile represents one Open Georgia Bibb County Board of Education payroll record for FY'||r.fiscal_year||', original data row '||s.source_row_number||'. Separate profiles are retained for repeated names. No employee identifier, individual school or work location is supplied. This is historical payroll evidence, not confirmation of current employment. Source: '||r.source_url,
      'public'
    from public.school_finance_rows s where s.release_id=r.id and s.person_is_stub;
    insert into public.person_organizations(person_id,organization_id,role)
    select s.person_id,r.organization_id,'Payroll record FY'||r.fiscal_year||' (identity needs review)'
    from public.school_finance_rows s where s.release_id=r.id and s.person_is_stub;
   end if;
   update public.people set description=description||' This source release has been superseded; consult the current finance dataset.' where id in (select person_id from public.school_finance_rows where release_id=old.id and person_is_stub) and not exists(select 1 from public.school_finance_rows shared where shared.person_id=public.people.id and shared.release_id=r.id);
   update public.school_finance_releases set status='superseded' where id=old.id;
   update public.school_finance_releases set status='published',published_at=now(),supersedes=old.id where id=r.id returning * into r;
  end if;
 else raise exception 'Unknown action'; end if;
 return jsonb_build_object('release_id',r.id,'status',r.status,'row_count',(select count(*) from public.school_finance_rows where release_id=r.id));
end $$;

revoke all on function school_finance_private.manage_school_finances(text,jsonb) from public,anon,authenticated;

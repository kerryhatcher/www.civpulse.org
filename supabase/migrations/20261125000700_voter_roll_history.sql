-- Runtime-only, admin-only Georgia SOS county registration snapshots.
-- No public people, audit registry, search or build-export integration.
create table public.voter_roll_imports (
  id uuid primary key default gen_random_uuid(),
  county_fips text not null references public.georgia_turnout_counties(fips),
  snapshot_date date not null,
  source_filename text not null check (length(source_filename) between 1 and 255),
  source_sha512 text not null check (source_sha512 ~ '^[0-9a-f]{128}$'),
  expected_records integer not null check (expected_records between 1 and 2000000),
  supersedes_id uuid references public.voter_roll_imports(id),
  created_by uuid not null, -- attribution survives account deletion
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  unique (county_fips, snapshot_date, source_sha512)
);
create index voter_roll_imports_timeline on public.voter_roll_imports(county_fips, snapshot_date, completed_at desc);

create table public.voter_roll_records (
  import_id uuid not null references public.voter_roll_imports(id),
  source_row integer not null check (source_row > 1), -- header is CSV row 1
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  registration_number text generated always as (data->>'Voter Registration Number') stored not null
    check (registration_number ~ '^[0-9]{1,20}$'),
  primary key (import_id, registration_number),
  unique (import_id, source_row)
);
create index voter_roll_records_identity on public.voter_roll_records(registration_number, import_id);

alter table public.voter_roll_imports enable row level security;
alter table public.voter_roll_records enable row level security;
revoke all on public.voter_roll_imports, public.voter_roll_records from public, anon, authenticated, service_role;
grant select on public.voter_roll_imports, public.voter_roll_records to authenticated;
create policy voter_roll_imports_admin_read on public.voter_roll_imports for select to authenticated using ((select public.is_admin()));
create policy voter_roll_records_admin_read on public.voter_roll_records for select to authenticated using ((select public.is_admin()));

-- Writes are limited to these checked RPCs; no API role can mutate history.
create function public.begin_voter_roll_import(
  p_county_fips text, p_snapshot_date date, p_source_filename text,
  p_source_sha512 text, p_expected_records integer, p_supersedes_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare result public.voter_roll_imports;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_supersedes_id is not null and not exists (
    select 1 from public.voter_roll_imports where id=p_supersedes_id and completed_at is not null
      and county_fips=p_county_fips and snapshot_date=p_snapshot_date
  ) then raise exception 'Correction must supersede a completed snapshot for the same county and date'; end if;
  insert into public.voter_roll_imports(county_fips,snapshot_date,source_filename,source_sha512,expected_records,supersedes_id,created_by)
  values(p_county_fips,p_snapshot_date,p_source_filename,p_source_sha512,p_expected_records,p_supersedes_id,auth.uid())
  on conflict (county_fips,snapshot_date,source_sha512) do nothing returning * into result;
  if result.id is null then
    select * into result from public.voter_roll_imports
    where county_fips=p_county_fips and snapshot_date=p_snapshot_date and source_sha512=p_source_sha512;
    if result.expected_records is distinct from p_expected_records
      or result.source_filename is distinct from p_source_filename
      or result.supersedes_id is distinct from p_supersedes_id then
      raise exception 'Source already registered with different metadata';
    end if;
  end if;
  return result.id;
end;
$$;

create function public.append_voter_roll_records(p_import_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare batch public.voter_roll_imports; county text; item jsonb; keys text[]; inserted integer;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Rows must be an array'; end if;
  if jsonb_array_length(p_rows) not between 1 and 1000 or octet_length(p_rows::text)>2097152 then
    raise exception 'Batch limit: 1000 rows / 2 MiB';
  end if;
  select * into batch from public.voter_roll_imports where id=p_import_id for update;
  if not found then raise exception 'Import not found'; end if;
  if batch.completed_at is not null then raise exception 'Completed snapshots are immutable'; end if;
  select upper(name) into county from public.georgia_turnout_counties where fips=batch.county_fips;
  for item in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item) <> 'object' or not (item ?& array['source_row','data'])
      or (item - 'source_row' - 'data') <> '{}'::jsonb
      or jsonb_typeof(item->'source_row') <> 'number'
      or (item->>'source_row') !~ '^[0-9]+$'
      or jsonb_typeof(item->'data') <> 'object' then raise exception 'Invalid source row'; end if;
    select array_agg(key order by key) into keys from jsonb_each(item->'data');
    if keys is distinct from (select array_agg(k order by k) from unnest(array[
      'County','Voter Registration Number','Status','Status Reason','Last Name','First Name','Middle Name','Suffix','Birth Year',
      'Residence Street Number','Residence Pre Direction','Residence Street Name','Residence Street Type','Residence Post Direction',
      'Residence Apt Unit Number','Residence City','Residence Zipcode','County Precinct','County Precinct Description',
      'Municipal Precinct','Municipal Precinct Description','Congressional District','State Senate District','State House District',
      'Judicial District','County Commission District','School Board District','City Council District','Municipal School Board District',
      'Water Board District','Super Council District','Super Commissioner District','Super School Board District','Fire District',
      'Municipality','Combo','Land Lot','Land District','Registration Date','Race','Gender','Last Modified Date','Date of Last Contact',
      'Last Party Voted','Last Vote Date','Voter Created Date','Mailing Street Number','Mailing Street Name','Mailing Apt Unit Number',
      'Mailing City','Mailing Zipcode','Mailing State','Mailing Country'
    ]::text[]) k) or exists(select 1 from jsonb_each(item->'data') where jsonb_typeof(value) <> 'string') then
      raise exception 'Expected all 53 SOS columns as strings';
    end if;
    if item->'data'->>'County' is distinct from county then raise exception 'Row county does not match snapshot'; end if;
    if trim(item->'data'->>'Status') = '' then raise exception 'Missing registration status'; end if;
    if (item->>'source_row')::integer > batch.expected_records + 1 then raise exception 'Source row outside expected file'; end if;
  end loop;
  if (select count(distinct value->'data'->>'Voter Registration Number') from jsonb_array_elements(p_rows)) <> jsonb_array_length(p_rows)
    then raise exception 'Duplicate registration number in batch'; end if;
  insert into public.voter_roll_records(import_id,source_row,data)
  select p_import_id,(value->>'source_row')::integer,value->'data' from jsonb_array_elements(p_rows)
  on conflict (import_id,registration_number) do nothing;
  get diagnostics inserted = row_count;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    join public.voter_roll_records v on v.import_id=p_import_id and v.registration_number=r->'data'->>'Voter Registration Number'
    where v.data is distinct from r->'data' or v.source_row <> (r->>'source_row')::integer
  ) then raise exception 'Conflicting retry or duplicate registration number'; end if;
  return inserted;
end;
$$;

create function public.complete_voter_roll_import(p_import_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare batch public.voter_roll_imports; latest uuid; actual bigint;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Administrator required' using errcode='42501'; end if;
  select * into batch from public.voter_roll_imports where id=p_import_id for update;
  if not found then raise exception 'Import not found'; end if;
  if batch.completed_at is not null then return batch.id; end if;
  -- Same-county completions serialize, including competing same-date corrections.
  perform pg_advisory_xact_lock(hashtextextended('voter-roll:' || batch.county_fips,0));
  select id into latest from public.voter_roll_imports
    where county_fips=batch.county_fips and snapshot_date=batch.snapshot_date and completed_at is not null
    order by completed_at desc,id desc limit 1;
  if latest is distinct from batch.supersedes_id then raise exception 'Snapshot changed; explicitly supersede the latest same-date import'; end if;
  select count(*) into actual from public.voter_roll_records where import_id=batch.id;
  if actual <> batch.expected_records then raise exception 'Incomplete snapshot: expected %, received %',batch.expected_records,actual; end if;
  update public.voter_roll_imports set completed_at=clock_timestamp() where id=batch.id;
  return batch.id;
end;
$$;

create function public.get_voter_roll_history(p_registration_number text, p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_registration_number is null or p_registration_number !~ '^[0-9]{1,20}$'
    or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0
    then raise exception 'Invalid history parameters'; end if;
  with effective as materialized (
    select distinct on (county_fips,snapshot_date) * from public.voter_roll_imports
    where completed_at is not null order by county_fips,snapshot_date,completed_at desc,id desc
  ), first_seen as (
    select i.county_fips,min(i.snapshot_date) first_date from effective i
    join public.voter_roll_records r on r.import_id=i.id and r.registration_number=p_registration_number
    group by i.county_fips
  ), observations as (
    select i.id import_id,i.county_fips,i.snapshot_date,i.completed_at,i.source_filename,i.source_sha512,
      r.source_row,r.data,
      row_number() over w ordinal, lag(r.data) over w previous_data
    from effective i join first_seen f on f.county_fips=i.county_fips and i.snapshot_date>=f.first_date
    left join public.voter_roll_records r on r.import_id=i.id and r.registration_number=p_registration_number
    window w as (partition by i.county_fips order by i.snapshot_date)
  ), events as (
    select o.*,case when ordinal=1 then 'first_seen'
      when data is null and previous_data is not null then 'missing_from_snapshot'
      when data is null then 'still_missing'
      when previous_data is null then 'reappeared'
      when data=previous_data then 'unchanged' else 'changed' end event,
      case when data is not null and previous_data is not null then (
        select coalesce(jsonb_object_agg(k,jsonb_build_object('before',previous_data->k,'after',data->k)),'{}'::jsonb)
        from jsonb_object_keys(data) k where data->k is distinct from previous_data->k
      ) else '{}'::jsonb end changes
    from observations o
  ), page as (
    select * from events order by snapshot_date,county_fips limit p_limit offset p_offset
  ) select jsonb_build_object('registration_number',p_registration_number,'total',(select count(*) from events),
      'limit',p_limit,'offset',p_offset,'history',coalesce((select jsonb_agg(to_jsonb(p)-'ordinal' order by snapshot_date,county_fips) from page p),'[]'::jsonb)) into result;
  return result;
end;
$$;

revoke all on function public.begin_voter_roll_import(text,date,text,text,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function public.append_voter_roll_records(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.complete_voter_roll_import(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_voter_roll_history(text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.begin_voter_roll_import(text,date,text,text,integer,uuid),
  public.append_voter_roll_records(uuid,jsonb), public.complete_voter_roll_import(uuid),
  public.get_voter_roll_history(text,integer,integer) to authenticated;

comment on table public.voter_roll_imports is 'Admin-only complete county SOS roll snapshots. SHA-512 is declared source provenance; importer must verify original file bytes. Staging snapshots never establish absence.';
comment on table public.voter_roll_records is 'Immutable per-import SOS rows; registration numbers and every original column value remain text. No linkage to public people.';

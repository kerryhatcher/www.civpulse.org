-- CLI-created migration ordered after the repository's existing future versions.
alter table public.elections add column results_json_url text
  check (results_json_url is null or results_json_url ~ '^https://results[.]sos[.]ga[.]gov/cdn/results/Georgia/export-[A-Za-z0-9_-]+[.]json$');

create table public.sos_result_snapshots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  source_url text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  header jsonb not null,
  jurisdictions jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  supersedes uuid references public.sos_result_snapshots(id),
  unique(election_id, source_sha256)
);
create table public.sos_result_items (
  snapshot_id uuid not null references public.sos_result_snapshots(id) on delete cascade,
  jurisdiction_index int not null,
  item_index int not null check (item_index >= 0),
  data jsonb not null,
  primary key(snapshot_id,jurisdiction_index,item_index)
);
alter table public.sos_result_snapshots enable row level security;
alter table public.sos_result_items enable row level security;
revoke all on public.sos_result_snapshots,public.sos_result_items from public,anon,authenticated,service_role;
create policy sos_snapshots_admin_read on public.sos_result_snapshots for select to authenticated using (public.is_admin());
create policy sos_items_admin_read on public.sos_result_items for select to authenticated using (public.is_admin());
grant select on public.sos_result_snapshots,public.sos_result_items to authenticated;
create index sos_result_latest on public.sos_result_snapshots(election_id,published_at desc) where published_at is not null;

-- Staging is invisible to readers. Retries may resume a partially staged digest.
create function public.begin_sos_results(p_election_id uuid,p_source_url text,p_sha256 text,p_header jsonb,p_jurisdictions jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.elections; result uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into e from public.elections where id=p_election_id for update;
 if e.id is null or e.results_json_url is null or e.results_json_url is distinct from p_source_url then raise exception 'Save this source URL on the election first'; end if;
 if jsonb_typeof(p_header) is distinct from 'object' or p_header->>'electionDate' is distinct from e.election_date::text
   or nullif(p_header->>'electionName','') is null or nullif(p_header->>'createdAt','') is null then raise exception 'Invalid feed identity'; end if;
 if (p_header->>'createdAt')::timestamptz > now()+interval '5 minutes' then raise exception 'Future source timestamp'; end if;
 if jsonb_typeof(p_jurisdictions) is distinct from 'array' or jsonb_array_length(p_jurisdictions) not between 1 and 160 then raise exception 'Invalid jurisdiction manifest'; end if;
 if exists(select 1 from jsonb_array_elements(p_jurisdictions) j where
   jsonb_typeof(j) is distinct from 'object' or nullif(j->>'id','') is null or nullif(j->>'name','') is null
   or jsonb_typeof(j->'reportingStatuses') is distinct from 'array'
   or coalesce(j->>'item_count','') !~ '^[0-9]{1,5}$') then raise exception 'Invalid jurisdiction'; end if;
 if (select count(distinct j->>'id') from jsonb_array_elements(p_jurisdictions) j) <> jsonb_array_length(p_jurisdictions) then raise exception 'Duplicate jurisdiction'; end if;
 insert into public.sos_result_snapshots(election_id,source_url,source_sha256,header,jurisdictions)
 values(e.id,p_source_url,p_sha256,p_header,p_jurisdictions) on conflict(election_id,source_sha256) do nothing returning id into result;
 if result is null then
  select id into result from public.sos_result_snapshots where election_id=e.id and source_sha256=p_sha256
   and source_url=p_source_url and header=p_header and jurisdictions=p_jurisdictions;
  if result is null then raise exception 'Digest metadata conflict'; end if;
 end if;
 return result;
end; $$;

create function public.stage_sos_results(p_snapshot_id uuid,p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare s public.sos_result_snapshots; r jsonb; j int; i int;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into s from public.sos_result_snapshots where id=p_snapshot_id for update;
 if s.id is null or s.published_at is not null then raise exception 'Snapshot is not staging'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100
   or octet_length(p_items::text)>4194304 then raise exception 'Stage at most 100 items / 4 MiB'; end if;
 for r in select value from jsonb_array_elements(p_items) loop
  j:=(r->>'jurisdiction_index')::int; i:=(r->>'item_index')::int;
  if j is null or j<0 or j>=jsonb_array_length(s.jurisdictions) or i is null or i<0
    or i>=(s.jurisdictions->j->>'item_count')::int or jsonb_typeof(r->'data') is distinct from 'object'
    or nullif(r->'data'->>'id','') is null or nullif(r->'data'->>'name','') is null
    or jsonb_typeof(r->'data'->'ballotOptions') is distinct from 'array' then raise exception 'Invalid ballot item'; end if;
  if exists(select 1 from public.sos_result_items where snapshot_id=s.id and jurisdiction_index=j and item_index=i and data is distinct from r->'data') then raise exception 'Staged item conflict'; end if;
  insert into public.sos_result_items values(s.id,j,i,r->'data') on conflict do nothing;
 end loop;
end; $$;

create function public.publish_sos_results(p_snapshot_id uuid,p_expected_snapshot_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sos_result_snapshots; latest public.sos_result_snapshots; e public.elections;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 -- All publishers lock the election before the snapshot, serializing activation.
 select * into s from public.sos_result_snapshots where id=p_snapshot_id;
 if s.id is null then raise exception 'Unknown snapshot'; end if;
 select * into e from public.elections where id=s.election_id for update;
 select * into s from public.sos_result_snapshots where id=p_snapshot_id for update;
 if s.published_at is not null then return s.id; end if;
 if e.results_json_url is distinct from s.source_url or e.election_date::text is distinct from s.header->>'electionDate' then raise exception 'Election source changed'; end if;
 select * into latest from public.sos_result_snapshots where election_id=s.election_id and published_at is not null order by published_at desc,id desc limit 1;
 if latest.id is distinct from p_expected_snapshot_id then raise exception 'Current snapshot changed; read again'; end if;
 if latest.id is not null and (s.header->>'createdAt')::timestamptz <= (latest.header->>'createdAt')::timestamptz then raise exception 'Stale or conflicting source timestamp'; end if;
 if exists(select 1 from jsonb_array_elements(s.jurisdictions) with ordinality j(data,n)
  where (data->>'item_count')::int <> (select count(*) from public.sos_result_items i where i.snapshot_id=s.id and i.jurisdiction_index=j.n-1)) then raise exception 'Incomplete snapshot'; end if;
 update public.sos_result_snapshots set published_at=clock_timestamp(),supersedes=latest.id where id=s.id;
 return s.id;
end; $$;

-- Metadata first, then a pinned snapshot/jurisdiction page. Never send 160 MB to a visitor.
create function public.get_sos_results(p_election_id uuid,p_snapshot_id uuid default null,p_jurisdiction_index int default null,p_offset int default 0,p_limit int default 10)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.elections; s public.sos_result_snapshots; items jsonb;
begin
 select * into e from public.elections where id=p_election_id;
 if e.id is null or (e.visibility='private' and not public.is_admin()) then return jsonb_build_object('status','missing'); end if;
 select * into s from public.sos_result_snapshots where election_id=e.id and published_at is not null and (p_snapshot_id is null or id=p_snapshot_id) order by published_at desc,id desc limit 1;
 if s.id is null then return jsonb_build_object('status','empty'); end if;
 if p_jurisdiction_index is not null and (p_jurisdiction_index<0 or p_jurisdiction_index>=jsonb_array_length(s.jurisdictions)) then raise exception 'Invalid jurisdiction index'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('item_index',item_index,'data',data) order by item_index),'[]'::jsonb) into items from (
  select item_index,data from public.sos_result_items where snapshot_id=s.id and jurisdiction_index=p_jurisdiction_index
  order by item_index limit least(greatest(coalesce(p_limit,10),1),10) offset greatest(coalesce(p_offset,0),0)
 ) page;
 return jsonb_build_object('status','ok','snapshot_id',s.id,'supersedes',s.supersedes,'source_url',s.source_url,'source_sha256',s.source_sha256,
  'header',s.header,'jurisdictions',s.jurisdictions,'imported_at',s.created_at,'published_at',s.published_at,'items',items);
end; $$;
revoke all on function public.begin_sos_results(uuid,text,text,jsonb,jsonb),public.stage_sos_results(uuid,jsonb),public.publish_sos_results(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.begin_sos_results(uuid,text,text,jsonb,jsonb),public.stage_sos_results(uuid,jsonb),public.publish_sos_results(uuid,uuid) to authenticated;
revoke all on function public.get_sos_results(uuid,uuid,int,int,int) from public;
grant execute on function public.get_sos_results(uuid,uuid,int,int,int) to anon,authenticated;

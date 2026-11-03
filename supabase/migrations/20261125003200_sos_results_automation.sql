-- Nullable reporting statuses are source evidence, not an empty or completed report.
create or replace function public.begin_sos_results(p_election_id uuid,p_source_url text,p_sha256 text,p_header jsonb,p_jurisdictions jsonb)
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
   or jsonb_typeof(j->'reportingStatuses') not in ('array','null') or not (j ? 'reportingStatuses')
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


create function frontend_private.begin_sos_results(p_election_id uuid,p_source_url text,p_sha256 text,p_header jsonb,p_jurisdictions jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.elections; result uuid;
begin
 select * into e from public.elections where id=p_election_id for update;
 if e.id is null or e.results_json_url is null or e.results_json_url is distinct from p_source_url then raise exception 'Save this source URL on the election first'; end if;
 if jsonb_typeof(p_header) is distinct from 'object' or p_header->>'electionDate' is distinct from e.election_date::text
   or nullif(p_header->>'electionName','') is null or nullif(p_header->>'createdAt','') is null then raise exception 'Invalid feed identity'; end if;
 if (p_header->>'createdAt')::timestamptz > now()+interval '5 minutes' then raise exception 'Future source timestamp'; end if;
 if jsonb_typeof(p_jurisdictions) is distinct from 'array' or jsonb_array_length(p_jurisdictions) not between 1 and 160 then raise exception 'Invalid jurisdiction manifest'; end if;
 if exists(select 1 from jsonb_array_elements(p_jurisdictions) j where
   jsonb_typeof(j) is distinct from 'object' or nullif(j->>'id','') is null or nullif(j->>'name','') is null
   or jsonb_typeof(j->'reportingStatuses') not in ('array','null') or not (j ? 'reportingStatuses')
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


create function frontend_private.stage_sos_results(p_snapshot_id uuid,p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare s public.sos_result_snapshots; r jsonb; j int; i int;
begin
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


revoke all on function frontend_private.begin_sos_results(uuid,text,text,jsonb,jsonb), frontend_private.stage_sos_results(uuid,jsonb) from public,anon,authenticated,service_role;

create table public.sos_automation_feeds (
 election_id uuid primary key references public.elections(id) on delete cascade,
 source_url text not null check (source_url ~ '^https://results[.]sos[.]ga[.]gov/cdn/results/Georgia/export-[A-Za-z0-9_-]+[.]json$'),
 enabled boolean not null default false, starts_at timestamptz, ends_at timestamptz,
 etag text, last_modified text, last_attempt_at timestamptz, last_success_at timestamptz,
 last_error text, current_snapshot_id uuid references public.sos_result_snapshots(id),
 current_revision bigint not null default 0, fingerprint text,
 poll_lease uuid, poll_until timestamptz,
 check (starts_at is null or ends_at is null or starts_at < ends_at),
 check ((poll_lease is null) = (poll_until is null))
);
create table public.sos_automation_jobs (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.sos_automation_feeds(election_id) on delete cascade,
 state text not null default 'queued' check (state in ('queued','importing','pointer','done')),
 lease_id uuid, lease_until timestamptz, snapshot_id uuid references public.sos_result_snapshots(id), receipt jsonb,
 revision bigint, manifest_key text, attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_error text,
 check ((lease_id is null) = (lease_until is null))
);
create unique index sos_one_open_job on public.sos_automation_jobs(election_id) where state <> 'done';
alter table public.sos_automation_feeds enable row level security;
alter table public.sos_automation_jobs enable row level security;
revoke all on public.sos_automation_feeds,public.sos_automation_jobs from public,anon,authenticated,service_role;

-- Claim one feed for a bounded HEAD check. Open work always takes precedence.
create function public.claim_sos_results_poll() returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.sos_automation_feeds;
begin
 select a.* into f from public.sos_automation_feeds a join public.elections e on e.id=a.election_id
 where a.enabled and e.visibility='public' and e.results_json_url=a.source_url
 and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
 and (a.poll_until is null or a.poll_until<clock_timestamp())
 and (a.last_attempt_at is null or a.last_attempt_at < now()-interval '4 minutes')
 and not exists(select 1 from public.sos_automation_jobs j where j.election_id=a.election_id and j.state<>'done')
 order by a.last_attempt_at nulls first for update of a skip locked limit 1;
 if f.election_id is null then return null; end if;
 update public.sos_automation_feeds set poll_lease=gen_random_uuid(),poll_until=clock_timestamp()+interval '2 minutes',last_attempt_at=clock_timestamp()
 where election_id=f.election_id returning * into f;
 return jsonb_build_object('election_id',f.election_id,'lease_id',f.poll_lease,'source_url',f.source_url,'etag',f.etag,'last_modified',f.last_modified);
end $$;
create function public.finish_sos_results_poll(p_election_id uuid,p_lease_id uuid,p_changed boolean,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.sos_automation_feeds set poll_lease=null,poll_until=null,last_error=left(p_error,500),
 last_success_at=case when p_error is null and not p_changed then clock_timestamp() else last_success_at end
 where election_id=p_election_id and poll_lease=p_lease_id and poll_until>clock_timestamp();
 if not found then raise exception 'Expired poll lease'; end if;
 if p_error is null and p_changed then
  insert into public.sos_automation_jobs(election_id) values(p_election_id) on conflict do nothing;
 end if;
end $$;
create function frontend_private.sos_job(p_job_id uuid,p_lease_id uuid) returns public.sos_automation_jobs language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs;
begin
 select * into j from public.sos_automation_jobs where id=p_job_id and lease_id=p_lease_id and lease_until>clock_timestamp() and state<>'done' for update;
 if j.id is null then raise exception 'Expired job lease'; end if;
 if not exists(select 1 from public.sos_automation_feeds f join public.elections e on e.id=f.election_id where f.election_id=j.election_id and f.enabled and e.visibility='public' and e.results_json_url=f.source_url) then raise exception 'Feed disabled or no longer public'; end if;
 return j;
end $$;
revoke all on function frontend_private.sos_job(uuid,uuid) from public,anon,authenticated,service_role;
create function public.claim_sos_results_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs; f public.sos_automation_feeds; e public.elections;
begin
 select a.* into j from public.sos_automation_jobs a join public.sos_automation_feeds b on b.election_id=a.election_id join public.elections c on c.id=b.election_id
 where a.state<>'done' and a.next_attempt_at<=now() and (a.lease_until is null or a.lease_until<clock_timestamp())
 and b.enabled and c.visibility='public' and c.results_json_url=b.source_url
 order by a.created_at for update of a skip locked limit 1;
 if j.id is null then return null; end if;
 update public.sos_automation_jobs set lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1,updated_at=clock_timestamp() where id=j.id returning * into j;
 select * into f from public.sos_automation_feeds where election_id=j.election_id;
 select * into e from public.elections where id=j.election_id;
 return jsonb_build_object('job_id',j.id,'lease_id',j.lease_id,'election_id',j.election_id,'election_date',e.election_date,
 'source_url',f.source_url,'etag',case when j.snapshot_id is null then f.etag end,'last_modified',case when j.snapshot_id is null then f.last_modified end,
 'snapshot_id',j.snapshot_id,'phase',case when j.state='pointer' then 'pointer' else 'import' end,
 'revision',j.revision::text,'manifest_key',j.manifest_key,'receipt',j.receipt);
end $$;
create function public.renew_sos_results_job(p_job_id uuid,p_lease_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform frontend_private.sos_job(p_job_id,p_lease_id);
 update public.sos_automation_jobs set lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where id=p_job_id;
 return true;
end $$;
create function public.begin_sos_results_job(p_job_id uuid,p_lease_id uuid,p_sha256 text,p_header jsonb,p_jurisdictions jsonb,p_receipt jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs; f public.sos_automation_feeds; s uuid;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 if j.state='pointer' then raise exception 'Already published'; end if;
 select * into f from public.sos_automation_feeds where election_id=j.election_id;
 if jsonb_typeof(p_receipt) is distinct from 'object' or coalesce(p_receipt->>'bytes','') !~ '^[1-9][0-9]*$' or (p_receipt->>'raw_key') is distinct from 'elections/'||j.election_id::text||'/raw/'||p_sha256||'.json' or nullif(p_receipt->>'retrieved_at','') is null then raise exception 'Invalid receipt'; end if;
 s:=frontend_private.begin_sos_results(j.election_id,f.source_url,p_sha256,p_header,p_jurisdictions);
 if j.snapshot_id is not null and j.snapshot_id<>s then raise exception 'Job source changed during staging'; end if;
 update public.sos_automation_jobs set snapshot_id=s,receipt=coalesce(j.receipt,p_receipt),state='importing',updated_at=clock_timestamp() where id=j.id returning * into j;
 return jsonb_build_object('snapshot_id',s,'receipt',j.receipt,'published',coalesce(f.current_snapshot_id=s,false) and exists(select 1 from public.sos_result_snapshots where id=s and published_at is not null));
end $$;
create function public.stage_sos_results_job(p_job_id uuid,p_lease_id uuid,p_snapshot_id uuid,p_items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 if j.state<>'importing' or j.snapshot_id is distinct from p_snapshot_id then raise exception 'Wrong snapshot'; end if;
 if exists(select 1 from public.sos_result_snapshots where id=p_snapshot_id and published_at is not null) then
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 or octet_length(p_items::text)>4194304 or exists(select 1 from jsonb_array_elements(p_items) r where not exists(select 1 from public.sos_result_items i where i.snapshot_id=p_snapshot_id and i.jurisdiction_index=(r->>'jurisdiction_index')::int and i.item_index=(r->>'item_index')::int and i.data=r->'data')) then raise exception 'Published snapshot conflict'; end if;
 else
  perform frontend_private.stage_sos_results(p_snapshot_id,p_items);
 end if;
 update public.sos_automation_jobs set updated_at=clock_timestamp() where id=j.id;
end $$;

create function public.unchanged_sos_results_job(p_job_id uuid,p_lease_id uuid,p_etag text,p_last_modified text) returns void language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 if j.state<>'queued' or j.snapshot_id is not null then raise exception 'Staging must be resumed'; end if;
 update public.sos_automation_feeds set etag=coalesce(p_etag,etag),last_modified=coalesce(p_last_modified,last_modified),last_success_at=clock_timestamp(),last_error=null where election_id=j.election_id;
 update public.sos_automation_jobs set state='done',lease_id=null,lease_until=null,updated_at=clock_timestamp() where id=j.id;
end $$;
create function public.fail_sos_results_job(p_job_id uuid,p_lease_id uuid,p_error text,p_retry_after integer default null) returns void language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 update public.sos_automation_jobs set lease_id=null,lease_until=null,last_error=left(p_error,500),
 next_attempt_at=case when j.attempts>=8 then 'infinity'::timestamptz else clock_timestamp()+make_interval(secs=>greatest(least(3600, 30 * (2 ^ least(j.attempts,7))::int),least(3600,greatest(1,coalesce(p_retry_after,1))))) end,updated_at=clock_timestamp() where id=j.id;
 update public.sos_automation_feeds set last_error=left(p_error,500) where election_id=j.election_id;
end $$;
create function public.publish_sos_results_job(p_job_id uuid,p_lease_id uuid,p_snapshot_id uuid,p_fingerprint text,p_manifest_key text) returns text language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs; f public.sos_automation_feeds; s public.sos_result_snapshots; latest public.sos_result_snapshots; e public.elections; v_revision bigint;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 if j.state<>'importing' or j.snapshot_id is distinct from p_snapshot_id or coalesce(p_fingerprint,'') !~ '^[0-9a-f]{64}$'
 or p_manifest_key is distinct from 'elections/'||j.election_id::text||'/revisions/'||p_snapshot_id::text||'/manifest.json' then raise exception 'Invalid publication'; end if;
 -- Serialize against administrator publication as well as another worker.
 select * into e from public.elections where id=j.election_id for update;
 select * into f from public.sos_automation_feeds where election_id=j.election_id for update;
 select * into s from public.sos_result_snapshots where id=p_snapshot_id for update;
 select * into latest from public.sos_result_snapshots where election_id=j.election_id and published_at is not null order by published_at desc,id desc limit 1;
 if s.election_id is distinct from j.election_id or s.source_url is distinct from f.source_url or e.visibility is distinct from 'public' or e.results_json_url is distinct from s.source_url or e.election_date::text is distinct from s.header->>'electionDate' then raise exception 'Source changed'; end if;
 if s.published_at is not null and s.id is distinct from latest.id then raise exception 'Old snapshot'; end if;
 if s.published_at is not null and f.current_snapshot_id=s.id then
  update public.sos_automation_feeds set etag=j.receipt->>'etag',last_modified=j.receipt->>'last_modified',last_success_at=clock_timestamp(),last_error=null where election_id=j.election_id;
  update public.sos_automation_jobs set state='done',lease_id=null,lease_until=null,updated_at=clock_timestamp() where id=j.id;
  return f.current_revision::text;
 end if;
 if s.published_at is null and latest.id is not null and (s.header->>'createdAt')::timestamptz <= (latest.header->>'createdAt')::timestamptz then raise exception 'Stale or conflicting source timestamp'; end if;
 if exists(select 1 from jsonb_array_elements(s.jurisdictions) with ordinality q(data,n)
 where (data->>'item_count')::int <> (select count(*) from public.sos_result_items i where i.snapshot_id=s.id and i.jurisdiction_index=q.n-1)) then raise exception 'Incomplete snapshot'; end if;
 if exists(select 1 from public.sos_result_items i where i.snapshot_id=s.id group by i.jurisdiction_index,i.data->>'id' having count(*)>1) then raise exception 'Duplicate ballot item'; end if;
 if exists(select 1 from public.sos_result_items i cross join lateral jsonb_array_elements(i.data->'ballotOptions') o where i.snapshot_id=s.id group by i.jurisdiction_index,i.item_index,o->>'id' having nullif(o->>'id','') is null or count(*)>1) then raise exception 'Invalid or duplicate ballot option'; end if;
 if s.published_at is null then
  update public.sos_result_snapshots set published_at=clock_timestamp(),supersedes=latest.id where id=s.id;
 end if;
 v_revision:=f.current_revision+1;
 update public.sos_automation_feeds set current_revision=v_revision,current_snapshot_id=s.id,fingerprint=p_fingerprint,etag=j.receipt->>'etag',last_modified=j.receipt->>'last_modified',last_success_at=clock_timestamp(),last_error=null where election_id=j.election_id;
 update public.sos_automation_jobs set state='pointer',revision=v_revision,manifest_key=p_manifest_key,updated_at=clock_timestamp() where id=j.id;
 if f.fingerprint is distinct from p_fingerprint then
  update public.frontend_rebuild_state set needs_rebuild=true,revision=public.frontend_rebuild_state.revision+1,changed_at=clock_timestamp() where id;
 end if;
 return v_revision::text;
end $$;
create function public.confirm_sos_results_pointer(p_job_id uuid,p_lease_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs; f public.sos_automation_feeds;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 select * into f from public.sos_automation_feeds where election_id=j.election_id;
 if j.state<>'pointer' or f.current_revision is distinct from j.revision or f.current_snapshot_id is distinct from j.snapshot_id then raise exception 'Pointer superseded'; end if;
 return jsonb_build_object('revision',j.revision::text,'snapshot_id',j.snapshot_id,'manifest_key',j.manifest_key,'election_id',j.election_id,'receipt',j.receipt,'published_at',(select published_at from public.sos_result_snapshots where id=j.snapshot_id));
end $$;
create function public.complete_sos_results_pointer(p_job_id uuid,p_lease_id uuid,p_revision text) returns void language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 perform public.confirm_sos_results_pointer(p_job_id,p_lease_id);
 if j.revision::text is distinct from p_revision then raise exception 'Wrong revision'; end if;
 update public.sos_automation_jobs set state='done',lease_id=null,lease_until=null,updated_at=clock_timestamp() where id=j.id;
end $$;

revoke all on function public.claim_sos_results_poll(),public.finish_sos_results_poll(uuid,uuid,boolean,text),public.claim_sos_results_job(),public.renew_sos_results_job(uuid,uuid),public.begin_sos_results_job(uuid,uuid,text,jsonb,jsonb,jsonb),public.stage_sos_results_job(uuid,uuid,uuid,jsonb),public.unchanged_sos_results_job(uuid,uuid,text,text),public.fail_sos_results_job(uuid,uuid,text,integer),public.publish_sos_results_job(uuid,uuid,uuid,text,text),public.confirm_sos_results_pointer(uuid,uuid),public.complete_sos_results_pointer(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_sos_results_poll(),public.finish_sos_results_poll(uuid,uuid,boolean,text),public.claim_sos_results_job(),public.renew_sos_results_job(uuid,uuid),public.begin_sos_results_job(uuid,uuid,text,jsonb,jsonb,jsonb),public.stage_sos_results_job(uuid,uuid,uuid,jsonb),public.unchanged_sos_results_job(uuid,uuid,text,text),public.fail_sos_results_job(uuid,uuid,text,integer),public.publish_sos_results_job(uuid,uuid,uuid,text,text),public.confirm_sos_results_pointer(uuid,uuid),public.complete_sos_results_pointer(uuid,uuid,text) to service_role;

create function public.verify_sos_poll_signature(p_timestamp text,p_signature text) returns boolean language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if p_timestamp is null or p_timestamp !~ '^[0-9]{10}$' or p_signature is null or p_signature !~ '^[0-9a-f]{64}$' or abs(extract(epoch from clock_timestamp())-p_timestamp::bigint)>300 then return false; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='sos_results_poll_token';
 if token is null or length(token)<32 then return false; end if;
 return p_signature=encode(extensions.hmac('sos-results-poll:'||p_timestamp,token,'sha256'),'hex');
end $$;
revoke all on function public.verify_sos_poll_signature(text,text) from public,anon,authenticated,service_role;
grant execute on function public.verify_sos_poll_signature(text,text) to service_role;
create function frontend_private.invoke_sos_results_poll() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text; token text; sent_at text;
begin
 -- Disabled installations need no Vault secrets and issue no HTTP request.
 if not exists(select 1 from public.sos_automation_feeds where enabled) then return null; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='sos_results_poll_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='sos_results_poll_token';
 if endpoint is null or endpoint !~ '^https://[a-z0-9.-]+/functions/v1/poll-election-results$' or token is null or length(token)<32 then raise exception 'Configure SOS poll URL and token in Vault'; end if;
 sent_at:=floor(extract(epoch from clock_timestamp()))::bigint::text;
 return net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-sos-timestamp',sent_at,'x-sos-signature',encode(extensions.hmac('sos-results-poll:'||sent_at,token,'sha256'),'hex')),body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke all on function frontend_private.invoke_sos_results_poll() from public,anon,authenticated,service_role;
select cron.schedule('sos-results-poll','*/5 * * * *','select frontend_private.invoke_sos_results_poll();');

create function public.get_sos_collection_health() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('election_id',f.election_id,'enabled',f.enabled,'last_attempt_at',f.last_attempt_at,'last_success_at',f.last_success_at,'last_error',f.last_error,'current_revision',f.current_revision::text,'job_id',j.id,'job_state',j.state,'job_attempts',j.attempts,'job_updated_at',j.updated_at,'next_attempt_at',j.next_attempt_at)), '[]'::jsonb)
 from public.sos_automation_feeds f left join public.sos_automation_jobs j on j.election_id=f.election_id and j.state<>'done';
$$;
revoke all on function public.get_sos_collection_health() from public,anon,authenticated,service_role;
grant execute on function public.get_sos_collection_health() to service_role;
create function public.get_sos_results_health(p_election_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.sos_automation_feeds; j public.sos_automation_jobs; status text;
begin
 select a.* into f from public.sos_automation_feeds a join public.elections e on e.id=a.election_id where a.election_id=p_election_id and e.visibility='public' and e.results_json_url=a.source_url;
 if f.election_id is null then return jsonb_build_object('status','missing'); end if;
 select * into j from public.sos_automation_jobs where election_id=f.election_id and state<>'done';
 status:=case when not f.enabled or (f.starts_at is not null and now()<f.starts_at) or (f.ends_at is not null and now()>=f.ends_at) then 'paused'
 when f.last_error is not null or (f.last_attempt_at is not null and f.last_attempt_at<now()-interval '15 minutes') or (j.id is not null and j.updated_at<now()-interval '15 minutes') then 'delayed'
 when j.id is not null then 'queued' else 'healthy' end;
 return jsonb_build_object('status',status,'enabled',f.enabled,'last_attempt_at',f.last_attempt_at,'last_success_at',f.last_success_at,'pending_since',j.created_at,'current_revision',f.current_revision::text,'snapshot_id',f.current_snapshot_id);
end $$;
revoke all on function public.get_sos_results_health(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_sos_results_health(uuid) to anon,authenticated,service_role;

-- Administrative controls never create or change the election's recorded URL.
create function public.configure_sos_results_feed(p_election_id uuid,p_enabled boolean,p_starts_at timestamptz default null,p_ends_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections; f public.sos_automation_feeds;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into e from public.elections where id=p_election_id for update;
 if e.id is null then raise exception 'Unknown election'; end if;
 if p_enabled is null or (p_starts_at is not null and p_ends_at is not null and p_starts_at>=p_ends_at) then raise exception 'Invalid polling configuration'; end if;
 select * into f from public.sos_automation_feeds where election_id=e.id for update;
 if not p_enabled and f.election_id is not null then
  update public.sos_automation_feeds set enabled=false where election_id=e.id returning * into f;
  return jsonb_build_object('election_id',f.election_id,'source_url',f.source_url,'enabled',f.enabled,'starts_at',f.starts_at,'ends_at',f.ends_at);
 end if;
 if e.visibility<>'public' or e.results_json_url is null then raise exception 'A public election and saved SOS URL are required'; end if;
 if f.election_id is not null and f.source_url<>e.results_json_url then raise exception 'Configured source differs; explicit migration needed'; end if;
 insert into public.sos_automation_feeds(election_id,source_url,enabled,starts_at,ends_at)
 values(e.id,e.results_json_url,p_enabled,p_starts_at,p_ends_at)
 on conflict(election_id) do update set enabled=excluded.enabled,starts_at=excluded.starts_at,ends_at=excluded.ends_at returning * into f;
 return jsonb_build_object('election_id',f.election_id,'source_url',f.source_url,'enabled',f.enabled,'starts_at',f.starts_at,'ends_at',f.ends_at);
end $$;
create function public.recover_sos_results_job(p_election_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into j from public.sos_automation_jobs where election_id=p_election_id and state<>'done' for update;
 if j.id is null then raise exception 'No pending job'; end if;
 if j.lease_until>clock_timestamp() then raise exception 'Job is still leased'; end if;
 if p_action='retry' then
  update public.sos_automation_jobs set next_attempt_at=clock_timestamp(),attempts=0,lease_id=null,lease_until=null,updated_at=clock_timestamp() where id=j.id;
 elsif p_action='abandon' and j.state<>'pointer' then
  update public.sos_automation_jobs set state='done',lease_id=null,lease_until=null,last_error='Abandoned by administrator',updated_at=clock_timestamp() where id=j.id;
 else raise exception 'Invalid action or committed pointer requires retry'; end if;
end $$;
revoke all on function public.configure_sos_results_feed(uuid,boolean,timestamptz,timestamptz),public.recover_sos_results_job(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.configure_sos_results_feed(uuid,boolean,timestamptz,timestamptz),public.recover_sos_results_job(uuid,text) to authenticated;

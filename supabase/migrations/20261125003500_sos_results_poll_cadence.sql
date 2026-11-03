-- Keep the single five-minute Cron heartbeat; gate actual source checks in Postgres.
-- Defaults preserve the existing five-minute API. No feed is enabled by this migration.
alter table public.sos_automation_feeds
 add column poll_interval_seconds integer not null default 300
  check (poll_interval_seconds between 300 and 86400 and poll_interval_seconds % 300=0),
 add column poll_after_interval_seconds integer not null default 300
  check (poll_after_interval_seconds between 300 and 86400 and poll_after_interval_seconds % 300=0),
 add column poll_transition_at timestamptz,
 add column poll_requested_at timestamptz;

create function frontend_private.sos_poll_interval(f public.sos_automation_feeds,p_now timestamptz)
returns integer language sql immutable set search_path='' as $$
 select case when f.poll_transition_at is not null and p_now>=f.poll_transition_at
 then f.poll_after_interval_seconds else f.poll_interval_seconds end;
$$;
create function frontend_private.sos_poll_next_at(f public.sos_automation_feeds,p_now timestamptz)
returns timestamptz language sql immutable set search_path='' as $$
 select greatest(f.starts_at,case
 when f.last_attempt_at is null then coalesce(f.poll_requested_at,f.starts_at,p_now)
 when f.poll_requested_at>f.last_attempt_at then f.poll_requested_at
 -- A transition is an actual new deadline, even if the hourly check was recent.
 when f.poll_transition_at is not null and f.last_attempt_at<f.poll_transition_at then
 least(f.last_attempt_at+make_interval(secs=>f.poll_interval_seconds-60),f.poll_transition_at)
 else f.last_attempt_at+make_interval(secs=>frontend_private.sos_poll_interval(f,p_now)-60) end);
$$;
create function frontend_private.sos_poll_expected_since(f public.sos_automation_feeds,p_now timestamptz)
returns timestamptz language sql immutable set search_path='' as $$
 -- Preserve real last_attempt_at; cadence/activation changes get their own grace anchor.
 select greatest(f.last_attempt_at,f.poll_requested_at,f.starts_at,
 case when f.poll_transition_at<=p_now then f.poll_transition_at end);
$$;
revoke all on function frontend_private.sos_poll_interval(public.sos_automation_feeds,timestamptz),frontend_private.sos_poll_next_at(public.sos_automation_feeds,timestamptz),frontend_private.sos_poll_expected_since(public.sos_automation_feeds,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.claim_sos_results_poll() returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.sos_automation_feeds; checked_at timestamptz:=clock_timestamp();
begin
 select a.* into f from public.sos_automation_feeds a join public.elections e on e.id=a.election_id
 where a.enabled and e.visibility='public' and e.results_json_url=a.source_url
 and (a.starts_at is null or a.starts_at<=checked_at) and (a.ends_at is null or a.ends_at>checked_at)
 and (a.poll_until is null or a.poll_until<checked_at)
 and frontend_private.sos_poll_next_at(a,checked_at)<=checked_at
 and not exists(select 1 from public.sos_automation_jobs j where j.election_id=a.election_id and j.state<>'done')
 order by frontend_private.sos_poll_next_at(a,checked_at),a.election_id for update of a skip locked limit 1;
 if f.election_id is null then return null; end if;
 update public.sos_automation_feeds set poll_lease=gen_random_uuid(),poll_until=clock_timestamp()+interval '2 minutes',last_attempt_at=clock_timestamp()
 where election_id=f.election_id returning * into f;
 return jsonb_build_object('election_id',f.election_id,'lease_id',f.poll_lease,'source_url',f.source_url,'etag',f.etag,'last_modified',f.last_modified);
end $$;

create or replace function frontend_private.invoke_sos_results_poll() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text; token text; sent_at text; checked_at timestamptz:=clock_timestamp();
begin
 -- Do not invoke the Edge Function or update attempts when no source check is due.
 if not exists(select 1 from public.sos_automation_feeds f join public.elections e on e.id=f.election_id
 where f.enabled and e.visibility='public' and e.results_json_url=f.source_url
 and (f.starts_at is null or f.starts_at<=checked_at) and (f.ends_at is null or f.ends_at>checked_at)
 and (f.poll_until is null or f.poll_until<checked_at)
 and frontend_private.sos_poll_next_at(f,checked_at)<=checked_at
 and not exists(select 1 from public.sos_automation_jobs j where j.election_id=f.election_id and j.state<>'done')) then return null; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='sos_results_poll_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='sos_results_poll_token';
 if endpoint is null or endpoint !~ '^https://[a-z0-9.-]+/functions/v1/poll-election-results$' or token is null or length(token)<32 then raise exception 'Configure SOS poll URL and token in Vault'; end if;
 sent_at:=floor(extract(epoch from checked_at))::bigint::text;
 return net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-sos-timestamp',sent_at,'x-sos-signature',encode(extensions.hmac('sos-results-poll:'||sent_at,token,'sha256'),'hex')),body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;

-- Configure cadence while paused, then activate using the existing four-argument RPC.
create function public.configure_sos_results_poll_cadence(p_election_id uuid,p_interval_seconds integer default 300,p_transition_at timestamptz default null,p_after_interval_seconds integer default 300)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections; f public.sos_automation_feeds;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into e from public.elections where id=p_election_id for update;
 if e.id is null then raise exception 'Unknown election'; end if;
 select * into f from public.sos_automation_feeds where election_id=e.id for update;
 if f.election_id is null then raise exception 'Configure the disabled feed first'; end if;
 if f.enabled then raise exception 'Pause the feed before changing cadence'; end if;
 if p_interval_seconds is null or p_after_interval_seconds is null
 or p_interval_seconds not between 300 and 86400 or p_interval_seconds%300<>0
 or p_after_interval_seconds not between 300 and 86400 or p_after_interval_seconds%300<>0 then raise exception 'Invalid polling cadence'; end if;
 update public.sos_automation_feeds set poll_interval_seconds=p_interval_seconds,poll_transition_at=p_transition_at,poll_after_interval_seconds=p_after_interval_seconds
 where election_id=e.id returning * into f;
 return jsonb_build_object('election_id',f.election_id,'enabled',f.enabled,'poll_interval_seconds',f.poll_interval_seconds,'poll_transition_at',f.poll_transition_at,'poll_after_interval_seconds',f.poll_after_interval_seconds);
end $$;
revoke all on function public.configure_sos_results_poll_cadence(uuid,integer,timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function public.configure_sos_results_poll_cadence(uuid,integer,timestamptz,integer) to authenticated;

create or replace function public.configure_sos_results_feed(p_election_id uuid,p_enabled boolean,p_starts_at timestamptz default null,p_ends_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections; f public.sos_automation_feeds; activating boolean; request_id bigint;
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
 activating:=p_enabled and (f.election_id is null or not f.enabled);
 insert into public.sos_automation_feeds(election_id,source_url,enabled,starts_at,ends_at,poll_requested_at)
 values(e.id,e.results_json_url,p_enabled,p_starts_at,p_ends_at,case when activating then clock_timestamp() end)
 on conflict(election_id) do update set enabled=excluded.enabled,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
 poll_requested_at=case when activating then excluded.poll_requested_at else public.sos_automation_feeds.poll_requested_at end returning * into f;
 -- Existing clients can configure an isolated feed before Vault exists. Keep the
 -- immediate request durably due in that case; a real activation must configure
 -- Vault first and verify the returned request ID plus the actual source check.
 if activating and (f.starts_at is null or f.starts_at<=clock_timestamp()) and (f.ends_at is null or f.ends_at>clock_timestamp())
 and exists(select 1 from vault.decrypted_secrets where name='sos_results_poll_url' and decrypted_secret ~ '^https://[a-z0-9.-]+/functions/v1/poll-election-results$')
 and exists(select 1 from vault.decrypted_secrets where name='sos_results_poll_token' and length(decrypted_secret)>=32) then
  request_id:=frontend_private.invoke_sos_results_poll();
 end if;
 return jsonb_build_object('election_id',f.election_id,'source_url',f.source_url,'enabled',f.enabled,'starts_at',f.starts_at,'ends_at',f.ends_at,'poll_request_id',request_id,'poll_interval_seconds',frontend_private.sos_poll_interval(f,clock_timestamp()),'poll_transition_at',f.poll_transition_at);
end $$;

create or replace function public.get_sos_collection_health() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('election_id',f.election_id,'enabled',f.enabled,'last_attempt_at',f.last_attempt_at,'last_success_at',f.last_success_at,'last_error',f.last_error,'current_revision',f.current_revision::text,'job_id',j.id,'job_state',j.state,'job_attempts',j.attempts,'job_created_at',j.created_at,'job_updated_at',j.updated_at,'next_attempt_at',j.next_attempt_at,
 'poll_interval_seconds',frontend_private.sos_poll_interval(f,now()),'poll_transition_at',f.poll_transition_at,'starts_at',f.starts_at,'ends_at',f.ends_at,
 'source_check_expected_since',frontend_private.sos_poll_expected_since(f,now()),
 'source_checks_expected',f.enabled and e.visibility='public' and coalesce(e.results_json_url=f.source_url,false) and (f.starts_at is null or f.starts_at<=now()) and (f.ends_at is null or f.ends_at>now()),
 'next_poll_at',frontend_private.sos_poll_next_at(f,now()))), '[]'::jsonb)
 from public.sos_automation_feeds f join public.elections e on e.id=f.election_id left join public.sos_automation_jobs j on j.election_id=f.election_id and j.state<>'done';
$$;
create or replace function public.get_sos_results_health(p_election_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.sos_automation_feeds; j public.sos_automation_jobs; status text; expected boolean; cadence integer; anchor timestamptz;
begin
 select a.* into f from public.sos_automation_feeds a join public.elections e on e.id=a.election_id where a.election_id=p_election_id and e.visibility='public' and e.results_json_url=a.source_url;
 if f.election_id is null then return jsonb_build_object('status','missing'); end if;
 select * into j from public.sos_automation_jobs where election_id=f.election_id and state<>'done';
 cadence:=frontend_private.sos_poll_interval(f,now()); anchor:=frontend_private.sos_poll_expected_since(f,now());
 expected:=f.enabled and (f.starts_at is null or f.starts_at<=now()) and (f.ends_at is null or f.ends_at>now());
 -- Publication age is independent of source cadence and the renewing lease heartbeat.
 status:=case when not expected then 'paused'
 when f.last_error is not null or (anchor is not null and anchor<now()-make_interval(secs=>greatest(900,2*cadence+300))) or (j.id is not null and (j.created_at<now()-interval '15 minutes' or j.updated_at<now()-interval '15 minutes')) then 'delayed'
 when j.id is not null then 'queued' else 'healthy' end;
 return jsonb_build_object('status',status,'enabled',f.enabled,'last_attempt_at',f.last_attempt_at,'last_success_at',f.last_success_at,'pending_since',j.created_at,'current_revision',f.current_revision::text,'snapshot_id',f.current_snapshot_id,
 'poll_interval_seconds',cadence,'poll_transition_at',f.poll_transition_at,'starts_at',f.starts_at,'ends_at',f.ends_at,'source_checks_expected',expected,'source_check_expected_since',anchor,'next_poll_at',frontend_private.sos_poll_next_at(f,now()));
end $$;

-- STOP forbids new upstream GETs; archived imports and committed-pointer recovery drain.
-- Keep the existing single Supabase Cron HEAD scheduler unchanged.
create function frontend_private.sos_download_window_open(p_starts_at timestamptz,p_ends_at timestamptz,p_now timestamptz)
returns boolean language sql immutable set search_path='' as $$
 select (p_starts_at is null or p_starts_at<=p_now) and (p_ends_at is null or p_now<p_ends_at)
$$;
revoke all on function frontend_private.sos_download_window_open(timestamptz,timestamptz,timestamptz) from public,anon,authenticated,service_role;
create or replace function public.claim_sos_results_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs; f public.sos_automation_feeds; e public.elections;
begin
 select a.* into j from public.sos_automation_jobs a join public.sos_automation_feeds b on b.election_id=a.election_id join public.elections c on c.id=b.election_id
 where a.state<>'done' and a.next_attempt_at<=now() and (a.lease_until is null or a.lease_until<clock_timestamp())
 and b.enabled and c.visibility='public' and c.results_json_url=b.source_url
 and ((a.snapshot_id is not null and a.receipt is not null) or a.state='pointer'
      or frontend_private.sos_download_window_open(b.starts_at,b.ends_at,clock_timestamp()))
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

-- Called immediately before a fresh GET, even when the claim was in-window.
create function public.authorize_sos_results_download(p_job_id uuid,p_lease_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.sos_automation_jobs; f public.sos_automation_feeds; checked_at timestamptz;
begin
 j:=frontend_private.sos_job(p_job_id,p_lease_id);
 if j.snapshot_id is not null or j.state<>'queued' then
  raise exception 'Fresh source download is not valid for this job' using errcode='42501';
 end if;
 select * into f from public.sos_automation_feeds where election_id=j.election_id for share;
 checked_at:=clock_timestamp();
 if not f.enabled or not exists(select 1 from public.elections e where e.id=j.election_id and e.visibility='public' and e.results_json_url=f.source_url) then
  raise exception 'Feed disabled or no longer public' using errcode='42501';
 end if;
 if not frontend_private.sos_download_window_open(f.starts_at,f.ends_at,checked_at) then
  raise exception 'Source collection window closed' using errcode='42501';
 end if;
 return jsonb_build_object('schema_version',1,'job_id',j.id,'election_id',j.election_id,
  'source_url',f.source_url,'server_now',checked_at,'ends_at',f.ends_at);
end $$;
revoke all on function public.authorize_sos_results_download(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.authorize_sos_results_download(uuid,uuid) to service_role;

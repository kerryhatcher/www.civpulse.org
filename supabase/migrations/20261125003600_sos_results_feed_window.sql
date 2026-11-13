-- Change an explicit reviewed window only while the existing feed is paused.
-- The original four-argument pause RPC remains usable after visibility/source changes.
create function public.configure_sos_results_feed_window(p_election_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.elections; f public.sos_automation_feeds;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at) or p_starts_at>=p_ends_at then raise exception 'An explicit ordered polling window is required'; end if;
 select * into e from public.elections where id=p_election_id for update;
 if e.id is null then raise exception 'Unknown election'; end if;
 select * into f from public.sos_automation_feeds where election_id=e.id for update;
 if f.election_id is null then raise exception 'Configure the disabled feed first'; end if;
 if f.enabled then raise exception 'Pause the feed before changing its window'; end if;
 if e.visibility<>'public' or e.results_json_url is null or e.results_json_url<>f.source_url then raise exception 'A public election and matching saved SOS source are required'; end if;
 update public.sos_automation_feeds set starts_at=p_starts_at,ends_at=p_ends_at where election_id=e.id returning * into f;
 return jsonb_build_object('election_id',f.election_id,'source_url',f.source_url,'enabled',f.enabled,'starts_at',f.starts_at,'ends_at',f.ends_at);
end $$;
revoke all on function public.configure_sos_results_feed_window(uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.configure_sos_results_feed_window(uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.publish_sos_results(p_snapshot_id uuid,p_expected_snapshot_id uuid default null)
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
 -- Once automation owns public discovery, a manual DB-only publication would
 -- leave latest.json permanently behind. Use the collector for this feed.
 if exists(select 1 from public.sos_automation_feeds where election_id=e.id and (enabled or current_revision>0)) then
  raise exception 'Use the automated collector to publish this configured feed';
 end if;
 if e.results_json_url is distinct from s.source_url or e.election_date::text is distinct from s.header->>'electionDate' then raise exception 'Election source changed'; end if;
 select * into latest from public.sos_result_snapshots where election_id=s.election_id and published_at is not null order by published_at desc,id desc limit 1;
 if latest.id is distinct from p_expected_snapshot_id then raise exception 'Current snapshot changed; read again'; end if;
 if latest.id is not null and (s.header->>'createdAt')::timestamptz <= (latest.header->>'createdAt')::timestamptz then raise exception 'Stale or conflicting source timestamp'; end if;
 if exists(select 1 from jsonb_array_elements(s.jurisdictions) with ordinality j(data,n)
  where (data->>'item_count')::int <> (select count(*) from public.sos_result_items i where i.snapshot_id=s.id and i.jurisdiction_index=j.n-1)) then raise exception 'Incomplete snapshot'; end if;
 update public.sos_result_snapshots set published_at=clock_timestamp(),supersedes=latest.id where id=s.id;
 return s.id;
end; $$;


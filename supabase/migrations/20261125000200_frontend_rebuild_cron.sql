-- Keep the original invalidation migration append-only; move coordination to Edge.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.frontend_rebuild_state
  add column build_id uuid,
  add column build_revision bigint,
  add column build_requested_at timestamptz,
  add column lease_id uuid,
  add column lease_until timestamptz,
  add constraint frontend_rebuild_build_pair check (
    (build_id is null and build_revision is null and build_requested_at is null)
    or (build_id is not null and build_revision is not null and build_revision > 0 and build_requested_at is not null)
  );

-- The old CI acknowledgement cannot clear a build without reconciling its ID.
drop function public.acknowledge_frontend_rebuild(text);

create function frontend_private.rebuild_snapshot(s public.frontend_rebuild_state)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('lease_id', s.lease_id, 'needs_rebuild', s.needs_rebuild,
    'revision', s.revision::text, 'build_id', s.build_id,
    'build_revision', s.build_revision::text);
$$;
revoke all on function frontend_private.rebuild_snapshot(public.frontend_rebuild_state) from public, anon, authenticated, service_role;

create function public.claim_frontend_rebuild()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.frontend_rebuild_state;
begin
  update public.frontend_rebuild_state
  set lease_id = gen_random_uuid(), lease_until = clock_timestamp() + interval '5 minutes'
  where id and (lease_until is null or lease_until < clock_timestamp()) returning * into s;
  if not found then return null; end if;
  return frontend_private.rebuild_snapshot(s);
end;
$$;

create function public.record_frontend_rebuild(
  p_lease uuid, p_action text, p_build_id uuid, p_revision text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.frontend_rebuild_state;
begin
  select * into s from public.frontend_rebuild_state
  where id and lease_id = p_lease and lease_until > clock_timestamp() for update;
  if not found then raise exception 'Rebuild lease expired' using errcode = '55000'; end if;
  if p_action = 'track' then
    if s.build_id is not null or p_build_id is null or p_revision is null
      or p_revision::bigint < 1 or p_revision::bigint > s.revision then
      raise exception 'Invalid rebuild tracking state' using errcode = '22023';
    end if;
    update public.frontend_rebuild_state set build_id = p_build_id,
      build_revision = p_revision::bigint, build_requested_at = clock_timestamp() where id returning * into s;
  elsif p_action in ('succeeded', 'failed') then
    if s.build_id is null or p_build_id is distinct from s.build_id then
      raise exception 'Rebuild ID mismatch' using errcode = '22023';
    end if;
    update public.frontend_rebuild_state set
      needs_rebuild = case when p_action = 'succeeded' and revision = build_revision then false else true end,
      published_at = case when p_action = 'succeeded' then clock_timestamp() else published_at end,
      build_id = null, build_revision = null, build_requested_at = null
    where id returning * into s;
  else
    raise exception 'Invalid rebuild action' using errcode = '22023';
  end if;
  return frontend_private.rebuild_snapshot(s);
end;
$$;

create function public.release_frontend_rebuild(p_lease uuid)
returns void language sql security definer set search_path = '' as $$
  update public.frontend_rebuild_state set lease_id = null, lease_until = null
  where id and lease_id = p_lease;
$$;

revoke all on function public.claim_frontend_rebuild() from public, anon, authenticated;
revoke all on function public.record_frontend_rebuild(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.release_frontend_rebuild(uuid) from public, anon, authenticated;
grant execute on function public.claim_frontend_rebuild() to service_role;
grant execute on function public.record_frontend_rebuild(uuid,text,uuid,text) to service_role;
grant execute on function public.release_frontend_rebuild(uuid) to service_role;

-- Verification stays in Vault, avoiding a duplicated Edge secret.
create function public.verify_frontend_rebuild_signature(p_timestamp text, p_signature text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare token text;
begin
  if p_timestamp is null or p_timestamp !~ '^[0-9]{10}$'
    or p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then return false; end if;
  if abs(extract(epoch from clock_timestamp()) - p_timestamp::bigint) > 300 then return false; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name = 'frontend_rebuild_token';
  if token is null or length(token) < 32 then return false; end if;
  return p_signature = encode(extensions.hmac('frontend-rebuild:' || p_timestamp, token, 'sha256'), 'hex');
end;
$$;
revoke all on function public.verify_frontend_rebuild_signature(text,text) from public, anon, authenticated;
grant execute on function public.verify_frontend_rebuild_signature(text,text) to service_role;

-- The scheduler reads secrets at execution time, keeping tokens out of cron.job
-- and migration history. No environment is given a production URL by default.
create function frontend_private.invoke_rebuild()
returns bigint language plpgsql security definer set search_path = '' as $$
declare endpoint text; token text; sent_at text; signature text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'frontend_rebuild_url';
  select decrypted_secret into token from vault.decrypted_secrets where name = 'frontend_rebuild_token';
  if endpoint is null or endpoint !~ '^https://[a-z0-9.-]+/functions/v1/rebuild-frontend$'
    or token is null or length(token) < 32 then
    raise exception 'Configure frontend rebuild URL and token in Vault';
  end if;
  -- pg_net's extension-owned queue can be SQL-readable. Send only a short-lived
  -- HMAC, never the reusable Vault secret in request headers or cron.job.
  sent_at := floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature := encode(extensions.hmac('frontend-rebuild:' || sent_at, token, 'sha256'), 'hex');
  return net.http_post(url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-rebuild-timestamp', sent_at, 'x-rebuild-signature', signature),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
end;
$$;
revoke all on function frontend_private.invoke_rebuild() from public, anon, authenticated, service_role;

select cron.schedule('frontend-rebuild-hourly', '17 * * * *',
  'select frontend_private.invoke_rebuild();');

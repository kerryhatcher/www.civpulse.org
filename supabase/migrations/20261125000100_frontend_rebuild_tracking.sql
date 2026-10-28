-- Ordered after the public build export migrations, including their future-dated history.
create table public.frontend_rebuild_state (
  id boolean primary key default true check (id),
  needs_rebuild boolean not null default true,
  revision bigint not null default 1 check (revision > 0),
  changed_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.frontend_rebuild_state enable row level security;
revoke all on public.frontend_rebuild_state from public, anon, authenticated, service_role;
grant select on public.frontend_rebuild_state to service_role;
-- First scheduled run publishes existing data too.
insert into public.frontend_rebuild_state(id) values (true);

create schema frontend_private;
revoke all on schema frontend_private from public, anon, authenticated, service_role;

create function frontend_private.mark_frontend_rebuild_required()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.frontend_rebuild_state
  set needs_rebuild = true, revision = revision + 1, changed_at = clock_timestamp()
  where id;
  return null;
end;
$$;
revoke all on function frontend_private.mark_frontend_rebuild_required() from public, anon, authenticated, service_role;

-- A successful deployment may acknowledge only the revision captured BEFORE its
-- build was requested. Concurrent edits serialize on this row and remain dirty.
create function public.acknowledge_frontend_rebuild(p_revision text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.frontend_rebuild_state
  set needs_rebuild = false, published_at = clock_timestamp()
  where id and revision = p_revision::bigint and needs_rebuild;
  return found;
end;
$$;
revoke all on function public.acknowledge_frontend_rebuild(text) from public, anon, authenticated;
grant execute on function public.acknowledge_frontend_rebuild(text) to service_role;

-- Conservative table-level invalidation also covers deletes, visibility changes,
-- parent relationships and bulk imports. It can rebuild after private-only edits.
-- Runtime-only auth, audit, upload receipts, short links and result reports are
-- intentionally absent. Add future static export dependencies to this list.
do $$
declare resource text;
begin
  foreach resource in array array[
    'organizations', 'organization_relationships', 'people', 'person_organizations',
    'maps', 'layers', 'map_layers', 'layer_features',
    'calendars', 'events', 'meeting_attendance', 'meeting_votes',
    'meeting_vote_choices', 'meeting_attachments',
    'elections', 'contests', 'contest_candidates', 'ballot_questions',
    'offices', 'office_terms', 'articles', 'article_people', 'article_organizations',
    'legislative_terms', 'legislative_sessions', 'legislative_bodies',
    'legislative_body_memberships', 'bills', 'bill_versions', 'bill_amendments',
    'bill_actions', 'bill_relationships', 'bill_sponsorships', 'bill_positions',
    'legislative_votes', 'legislative_vote_bills', 'legislative_vote_choices',
    'article_bills', 'legislative_event_links',
    'records_requests', 'records_request_updates', 'records_request_links',
    'records_request_files', 'records_request_fees'
  ] loop
    execute format('create trigger frontend_rebuild_required after insert or update or delete or truncate on public.%I for each statement execute function frontend_private.mark_frontend_rebuild_required()', resource);
  end loop;
end;
$$;

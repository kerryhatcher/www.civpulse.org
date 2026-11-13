-- Link metadata and statistics are admin-only; public resolution exposes one target.
create table public.short_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-f0-9]{8}$'),
  title text not null check (length(btrim(title)) between 1 and 160),
  target_url text not null check (
    length(target_url) between 1 and 4000
    and target_url ~* '^https?://(\[[0-9a-f:]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]\\]*)?$'
    and target_url !~* '^https?://(www\.|new\.)?civpulse\.org(:[0-9]+)?/+(l|%6c)(/|%2f|[?#]|$)'
    and target_url !~* '^https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?/+(l|%6c)(/|%2f|[?#]|$)'
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index short_links_created_at_idx on public.short_links(created_at desc, id);
create trigger short_links_set_updated_at before update on public.short_links
  for each row execute function public.set_updated_at();

create table public.short_link_stats (
  link_id uuid primary key references public.short_links(id) on delete cascade,
  redirect_count bigint not null default 0 check (redirect_count >= 0),
  last_visited_at timestamptz
);
alter table public.short_links enable row level security;
alter table public.short_link_stats enable row level security;
revoke all on public.short_links, public.short_link_stats from anon, authenticated;
grant select on public.short_links, public.short_link_stats to authenticated;
create policy short_links_admin_read on public.short_links for select to authenticated using (public.is_admin());
create policy short_link_stats_admin_read on public.short_link_stats for select to authenticated using (public.is_admin());

-- No direct writes: codes and statistics cannot be changed through the Data API.
create function public.save_short_link(p_id uuid default null, p_title text default '', p_target_url text default '', p_active boolean default true)
returns public.short_links
language plpgsql security definer set search_path = '' as $$
declare
  result public.short_links;
  attempts integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_id is not null then
    update public.short_links set title = btrim(p_title), target_url = btrim(p_target_url), active = p_active
    where id = p_id returning * into result;
    if not found then raise exception 'Short link not found' using errcode = 'P0002'; end if;
  else
    loop
      begin
        insert into public.short_links(code, title, target_url, active)
        values (substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), btrim(p_title), btrim(p_target_url), p_active)
        returning * into result;
        exit;
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts >= 5 then raise; end if;
      end;
    end loop;
  end if;
  return result;
end;
$$;
revoke all on function public.save_short_link(uuid, text, text, boolean) from public, anon;
grant execute on function public.save_short_link(uuid, text, text, boolean) to authenticated;

-- Atomic increment prevents lost counts under concurrent visits. A share lock
-- keeps resolution/counting consistent with an admin edit or pause.
create function public.resolve_short_link(p_code text, p_count boolean default true)
returns text language plpgsql security definer set search_path = '' as $$
declare
  link public.short_links;
begin
  if p_code is null or p_code !~ '^[a-f0-9]{8}$' then return null; end if;
  select * into link from public.short_links where code = p_code and active for share;
  if not found then return null; end if;
  if p_count then
    insert into public.short_link_stats(link_id, redirect_count, last_visited_at)
    values (link.id, 1, clock_timestamp())
    on conflict (link_id) do update
      set redirect_count = public.short_link_stats.redirect_count + 1,
          last_visited_at = greatest(public.short_link_stats.last_visited_at, excluded.last_visited_at);
  end if;
  return link.target_url;
end;
$$;
revoke all on function public.resolve_short_link(text, boolean) from public;
grant execute on function public.resolve_short_link(text, boolean) to anon, authenticated;
comment on table public.short_link_stats is 'Aggregate requests only; includes bots/repeats, not unique visitors. No visitor IPs, cookies or user agents retained.';
notify pgrst, 'reload schema';

-- Count only the exact destination validated by the Worker; edits and pauses
-- between lookup and counting fail closed without inflating usage.
create function public.count_short_link_redirect(p_code text, p_target_url text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare link public.short_links;
begin
  select * into link from public.short_links
  where code = p_code and active and target_url = p_target_url for share;
  if not found then return false; end if;
  insert into public.short_link_stats(link_id, redirect_count, last_visited_at)
  values (link.id, 1, clock_timestamp())
  on conflict (link_id) do update
    set redirect_count = public.short_link_stats.redirect_count + 1,
        last_visited_at = greatest(public.short_link_stats.last_visited_at, excluded.last_visited_at);
  return true;
end;
$$;
revoke all on function public.count_short_link_redirect(text, text) from public;
grant execute on function public.count_short_link_redirect(text, text) to anon, authenticated;
notify pgrst, 'reload schema';

-- Map visibility: public (listed), unlisted (obscure URL), private (signed in).

alter table public.maps
  add column visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private'));

comment on column public.maps.visibility is
  'public = listed/indexed; unlisted = reachable by uuid URL only; private = requires a signed-in user.';

drop policy "Maps are publicly readable" on public.maps;

create policy "Public maps are readable"
  on public.maps
  for select
  using (visibility = 'public');

create policy "Private maps are readable when signed in"
  on public.maps
  for select
  to authenticated
  using (visibility = 'private');

create policy "Admins can read all maps"
  on public.maps
  for select
  to authenticated
  using (public.is_admin());

-- Single-row lookup for the public viewer. Unlisted maps are never listed, so
-- they are reachable only by id here; private maps additionally require a session.
create function public.get_map(p_id uuid)
returns setof public.maps
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.maps m
  where m.id = p_id
    and (
      m.visibility in ('public', 'unlisted')
      or (m.visibility = 'private' and (select auth.uid()) is not null)
    );
$$;

comment on function public.get_map(uuid) is
  'Returns a map by id when the caller may view it under its visibility.';

revoke execute on function public.get_map(uuid) from public;
grant execute on function public.get_map(uuid) to anon, authenticated;

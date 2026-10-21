-- Return access status alongside the row so the viewer can distinguish
-- "private (sign in)" from "missing" without leaking the map itself.

drop function if exists public.get_map(uuid);

create function public.get_map(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.maps;
begin
  select * into m from public.maps where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if m.visibility = 'private' and (select auth.uid()) is null then
    return jsonb_build_object('status', 'private');
  end if;

  return jsonb_build_object('status', 'ok', 'map', to_jsonb(m));
end;
$$;

comment on function public.get_map(uuid) is
  'Returns {status: ok|private|missing, map?} for a map id, honoring visibility.';

revoke execute on function public.get_map(uuid) from public;
grant execute on function public.get_map(uuid) to anon, authenticated;

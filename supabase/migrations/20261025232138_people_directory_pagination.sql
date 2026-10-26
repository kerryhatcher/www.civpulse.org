-- Directory pagination is independent of the legacy search_people result cap.
create function public.browse_people(
  p_query text default '', p_kind text default null, p_sort text default 'first_asc',
  p_limit integer default 24, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  needle text := lower(btrim(coalesce(p_query, '')));
  q tsquery := websearch_to_tsquery('english'::regconfig, coalesce(p_query, ''));
  admin_access boolean := (select public.is_admin());
begin
  if char_length(coalesce(p_query, '')) > 500 then
    raise exception 'Search query must be 500 characters or fewer' using errcode = '22023';
  end if;
  if p_kind is not null and p_kind not in ('elected_official', 'appointed_official', 'candidate', 'other') then
    raise exception 'Unknown person type' using errcode = '22023';
  end if;
  if p_sort is null or p_sort not in ('first_asc', 'first_desc', 'last_asc', 'last_desc') then
    raise exception 'Unknown people sort' using errcode = '22023';
  end if;
  with matches as materialized (
    select p.*,
      lower(btrim(p.full_name)) as first_key,
      lower(substring(regexp_replace(btrim(p.full_name), '\s*,?\s+(jr\.?|sr\.?|ii|iii|iv)$', '', 'i') from '\S+$')) as last_key
    from public.people p
    where (p.visibility = 'public' or admin_access)
      and (p_kind is null or p.kind = p_kind)
      and (needle = '' or p.search_document @@ q
        or strpos(lower(p.full_name), needle) > 0)
  ), ordered as (
    select m.*, row_number() over (order by
      case when p_sort = 'first_asc' then first_key end asc,
      case when p_sort = 'first_desc' then first_key end desc,
      case when p_sort = 'last_asc' then last_key end asc,
      case when p_sort = 'last_desc' then last_key end desc,
      first_key, id) as position
    from matches m
  ), page as (
    select * from ordered order by position
    limit least(greatest(coalesce(p_limit, 24), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from matches),
    'people', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'slug', slug, 'full_name', full_name, 'kind', kind,
      'title', title, 'description', description, 'image_path', image_path,
      'visibility', visibility) order by position) from page), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.browse_people(text, text, text, integer, integer) from public;
grant execute on function public.browse_people(text, text, text, integer, integer) to anon, authenticated;

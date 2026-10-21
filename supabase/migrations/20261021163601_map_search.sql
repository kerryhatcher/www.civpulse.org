-- Full-text search over maps: name (weight A) + description (weight B).
-- Anonymous callers see public maps only; signed-in callers also see unlisted
-- and private maps. Unlisted rows stay unreachable through the Data API.

alter table public.maps
  add column search_document tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')
  ) stored;

create index maps_search_document_idx
  on public.maps using gin (search_document);

create function public.search_maps(p_query text, p_limit int default 20)
returns setof public.maps
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q tsquery;
  lim int;
begin
  q := websearch_to_tsquery('english'::regconfig, coalesce(p_query, ''));
  lim := least(greatest(coalesce(p_limit, 20), 1), 50);

  if numnode(q) = 0 then
    return query
      select m.*
      from public.maps m
      where m.visibility = 'public'
         or ((select auth.uid()) is not null and m.visibility in ('unlisted', 'private'))
      order by m.name
      limit lim;
  end if;

  return query
    select m.*
    from public.maps m
    where (
        m.visibility = 'public'
        or ((select auth.uid()) is not null and m.visibility in ('unlisted', 'private'))
      )
      and m.search_document @@ q
    order by ts_rank(m.search_document, q) desc, m.name
    limit lim;
end;
$$;

comment on function public.search_maps(text, int) is
  'Full-text map search. Anonymous callers see public maps; signed-in callers also see unlisted and private maps.';

revoke execute on function public.search_maps(text, int) from public;
grant execute on function public.search_maps(text, int) to anon, authenticated;

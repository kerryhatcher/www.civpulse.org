-- Browsing elections still puts upcoming dates first, nearest first, then past
-- dates newest first. Keyword queries use the relationship-aware relevance rank.
create or replace function public.search_elections(p_query text default '',p_limit int default 50)
returns setof public.elections language plpgsql stable security definer set search_path='' as $$
begin
  if btrim(coalesce(p_query,''))='' then
    return query select e.* from public.elections e
      where e.visibility='public' or (select auth.uid()) is not null
      order by (e.election_date>=current_date) desc,
        case when e.election_date>=current_date then e.election_date end asc nulls last,
        case when e.election_date<current_date then e.election_date end desc nulls last,e.name,e.id
      limit least(greatest(coalesce(p_limit,50),1),100);
  else
    return query select e.* from public.search_site(p_query,'election',least(greatest(coalesce(p_limit,50),1),100),0) s
      join public.elections e on e.id=s.id order by s.rank desc,s.title,s.id;
  end if;
end $$;

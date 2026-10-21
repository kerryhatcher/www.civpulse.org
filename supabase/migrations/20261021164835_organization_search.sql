-- Full-text search over organizations: name (weight A) + description (weight B).
-- Organizations are public, so the function runs as the caller (RLS applies).

alter table public.organizations
  add column search_document tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')
  ) stored;

create index organizations_search_document_idx
  on public.organizations using gin (search_document);

create function public.search_organizations(p_query text, p_limit int default 20)
returns setof public.organizations
language plpgsql
stable
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
      select o.*
      from public.organizations o
      order by o.name
      limit lim;
  end if;

  return query
    select o.*
    from public.organizations o
    where o.search_document @@ q
    order by ts_rank(o.search_document, q) desc, o.name
    limit lim;
end;
$$;

comment on function public.search_organizations(text, int) is
  'Full-text organization search using web search syntax, ranked by relevance.';

revoke execute on function public.search_organizations(text, int) from public;
grant execute on function public.search_organizations(text, int) to anon, authenticated;

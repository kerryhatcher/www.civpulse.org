alter table public.articles add column published_on date
  check (published_on is null or isfinite(published_on));
comment on column public.articles.published_on is 'Publication date reported by the source; null when unknown. Profile lists sort newest publication first, undated last.';

-- Dates verified in docs/research/josh-mclaurin-articles.json.
update public.articles a set published_on=x.published_on
from (values
  ('https://www.macon.com/news/politics-government/article257893663.html',date '2022-02-01'),
  ('https://www.macon.com/news/politics-government/article307460996.html',date '2025-05-29'),
  ('https://www.macon.com/news/politics-government/article307733920.html',date '2025-06-02'),
  ('https://maconmelody.com/wp-content/uploads/2025/06/Melody-6-20-e-Edition.pdf#page=4',date '2025-06-20'),
  ('https://www.macon.com/news/politics-government/article314291540.html',date '2026-01-12'),
  ('https://www.macon.com/news/politics-government/article314390666.html',date '2026-01-21'),
  ('https://www.macon.com/news/local/article314862211.html',date '2026-02-27'),
  ('https://www.macon.com/news/local/article315223626.html',date '2026-03-28'),
  ('https://maconmelody.com/051926-election/',date '2026-05-19'),
  ('https://www.macon.com/news/local/article317242264.html',date '2026-09-15'),
  ('https://www.macon.com/news/local/article317259492.html',date '2026-09-17')
) as x(url,published_on)
where a.url=x.url and a.published_on is null;

-- Older six/seven-argument clients preserve publication dates on edit.
create function public.save_article(
  p_title text, p_url text, p_visibility text, p_people jsonb,
  p_organizations jsonb, p_id uuid, p_fetched_on date, p_published_on date
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  saved_id := public.save_article(p_title,p_url,p_visibility,p_people,p_organizations,p_id,p_fetched_on);
  update public.articles set published_on=p_published_on where id=saved_id;
  return saved_id;
end $$;
revoke execute on function public.save_article(text,text,text,jsonb,jsonb,uuid,date,date) from public;
grant execute on function public.save_article(text,text,text,jsonb,jsonb,uuid,date,date) to authenticated;

-- Preserve profile visibility rules; apply the same publication order to both.
drop function public.get_person_articles(uuid);
drop function public.get_organization_articles(uuid);
create function public.get_person_articles(p_person_id uuid)
returns table(id uuid,title text,url text,visibility text,role text,fetched_on date,published_on date)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.url,a.visibility,ap.role,a.fetched_on,a.published_on
  from public.articles a
  join public.article_people ap on ap.article_id=a.id
  join public.people p on p.id=ap.person_id
  where p.id=p_person_id
    and (p.visibility in ('public','unlisted') or (select auth.uid()) is not null)
    and (a.visibility='public' or (select auth.uid()) is not null)
  order by a.published_on desc nulls last,a.title,a.id;
$$;
create function public.get_organization_articles(p_organization_id uuid)
returns table(id uuid,title text,url text,visibility text,role text,fetched_on date,published_on date)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.url,a.visibility,ao.role,a.fetched_on,a.published_on
  from public.articles a
  join public.article_organizations ao on ao.article_id=a.id
  join public.organizations o on o.id=ao.organization_id
  where o.id=p_organization_id
    and (a.visibility='public' or (select auth.uid()) is not null)
  order by a.published_on desc nulls last,a.title,a.id;
$$;
revoke execute on function public.get_person_articles(uuid), public.get_organization_articles(uuid) from public;
grant execute on function public.get_person_articles(uuid), public.get_organization_articles(uuid) to anon, authenticated;

-- Unknown dates remain null; adding a record does not prove its URL was fetched.
alter table public.articles add column fetched_on date
  check (fetched_on is null or (isfinite(fetched_on) and fetched_on <= current_date));
comment on column public.articles.fetched_on is 'Date the article or link was last verified to exist; independent of publication, creation, and edit dates. Null means unknown.';

-- Backfill only URLs verified in the recorded research, not arbitrary existing articles.
update public.articles set fetched_on = date '2026-10-21'
where fetched_on is null and url in (
  'https://www.macon.com/news/politics-government/article257893663.html',
  'https://www.macon.com/news/politics-government/article307460996.html',
  'https://www.macon.com/news/politics-government/article307733920.html',
  'https://maconmelody.com/wp-content/uploads/2025/06/Melody-6-20-e-Edition.pdf#page=4',
  'https://www.macon.com/news/politics-government/article314291540.html',
  'https://www.macon.com/news/politics-government/article314390666.html',
  'https://www.macon.com/news/local/article314862211.html',
  'https://www.macon.com/news/local/article315223626.html',
  'https://maconmelody.com/051926-election/',
  'https://www.macon.com/news/local/article317242264.html',
  'https://www.macon.com/news/local/article317259492.html'
);

-- Keep the six-argument API intact: older callers preserve existing fetched dates.
-- The new form supplies the date explicitly; null clears an unknown/incorrect date.
create function public.save_article(
  p_title text, p_url text, p_visibility text,
  p_people jsonb, p_organizations jsonb, p_id uuid, p_fetched_on date
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  saved_id := public.save_article(p_title,p_url,p_visibility,p_people,p_organizations,p_id);
  update public.articles set fetched_on=p_fetched_on where id=saved_id;
  return saved_id;
end $$;
revoke execute on function public.save_article(text,text,text,jsonb,jsonb,uuid,date) from public;
grant execute on function public.save_article(text,text,text,jsonb,jsonb,uuid,date) to authenticated;

-- Return the date without changing either profile's visibility rules.
drop function public.get_person_articles(uuid);
drop function public.get_organization_articles(uuid);
create function public.get_person_articles(p_person_id uuid)
returns table(id uuid,title text,url text,visibility text,role text,fetched_on date)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.url,a.visibility,ap.role,a.fetched_on
  from public.articles a
  join public.article_people ap on ap.article_id=a.id
  join public.people p on p.id=ap.person_id
  where p.id=p_person_id
    and (p.visibility in ('public','unlisted') or (select auth.uid()) is not null)
    and (a.visibility='public' or (select auth.uid()) is not null)
  order by a.created_at desc,a.title,a.id;
$$;
create function public.get_organization_articles(p_organization_id uuid)
returns table(id uuid,title text,url text,visibility text,role text,fetched_on date)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.url,a.visibility,ao.role,a.fetched_on
  from public.articles a
  join public.article_organizations ao on ao.article_id=a.id
  join public.organizations o on o.id=ao.organization_id
  where o.id=p_organization_id
    and (a.visibility='public' or (select auth.uid()) is not null)
  order by a.created_at desc,a.title,a.id;
$$;
revoke execute on function public.get_person_articles(uuid), public.get_organization_articles(uuid) from public;
grant execute on function public.get_person_articles(uuid), public.get_organization_articles(uuid) to anon, authenticated;

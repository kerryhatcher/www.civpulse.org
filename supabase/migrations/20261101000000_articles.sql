-- Article metadata is independent of its many people/organization associations.
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  url text not null unique check (char_length(url) <= 2000 and url ~* '^https?://[^[:space:]]+$'),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.articles enable row level security;
revoke all on public.articles from anon, authenticated;
grant select on public.articles to anon;
grant select, insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;
create policy "Public articles are readable" on public.articles for select to anon, authenticated using (visibility = 'public');
create policy "Private articles are readable when signed in" on public.articles for select to authenticated using (visibility = 'private');
create policy "Admins manage articles" on public.articles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger articles_set_updated_at before update on public.articles for each row execute function public.set_updated_at();

create table public.article_people (
  article_id uuid not null references public.articles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role text not null default 'Mentioned' check (char_length(btrim(role)) between 1 and 80),
  primary key (article_id, person_id)
);
create index article_people_person_idx on public.article_people(person_id, article_id);
create table public.article_organizations (
  article_id uuid not null references public.articles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'Mentioned' check (char_length(btrim(role)) between 1 and 80),
  primary key (article_id, organization_id)
);
create index article_organizations_organization_idx on public.article_organizations(organization_id, article_id);
alter table public.article_people enable row level security;
alter table public.article_organizations enable row level security;
revoke all on public.article_people, public.article_organizations from anon, authenticated;
grant select, insert, update, delete on public.article_people, public.article_organizations to authenticated;
grant all on public.article_people, public.article_organizations to service_role;
create policy "Admins manage article people" on public.article_people for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage article organizations" on public.article_organizations for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
comment on table public.articles is 'External news/articles: title and URL, optionally associated with multiple people and organizations.';
comment on table public.article_people is 'A person linked to an article; role describes Subject, Author, Mentioned, or another relationship. Profile reads go through get_person_articles.';
comment on table public.article_organizations is 'An organization linked to an article; role describes Subject, Publisher, Mentioned, or another relationship.';

-- Save metadata and both association sets atomically, including removals.
-- Invoker permissions + table RLS still apply; no privileged write bypass.
create function public.save_article(
  p_title text, p_url text, p_visibility text default 'public',
  p_people jsonb default '[]'::jsonb, p_organizations jsonb default '[]'::jsonb,
  p_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_people) is distinct from 'array'
    or jsonb_typeof(p_organizations) is distinct from 'array' then
    raise exception 'Article associations must be arrays' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.articles(title,url,visibility) values (btrim(p_title),btrim(p_url),p_visibility) returning id into saved_id;
  else
    update public.articles set title=btrim(p_title), url=btrim(p_url), visibility=p_visibility where id=p_id returning id into saved_id;
    if not found then raise exception 'Article not found' using errcode = 'P0002'; end if;
  end if;
  delete from public.article_people where article_id=saved_id;
  delete from public.article_organizations where article_id=saved_id;
  insert into public.article_people(article_id,person_id,role)
    select saved_id, x.person_id, coalesce(nullif(btrim(x.role),''),'Mentioned')
    from jsonb_to_recordset(p_people) as x(person_id uuid,role text);
  insert into public.article_organizations(article_id,organization_id,role)
    select saved_id, x.organization_id, coalesce(nullif(btrim(x.role),''),'Mentioned')
    from jsonb_to_recordset(p_organizations) as x(organization_id uuid,role text);
  return saved_id;
end $$;
revoke execute on function public.save_article(text,text,text,jsonb,jsonb,uuid) from public;
grant execute on function public.save_article(text,text,text,jsonb,jsonb,uuid) to authenticated;

-- Profile lists are discovery surfaces. Anonymous readers see public articles;
-- signed-in readers may also see private/unlisted articles. Never return other
-- linked people/organizations, which could reveal a hidden person's association.
create function public.get_person_articles(p_person_id uuid)
returns table(id uuid,title text,url text,visibility text,role text)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.url,a.visibility,ap.role
  from public.articles a
  join public.article_people ap on ap.article_id=a.id
  join public.people p on p.id=ap.person_id
  where p.id=p_person_id
    and (p.visibility in ('public','unlisted') or (select auth.uid()) is not null)
    and (a.visibility='public' or (select auth.uid()) is not null)
  order by a.created_at desc,a.title,a.id;
$$;
create function public.get_organization_articles(p_organization_id uuid)
returns table(id uuid,title text,url text,visibility text,role text)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.url,a.visibility,ao.role
  from public.articles a
  join public.article_organizations ao on ao.article_id=a.id
  join public.organizations o on o.id=ao.organization_id
  where o.id=p_organization_id
    and (a.visibility='public' or (select auth.uid()) is not null)
  order by a.created_at desc,a.title,a.id;
$$;
revoke execute on function public.get_person_articles(uuid), public.get_organization_articles(uuid) from public;
grant execute on function public.get_person_articles(uuid), public.get_organization_articles(uuid) to anon, authenticated;

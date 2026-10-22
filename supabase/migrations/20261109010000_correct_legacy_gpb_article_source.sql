-- The publisher advertises an obsolete gpbnews.org canonical for this story.
-- Keep its current HTTPS GPB URL and correct the imported publisher association.
do $fix$
declare old_id uuid; target_id uuid; publisher_id uuid;
begin
  select id into old_id from public.articles
    where url='http://gpbnews.org/post/can-paperwork-keep-potential-voters-polls';
  select id into target_id from public.articles
    where url='https://www.gpb.org/news/2018/10/24/can-paperwork-keep-potential-voters-polls';
  if old_id is not null then
    if target_id is null then
      update public.articles set url='https://www.gpb.org/news/2018/10/24/can-paperwork-keep-potential-voters-polls' where id=old_id;
      target_id:=old_id;
    else
      insert into public.article_people(article_id,person_id,role)
        select target_id,person_id,role from public.article_people where article_id=old_id
        on conflict(article_id,person_id) do nothing;
      insert into public.article_organizations(article_id,organization_id,role)
        select target_id,organization_id,role from public.article_organizations where article_id=old_id
        on conflict(article_id,organization_id) do nothing;
      delete from public.articles where id=old_id;
    end if;
  end if;
  if target_id is not null then
    delete from public.article_organizations where article_id=target_id and role='Publisher'
      and organization_id=(select id from public.organizations where slug='the-macon-newsroom');
    select id into strict publisher_id from public.organizations where slug='georgia-public-broadcasting';
    insert into public.article_organizations(article_id,organization_id,role)
      values(target_id,publisher_id,'Publisher') on conflict(article_id,organization_id) do nothing;
  end if;
end;
$fix$;

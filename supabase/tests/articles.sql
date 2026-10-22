-- Run via psql against local Supabase; seed the local admin first. All data rolls back.
\set ON_ERROR_STOP on
begin;
insert into public.organizations(id,slug,name) values
 ('76000000-0000-0000-0000-000000000001','article-test-org-a','Article Test Org A'),
 ('76000000-0000-0000-0000-000000000002','article-test-org-b','Article Test Org B');
insert into public.people(id,slug,full_name,visibility) values
 ('76000000-0000-0000-0000-000000000011','article-test-subject','Article Test Subject','public'),
 ('76000000-0000-0000-0000-000000000012','article-test-unlisted','Article Test Unlisted','unlisted'),
 ('76000000-0000-0000-0000-000000000013','article-test-private','Article Test Private','private'),
 ('76000000-0000-0000-0000-000000000014','article-test-author','Article Test Author','public');
insert into public.articles(id,title,url,visibility,created_at) values
 ('76000000-0000-0000-0000-000000000021','Public Test Article','https://example.gov/articles/public','public','2026-10-01'),
 ('76000000-0000-0000-0000-000000000022','Unlisted Test Article','https://example.gov/articles/unlisted','unlisted','2026-10-02'),
 ('76000000-0000-0000-0000-000000000023','Private Test Article','https://example.gov/articles/private','private','2026-10-03'),
 ('76000000-0000-0000-0000-000000000024','Unlinked Test Article','https://example.gov/articles/unlinked','public','2026-10-04');
insert into public.article_people(article_id,person_id,role)
select a.id,p.id,case when p.slug='article-test-author' then 'Author' else 'Subject' end
from public.articles a cross join public.people p
where a.id in ('76000000-0000-0000-0000-000000000021','76000000-0000-0000-0000-000000000022','76000000-0000-0000-0000-000000000023')
 and p.id in ('76000000-0000-0000-0000-000000000011','76000000-0000-0000-0000-000000000012','76000000-0000-0000-0000-000000000013','76000000-0000-0000-0000-000000000014');
insert into public.article_organizations(article_id,organization_id,role)
select a.id,o.id,case when o.slug='article-test-org-a' then 'Subject' else 'Publisher' end
from public.articles a cross join public.organizations o
where a.id in ('76000000-0000-0000-0000-000000000021','76000000-0000-0000-0000-000000000022','76000000-0000-0000-0000-000000000023')
 and o.id in ('76000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000002');
update public.articles set fetched_on='2026-10-01' where id='76000000-0000-0000-0000-000000000021';
-- Deliberately conflict with creation order; the newest-created article is undated.
update public.articles set published_on='2026-10-03' where id='76000000-0000-0000-0000-000000000021';
update public.articles set published_on='2026-10-01' where id='76000000-0000-0000-0000-000000000022';
set local role anon;
do $$ begin
 assert (select published_on=date '2026-10-03' from public.get_person_articles('76000000-0000-0000-0000-000000000011')), 'anonymous publication date';
 assert (select fetched_on=date '2026-10-01' from public.get_person_articles('76000000-0000-0000-0000-000000000011')), 'anonymous person fetched date';
 assert (select fetched_on=date '2026-10-01' from public.get_organization_articles('76000000-0000-0000-0000-000000000002')), 'anonymous organization fetched date';
 assert (select count(*)=1 from public.get_person_articles('76000000-0000-0000-0000-000000000011')), 'anon public articles only';
 assert (select role='Author' from public.get_person_articles('76000000-0000-0000-0000-000000000014')), 'author role preserved';
 assert (select count(*)=1 from public.get_person_articles('76000000-0000-0000-0000-000000000012')), 'unlisted person UUID readable';
 assert not exists(select 1 from public.get_person_articles('76000000-0000-0000-0000-000000000013')), 'private person gated';
 assert not exists(select 1 from public.get_person_articles('76000000-0000-0000-0000-000000000099')), 'missing person';
 assert (select role='Publisher' from public.get_organization_articles('76000000-0000-0000-0000-000000000002')), 'publisher role preserved';
 assert not exists(select 1 from public.get_organization_articles('76000000-0000-0000-0000-000000000099')), 'missing organization';
 assert (select count(*)=2 from public.articles where url like 'https://example.gov/articles/%'), 'only public direct metadata';
 begin perform * from public.article_people; raise exception 'anon association read'; exception when insufficient_privilege then null; end;
 begin perform * from public.article_organizations; raise exception 'anon org association read'; exception when insufficient_privilege then null; end;
 begin insert into public.articles(title,url) values ('Bad','https://example.gov/bad'); raise exception 'anon insert'; exception when insufficient_privilege then null; end;
 begin update public.articles set title='Bad'; raise exception 'anon update'; exception when insufficient_privilege then null; end;
 begin delete from public.articles; raise exception 'anon delete'; exception when insufficient_privilege then null; end;
 begin perform public.save_article('Bad','https://example.gov/bad'); raise exception 'anon RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','77000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare ids uuid[]; affected int; begin
 assert (select count(*)=3 from public.get_person_articles('76000000-0000-0000-0000-000000000013')), 'signed-in private person and hidden articles';
 select array_agg(id) into ids from public.get_person_articles('76000000-0000-0000-0000-000000000011');
 assert ids=array['76000000-0000-0000-0000-000000000021','76000000-0000-0000-0000-000000000022','76000000-0000-0000-0000-000000000023']::uuid[], 'publication newest first, unknown last, independent of creation date';
 select array_agg(id) into ids from public.get_organization_articles('76000000-0000-0000-0000-000000000001');
 assert ids=array['76000000-0000-0000-0000-000000000021','76000000-0000-0000-0000-000000000022','76000000-0000-0000-0000-000000000023']::uuid[], 'same publication order on organizations';
 assert (select count(*)=3 from public.get_organization_articles('76000000-0000-0000-0000-000000000001')), 'signed-in organization articles';
 assert not exists(select 1 from public.article_people), 'nonadmin association read denied';
 assert not exists(select 1 from public.article_organizations), 'nonadmin org association read denied';
 begin perform public.save_article('Bad','https://example.gov/bad'); raise exception 'nonadmin RPC'; exception when insufficient_privilege then null; end;
 begin perform public.save_article('Bad','https://example.gov/bad','public','[]','[]',null,date '2026-10-01'); raise exception 'nonadmin dated RPC'; exception when insufficient_privilege then null; end;
 begin perform public.save_article('Bad','https://example.gov/bad','public','[]','[]',null,null,date '2026-10-01'); raise exception 'nonadmin publication RPC'; exception when insufficient_privilege then null; end;
 begin insert into public.articles(title,url) values ('Bad','https://example.gov/bad'); raise exception 'nonadmin insert'; exception when insufficient_privilege then null; end;
 update public.articles set title='Bad'; get diagnostics affected=row_count; assert affected=0, 'nonadmin update denied';
 delete from public.articles; get diagnostics affected=row_count; assert affected=0, 'nonadmin delete denied';
 begin insert into public.article_people values ('76000000-0000-0000-0000-000000000024','76000000-0000-0000-0000-000000000011','Bad'); raise exception 'nonadmin link insert'; exception when insufficient_privilege then null; end;
 begin insert into public.article_organizations values ('76000000-0000-0000-0000-000000000024','76000000-0000-0000-0000-000000000001','Bad'); raise exception 'nonadmin org link insert'; exception when insufficient_privilege then null; end;
 update public.article_people set role='Bad'; get diagnostics affected=row_count; assert affected=0, 'nonadmin link update denied';
 delete from public.article_people; get diagnostics affected=row_count; assert affected=0, 'nonadmin link delete denied';
 update public.article_organizations set role='Bad'; get diagnostics affected=row_count; assert affected=0, 'nonadmin org link update denied';
 delete from public.article_organizations; get diagnostics affected=row_count; assert affected=0, 'nonadmin org link delete denied';
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.admins limit 1),true);
set local role authenticated;
do $$ declare a uuid; begin
 assert public.is_admin(), 'local admin seeded';
 a:=public.save_article('Dated article','https://example.gov/articles/dated','public','[]','[]',null,date '2026-10-01',date '2026-09-01');
 assert (select published_on=date '2026-09-01' from public.articles where id=a), 'publication date saved';
 assert (select fetched_on=date '2026-10-01' from public.articles where id=a), 'date saved';
 perform public.save_article('Legacy edit','https://example.gov/articles/dated','public','[]','[]',a);
 assert (select fetched_on=date '2026-10-01' from public.articles where id=a), 'legacy edit preserves date';
 assert (select published_on=date '2026-09-01' from public.articles where id=a), 'legacy edit preserves publication';
 begin
   perform public.save_article('Invalid future edit','https://example.gov/articles/dated','public','[]','[]',a,current_date+1);
   raise exception 'future fetched date accepted';
 exception when check_violation then null; end;
 assert (select title='Legacy edit' and fetched_on=date '2026-10-01' from public.articles where id=a), 'invalid date rolls back metadata';
 perform public.save_article('Unknown date','https://example.gov/articles/dated','public','[]','[]',a,null);
 assert (select fetched_on is null from public.articles where id=a), 'date may be cleared';
 assert (select published_on=date '2026-09-01' from public.articles where id=a), 'seven-argument edit preserves publication';
 perform public.save_article('Unknown publication','https://example.gov/articles/dated','public','[]','[]',a,null,null);
 assert (select published_on is null from public.articles where id=a), 'publication may be cleared';
 delete from public.articles where id=a;
 a:=public.save_article('Created article','https://example.gov/articles/created','public',
 '[{"person_id":"76000000-0000-0000-0000-000000000011","role":"Subject"},{"person_id":"76000000-0000-0000-0000-000000000014","role":"Author"}]',
 '[{"organization_id":"76000000-0000-0000-0000-000000000001","role":"Subject"},{"organization_id":"76000000-0000-0000-0000-000000000002","role":"Publisher"}]');
 assert (select count(*)=2 from public.article_people where article_id=a), 'many people';
 assert (select count(*)=2 from public.article_organizations where article_id=a), 'many organizations';
 begin perform public.save_article('Invalid edit','https://example.gov/articles/created','public',
 '[{"person_id":"76000000-0000-0000-0000-000000000099"}]','[]',a);
 raise exception 'invalid FK accepted'; exception when foreign_key_violation then null; end;
 assert (select title='Created article' from public.articles where id=a), 'metadata rollback';
 assert (select count(*)=2 from public.article_people where article_id=a), 'person links rollback';
 assert (select count(*)=2 from public.article_organizations where article_id=a), 'org links rollback';
 begin perform public.save_article('Duplicate URL','https://example.gov/articles/created'); raise exception 'duplicate URL accepted'; exception when unique_violation then null; end;
 begin perform public.save_article('Bad','javascript:alert(1)'); raise exception 'unsafe URL accepted'; exception when check_violation then null; end;
 begin perform public.save_article(' ','https://example.gov/blank'); raise exception 'blank title accepted'; exception when check_violation then null; end;
 begin perform public.save_article('Bad','https://example.gov/bad','public','{}'); raise exception 'nonarray accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_article('Bad edit','https://example.gov/articles/created','public',
 '[{"person_id":"76000000-0000-0000-0000-000000000011"},{"person_id":"76000000-0000-0000-0000-000000000011"}]','[]',a);
 raise exception 'duplicate links accepted'; exception when unique_violation then null; end;
 perform public.save_article('Updated article','https://example.gov/articles/updated','private','[]','[]',a);
 assert (select title='Updated article' and visibility='private' from public.articles where id=a), 'admin metadata update';
 assert not exists(select 1 from public.article_people where article_id=a), 'unlink all people';
 assert not exists(select 1 from public.article_organizations where article_id=a), 'unlink all orgs';
 perform public.save_article('Updated article','https://example.gov/articles/updated','public',
 '[{"person_id":"76000000-0000-0000-0000-000000000011"}]',
 '[{"organization_id":"76000000-0000-0000-0000-000000000001"}]',a);
 assert (select role='Mentioned' from public.article_people where article_id=a), 'default person role';
 delete from public.articles where id=a;
 assert not exists(select 1 from public.article_people where article_id=a), 'article deletion cascades people';
 assert not exists(select 1 from public.article_organizations where article_id=a), 'article deletion cascades orgs';
end $$;
reset role;
delete from public.people where id='76000000-0000-0000-0000-000000000011';
delete from public.organizations where id='76000000-0000-0000-0000-000000000001';
do $$ begin
 assert not exists(select 1 from public.article_people where person_id='76000000-0000-0000-0000-000000000011'), 'person deletion unlinks';
 assert not exists(select 1 from public.article_organizations where organization_id='76000000-0000-0000-0000-000000000001'), 'organization deletion unlinks';
 assert exists(select 1 from public.articles where id='76000000-0000-0000-0000-000000000021'), 'article survives linked-record deletion';
end $$;
rollback;

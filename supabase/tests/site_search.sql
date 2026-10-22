-- Run against local Supabase. Fixtures and assertions all roll back.
\set ON_ERROR_STOP on
begin;
-- BEGIN FIXTURES
insert into public.organizations(id,slug,name,description,website_url) values
('79000000-0000-0000-0000-000000000001','civicneedle-org','Civicneedle Organization','Civicneedle community','https://civicneedle.example.org');
insert into public.people(id,slug,full_name,visibility,email) values
('79000000-0000-0000-0000-000000000011','civicneedle-public','Civicneedle Public Person','public','public.mail@civicneedle.example.org'),
('79000000-0000-0000-0000-000000000012','civicneedle-hidden','Civicneedle Hiddenpersoncanary','private',null),
('79000000-0000-0000-0000-000000000013','civicneedle-unlisted','Civicneedle Unlistedpersoncanary','unlisted',null);
insert into public.person_organizations(person_id,organization_id,role) values
('79000000-0000-0000-0000-000000000012','79000000-0000-0000-0000-000000000001','Hiddenaffiliationcanary');
insert into public.elections(id,slug,name,election_date,visibility) values
('79000000-0000-0000-0000-000000000021','civicneedle-election','Civicneedle Election','2099-11-03','public'),
('79000000-0000-0000-0000-000000000022','civicneedle-private-election','Civicneedle Privateelectioncanary','2099-11-03','private'),
('79000000-0000-0000-0000-000000000023','civicneedle-unlisted-election','Civicneedle Unlistedelectioncanary','2099-11-03','unlisted');
insert into public.contests(id,election_id,office,district) values
('79000000-0000-0000-0000-000000000031','79000000-0000-0000-0000-000000000021','Civicneedle Senate','District 987'),
('79000000-0000-0000-0000-000000000032','79000000-0000-0000-0000-000000000022','Civicneedle Hiddenracecanary','District 986');
insert into public.contest_candidates(contest_id,person_id,party,is_write_in) values
('79000000-0000-0000-0000-000000000031','79000000-0000-0000-0000-000000000011','Visiblepartycanary',true),
('79000000-0000-0000-0000-000000000031','79000000-0000-0000-0000-000000000012','Hiddenpartycanary',false),
('79000000-0000-0000-0000-000000000032','79000000-0000-0000-0000-000000000011','Hiddenracepartycanary',false);
insert into public.ballot_questions(id,election_id,title,question_text) values
('79000000-0000-0000-0000-000000000041','79000000-0000-0000-0000-000000000021','Civicneedle Ballot question','Should Civicneedle fund Librariescanary?'),
('79000000-0000-0000-0000-000000000042','79000000-0000-0000-0000-000000000022','Civicneedle Hiddenquestioncanary','Should hidden funding continue?');
insert into public.articles(id,title,url,visibility) values
('79000000-0000-0000-0000-000000000051','Civicneedle Public Article','https://civicneedle.example.org/article','public'),
('79000000-0000-0000-0000-000000000052','Civicneedle Privatearticlecanary','https://civicneedle.example.org/private','private'),
('79000000-0000-0000-0000-000000000053','Civicneedle Unlistedarticlecanary','https://civicneedle.example.org/unlisted','unlisted');
insert into public.article_people(article_id,person_id,role) values
('79000000-0000-0000-0000-000000000051','79000000-0000-0000-0000-000000000011','Author'),
('79000000-0000-0000-0000-000000000051','79000000-0000-0000-0000-000000000012','Hiddencreditcanary');
insert into public.article_organizations(article_id,organization_id,role) values
('79000000-0000-0000-0000-000000000051','79000000-0000-0000-0000-000000000001','Publisher');
insert into public.calendars(id,organization_id,slug,name,visibility) values
('79000000-0000-0000-0000-000000000061','79000000-0000-0000-0000-000000000001','civicneedle-calendar','Civicneedle Calendar','public'),
('79000000-0000-0000-0000-000000000062','79000000-0000-0000-0000-000000000001','civicneedle-private-calendar','Civicneedle Privatecalendarcanary','private'),
('79000000-0000-0000-0000-000000000063','79000000-0000-0000-0000-000000000001','civicneedle-unlisted-calendar','Civicneedle Unlistedcalendarcanary','unlisted');
insert into public.events(id,calendar_id,title,starts_at,visibility,location) values
('79000000-0000-0000-0000-000000000071','79000000-0000-0000-0000-000000000061','Civicneedle Past Event','2000-01-01','public','Civicneedle Town Hall'),
('79000000-0000-0000-0000-000000000072','79000000-0000-0000-0000-000000000062','Civicneedle Parenthiddencanary','2099-01-01','public',null),
('79000000-0000-0000-0000-000000000073','79000000-0000-0000-0000-000000000061','Civicneedle Privateeventcanary','2099-01-01','private',null),
('79000000-0000-0000-0000-000000000074','79000000-0000-0000-0000-000000000063','Civicneedle Parentunlistedcanary','2099-01-01','public',null);
insert into public.maps(id,slug,name,visibility) values
('79000000-0000-0000-0000-000000000081','civicneedle-map','Civicneedle Map','public'),
('79000000-0000-0000-0000-000000000082','civicneedle-private-map','Civicneedle Privatemapcanary','private');
insert into public.layers(id,name,source_type,visibility) values
('79000000-0000-0000-0000-000000000091','Civicneedle Layer','postgis','public'),
('79000000-0000-0000-0000-000000000092','Civicneedle Privatelayercanary','postgis','private'),
('79000000-0000-0000-0000-000000000093','Civicneedle Orphan Layer','postgis','public'),
('79000000-0000-0000-0000-000000000094','Civicneedle Restricted Parent Layer','postgis','public');
insert into public.map_layers(map_id,layer_id) values
('79000000-0000-0000-0000-000000000081','79000000-0000-0000-0000-000000000091'),
('79000000-0000-0000-0000-000000000081','79000000-0000-0000-0000-000000000092'),
('79000000-0000-0000-0000-000000000082','79000000-0000-0000-0000-000000000094');
insert into public.layer_features(layer_id,position,properties,geometry) values
('79000000-0000-0000-0000-000000000091',0,'{"name":"Featurecanary","road":"Civicneedle Trail"}',extensions.st_geomfromtext('POINT(-83 32)',4326)),
('79000000-0000-0000-0000-000000000092',0,'{"name":"Hiddenfeaturecanary"}',extensions.st_geomfromtext('POINT(-83 32)',4326)),
('79000000-0000-0000-0000-000000000093',0,'{"name":"Orphanfeaturecanary"}',extensions.st_geomfromtext('POINT(-83 32)',4326)),
('79000000-0000-0000-0000-000000000094',0,'{"name":"Parentfeaturecanary"}',extensions.st_geomfromtext('POINT(-83 32)',4326));
insert into public.events(id,calendar_id,title,starts_at,visibility,election_id,election_date_kind) values
('79000000-0000-0000-0000-000000000075','79000000-0000-0000-0000-000000000061','Civicneedle Electionparentcanary','2099-01-01','public','79000000-0000-0000-0000-000000000022','election_day');
-- END FIXTURES
set local role anon;
do $$ declare term text; kinds text[]; one uuid; two uuid; begin
 select array_agg(distinct entity_type order by entity_type) into kinds from public.search_site('Civicneedle',null,100);
 assert kinds=array['article','ballot_question','calendar','contest','election','event','layer','map','organization','person'], 'all ten civic types searchable';
 foreach term in array array['Hiddenpersoncanary','Unlistedpersoncanary','Hiddenaffiliationcanary','Hiddencreditcanary','Hiddenpartycanary','Hiddenracecanary','Hiddenracepartycanary','Privateelectioncanary','Unlistedelectioncanary','Hiddenquestioncanary','Privatearticlecanary','Unlistedarticlecanary','Privatecalendarcanary','Unlistedcalendarcanary','Parenthiddencanary','Privateeventcanary','Parentunlistedcanary','Electionparentcanary','Privatemapcanary','Privatelayercanary','Hiddenfeaturecanary','Orphanfeaturecanary','Parentfeaturecanary'] loop
   assert not exists(select 1 from public.search_site(term,null,100)), 'anonymous leak: '||term;
 end loop;
 assert exists(select 1 from public.search_site('Featurecanary','layer') where id='79000000-0000-0000-0000-000000000091' and url='/maps/view/?id=79000000-0000-0000-0000-000000000081'), 'stored feature routes to accessible map';
 assert exists(select 1 from public.search_site('Civicneedle Public Person','article')), 'articles searchable by permitted author';
 assert exists(select 1 from public.search_site('Civicneedle Organization','article')), 'articles searchable by publisher';
 assert exists(select 1 from public.search_site('Librariescanary','election')), 'election searchable by ballot wording';
 assert exists(select 1 from public.search_site('Visiblepartycanary','person')), 'person searchable by candidacy';
 assert exists(select 1 from public.search_site('Civicneedle Past Event','event')), 'past events remain searchable';
 assert exists(select 1 from public.search_site('public.mail@civicneedle.example.org','person')), 'contact metadata searchable';
 assert exists(select 1 from public.search_site('Civicneed','person')), 'partial names searchable';
 assert (select count(*)=1 from public.search_site('Civicneedle',null,1)), 'limit';
 select id into one from public.search_site('Civicneedle',null,1,0);
 select id into two from public.search_site('Civicneedle',null,1,1);
 assert one<>two, 'pagination advances';
 assert (select count(*)=1 from public.search_elections('Civicneedle',1)), 'directory limit enforced';
 assert exists(select 1 from public.search_elections('Librariescanary',10)), 'election directory searches ballot questions';
 assert exists(select 1 from public.search_people('Visiblepartycanary',10)), 'people directory searches candidacies';
 assert public.get_election('79000000-0000-0000-0000-000000000021')::text not like '%Hiddenpersoncanary%', 'anonymous election payload hides private candidates';
 begin perform * from public.search_site(repeat('x',501)); raise exception 'oversized query accepted'; exception when invalid_parameter_value then null; end;
 begin perform * from public.search_site('x','admins'); raise exception 'internal type accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','77000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare term text; begin
 assert not public.is_admin(), 'ordinary member test';
 foreach term in array array['Hiddenpersoncanary','Unlistedpersoncanary','Hiddenaffiliationcanary','Hiddencreditcanary','Hiddenpartycanary','Hiddenracecanary','Hiddenracepartycanary','Privateelectioncanary','Unlistedelectioncanary','Hiddenquestioncanary','Privatearticlecanary','Unlistedarticlecanary','Privatecalendarcanary','Unlistedcalendarcanary','Parenthiddencanary','Privateeventcanary','Parentunlistedcanary','Electionparentcanary','Privatemapcanary','Privatelayercanary','Hiddenfeaturecanary','Parentfeaturecanary'] loop
   assert exists(select 1 from public.search_site(term,null,100)), 'signed-in missing: '||term;
 end loop;
 assert not exists(select 1 from public.search_site('Orphanfeaturecanary')), 'ordinary member still needs map access to geometry attributes';
 assert public.get_election('79000000-0000-0000-0000-000000000021')::text like '%Hiddenpersoncanary%', 'signed-in election candidate access';
 assert exists(select 1 from public.search_site('Privatearticlecanary','article') where visibility='private'), 'private article access';
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.admins limit 1),true);
set local role authenticated;
do $$ begin
 assert public.is_admin(), 'local admin seeded';
 assert exists(select 1 from public.search_site('Orphanfeaturecanary','layer') where url='/admin/layers/?edit=79000000-0000-0000-0000-000000000093'), 'admin orphan geometry search and destination';
end $$;
reset role;
rollback;

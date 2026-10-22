-- Verified sources and bylines: docs/research/josh-mclaurin-articles.json.
-- Additive seed: preserve existing records and associations on conflict.
do $seed$
declare
  item jsonb;
  article_uuid uuid;
  josh_uuid uuid;
begin
  -- Production already has Josh; allow this seed to run on a clean local DB too.
  insert into public.people (slug, full_name, kind, visibility)
  values ('josh-mclaurin', 'Josh McLaurin', 'candidate', 'public')
  on conflict (slug) do nothing;
  select id into strict josh_uuid from public.people where slug = 'josh-mclaurin';
  insert into public.organizations (slug, name, description, website_url)
  select slug, name, description, website_url
  from jsonb_to_recordset('[{"slug":"the-macon-telegraph","name":"The Macon Telegraph","website_url":"https://www.macon.com/","description":"News publication covering Macon and Middle Georgia, published online at macon.com."},{"slug":"the-macon-melody","name":"The Macon Melody","website_url":"https://maconmelody.com/","description":"Community newspaper covering Macon and Bibb County."}]'::jsonb)
    as x(slug text, name text, description text, website_url text)
  on conflict (slug) do nothing;
  insert into public.people (slug, full_name, kind, description, visibility)
  select slug, full_name, 'other', description, 'public'
  from jsonb_to_recordset('[{"full_name":"Grant Blankenship","slug":"grant-blankenship","description":"Credited author of articles published by The Macon Telegraph."},{"full_name":"Ty Tagami","slug":"ty-tagami","description":"Credited author of articles published by The Macon Telegraph."},{"full_name":"Lucinda Warnke","slug":"lucinda-warnke","description":"Credited author of articles published by The Macon Telegraph."},{"full_name":"Marc Hyden","slug":"marc-hyden","description":"Credited author of articles published by The Macon Melody."},{"full_name":"Gabriel Kopp","slug":"gabriel-kopp","description":"Credited author of articles published by The Macon Telegraph."},{"full_name":"Jesse Fraga","slug":"jesse-fraga","description":"Credited author of articles published by The Macon Telegraph."},{"full_name":"Casey Choung","slug":"casey-choung","description":"Credited author of articles published by The Macon Telegraph."},{"full_name":"Chelsea Madden","slug":"chelsea-madden","description":"Credited author of articles published by The Macon Telegraph."}]'::jsonb)
    as x(slug text, full_name text, description text)
  on conflict (slug) do nothing;
  for item in select value from jsonb_array_elements('[{"title":"What’s behind the chronic understaffing at Georgia prisons? Ask the staff","url":"https://www.macon.com/news/politics-government/article257893663.html","author_slug":"grant-blankenship","publisher":"the-macon-telegraph","role":"Mentioned"},{"title":"Macon’s John F. Kennedy opens the door to run for Georgia lieutenant governor","url":"https://www.macon.com/news/politics-government/article307460996.html","author_slug":"ty-tagami","publisher":"the-macon-telegraph","role":"Mentioned"},{"title":"Sen. John F. Kennedy of Macon announces bid for Georgia lieutenant governor","url":"https://www.macon.com/news/politics-government/article307733920.html","author_slug":"lucinda-warnke","publisher":"the-macon-telegraph","role":"Mentioned"},{"title":"Georgia Senate braces for mass exodus","url":"https://maconmelody.com/wp-content/uploads/2025/06/Melody-6-20-e-Edition.pdf#page=4","author_slug":"marc-hyden","publisher":"the-macon-melody","role":"Mentioned"},{"title":"Macon commissioner who recently resigned is running for another office. What to know","url":"https://www.macon.com/news/politics-government/article314291540.html","author_slug":"lucinda-warnke","publisher":"the-macon-telegraph","role":"Mentioned"},{"title":"Faces familiar to Macon are running for lieutenant governor. Who else is in the race?","url":"https://www.macon.com/news/politics-government/article314390666.html","author_slug":"gabriel-kopp","publisher":"the-macon-telegraph","role":"Subject"},{"title":"Former Macon official drops out of statewide race for ‘personal circumstances’","url":"https://www.macon.com/news/local/article314862211.html","author_slug":"jesse-fraga","publisher":"the-macon-telegraph","role":"Mentioned"},{"title":"Hundreds gather at downtown Macon ‘No Kings’ protest against Trump administration","url":"https://www.macon.com/news/local/article315223626.html","author_slug":"gabriel-kopp","publisher":"the-macon-telegraph","role":"Mentioned"},{"title":"May 19, 2026 Election Results","url":"https://maconmelody.com/051926-election/","author_slug":null,"publisher":"the-macon-melody","role":"Mentioned"},{"title":"Local Macon event seeks to connect people with candidates","url":"https://www.macon.com/news/local/article317242264.html","author_slug":"casey-choung","publisher":"the-macon-telegraph","role":"Mentioned"},{"title":"Georgia’s race for lieutenant governor will change state Senate power structure","url":"https://www.macon.com/news/local/article317259492.html","author_slug":"chelsea-madden","publisher":"the-macon-telegraph","role":"Subject"}]'::jsonb)
  loop
    insert into public.articles (title, url, visibility)
    values (item->>'title', item->>'url', 'public')
    on conflict (url) do nothing;
    select id into strict article_uuid from public.articles where url = item->>'url';
    insert into public.article_people (article_id, person_id, role)
    values (article_uuid, josh_uuid, item->>'role')
    on conflict (article_id, person_id) do nothing;
    if item->>'author_slug' is not null then
      insert into public.article_people (article_id, person_id, role)
      select article_uuid, id, 'Author' from public.people where slug = item->>'author_slug'
      on conflict (article_id, person_id) do nothing;
    end if;
    insert into public.article_organizations (article_id, organization_id, role)
    select article_uuid, id, 'Publisher' from public.organizations where slug = item->>'publisher'
    on conflict (article_id, organization_id) do nothing;
  end loop;
end;
$seed$;

-- Name-variant follow-up: verified historical coverage of Elbert "Al" Bartell.
-- Evidence and identity verification are in the expanded outlet research manifest.
do $seed$
declare item jsonb; link jsonb; article_uuid uuid; person_uuid uuid; publisher_uuid uuid;
begin
  insert into public.people(slug,full_name,kind,description,visibility) values
    ('bill-torpy','Bill Torpy','other','Credited author in candidate news coverage.','public'),
    ('katie-leslie','Katie Leslie','other','Credited author in candidate news coverage.','public')
    on conflict(slug) do nothing;
  select id into strict publisher_uuid from public.organizations where slug='the-atlanta-journal-constitution';
  for item in select value from jsonb_array_elements('[
  {
    "title": "Who’s challenging Kelly Loeffler for Johnny Isakson’s U.S. Senate seat",
    "url": "https://www.ajc.com/blog/politics/who-challenging-kelly-loeffler-for-johnny-isakson-senate-seat/uSI2b40jvqEb9By6UxczvK/",
    "published_on": "2020-06-29",
    "fetched_on": "2026-10-21",
    "people": [
      {
        "slug": "elbert-arthur-bartell",
        "role": "Mentioned"
      },
      {
        "slug": "tia-mitchell",
        "role": "Author"
      }
    ]
  },
  {
    "title": "Reed’s war chest reflects friends in and beyond Atlanta",
    "url": "https://www.ajc.com/news/local-govt--politics/reed-war-chest-reflects-friends-and-beyond-atlanta/WDiH3babpqaz8mR9DMOaOO/",
    "published_on": "2013-07-14",
    "fetched_on": "2026-10-21",
    "people": [
      {
        "slug": "elbert-arthur-bartell",
        "role": "Mentioned"
      },
      {
        "slug": "katie-leslie",
        "role": "Author"
      },
      {
        "slug": "chris-joyner",
        "role": "Contributor"
      },
      {
        "slug": "greg-bluestein",
        "role": "Contributor"
      }
    ]
  },
  {
    "title": "OPINION: Why no outrage? Atlanta shootings surge, but it’s not the cops",
    "url": "https://www.ajc.com/news/local/opinion-hello-outrage-atlanta-shootings-surge-but-not-the-cops/pUYKjFGY8LcxSVlrHZpb4H/",
    "published_on": "2020-06-29",
    "fetched_on": "2026-10-21",
    "people": [
      {
        "slug": "elbert-arthur-bartell",
        "role": "Mentioned"
      },
      {
        "slug": "bill-torpy",
        "role": "Author"
      }
    ]
  },
  {
    "title": "OPINION: $500K homes | Going for broke in once-broken swath of Atlanta",
    "url": "https://www.ajc.com/opinion/columnists/opinion-500k-homes-going-for-broke-in-once-broken-swath-of-atlanta/BA7M7XZ2LVEYLOP3XKZ5XZPFLM/",
    "published_on": "2021-04-09",
    "fetched_on": "2026-10-21",
    "people": [
      {
        "slug": "elbert-arthur-bartell",
        "role": "Mentioned"
      },
      {
        "slug": "bill-torpy",
        "role": "Author"
      }
    ]
  }
]'::jsonb)
  loop
    insert into public.articles(title,url,visibility,published_on,fetched_on)
      values(item->>'title',item->>'url','public',(item->>'published_on')::date,(item->>'fetched_on')::date)
      on conflict(url) do nothing;
    select id into strict article_uuid from public.articles where url=item->>'url';
    update public.articles set published_on=coalesce(published_on,(item->>'published_on')::date),fetched_on=greatest(fetched_on,(item->>'fetched_on')::date) where id=article_uuid;
    for link in select value from jsonb_array_elements(item->'people')
    loop
      select id into strict person_uuid from public.people where slug=link->>'slug';
      insert into public.article_people(article_id,person_id,role) values(article_uuid,person_uuid,link->>'role') on conflict(article_id,person_id) do nothing;
    end loop;
    insert into public.article_organizations(article_id,organization_id,role) values(article_uuid,publisher_uuid,'Publisher') on conflict(article_id,organization_id) do nothing;
  end loop;
end;
$seed$;
